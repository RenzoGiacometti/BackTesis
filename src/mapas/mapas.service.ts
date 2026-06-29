import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMapaDto } from './dto/create-mapa.dto';
import { UpdateMapaDto } from './dto/update-mapa.dto';
import { ROLES } from '../common/constants/roles.constants';
import { AuthUser } from '../auth/strategies/jwt-access.strategy';
import { EstadoMapa, Prisma, TipoProblema } from '@prisma/client';

@Injectable()
export class MapasService {
    private readonly logger = new Logger(MapasService.name);

    constructor(private readonly prisma: PrismaService) {}

    // ─── Crear mapa (Admin / Processing Backend) ────────────────────────
    async create(dto: CreateMapaDto, user: AuthUser) {
        // Validar que la chacra pertenece a la org del usuario
        await this.assertChacraEnOrg(dto.idChacra, user.idOrg);

        // Validar que el tipo de mapa existe y está activo
        const tipoMapa = await this.prisma.catalogoTipoMapa.findUnique({
            where: { id: dto.idTipoMapa },
        });
        if (!tipoMapa || tipoMapa.estado !== 'activo') {
            throw new BadRequestException('Tipo de mapa no válido');
        }

        return this.prisma.mapaPublicado.create({
            data: {
                idChacra: dto.idChacra,
                idTipoMapa: dto.idTipoMapa,
                fechaMapa: new Date(dto.fechaMapa),
                fechaGeneracion: new Date(),
                tilesUrlBase: dto.tilesUrlBase,
                previewUrl: dto.previewUrl,
                refProcExterna: dto.refProcExterna,
            },
            select: this.mapaSelect(),
        });
    }

    // ─── Crear mapa con metadata (upload con bounds + zones opcional) ───
    async createWithMetadata(
        dto: CreateMapaDto,
        metadataLiviana: { bounds: [[number, number], [number, number]]; zones?: unknown[] },
        user: AuthUser,
        puntosConfig: { minAreaM2?: number; clusterDistanceM?: number } = {},
    ) {
        await this.assertChacraEnOrg(dto.idChacra, user.idOrg);

        const tipoMapa = await this.prisma.catalogoTipoMapa.findUnique({
            where: { id: dto.idTipoMapa },
        });
        if (!tipoMapa || tipoMapa.estado !== 'activo') {
            throw new BadRequestException('Tipo de mapa no valido');
        }

        // Resolver IDs de severidad (lookup por nombre del catálogo). Lo hacemos
        // una sola vez fuera de la transacción para evitar 4 queries por punto.
        const sevByNivel = await this.loadSeveridadesByNivel();

        // Construir los puntos de problema a insertar a partir de las zones
        // del map_output.json. Si no hay zones (o todas son inválidas),
        // no creamos puntos y el mapa queda sin puntos asociados.
        const zonesArray = Array.isArray(metadataLiviana.zones) ? metadataLiviana.zones : [];
        this.logger.log(
            `[upload] chacra=${dto.idChacra} zones recibidas=${zonesArray.length} ` +
            `minAreaM2=${puntosConfig.minAreaM2 ?? 'sin filtro'} ` +
            `clusterDistanceM=${puntosConfig.clusterDistanceM ?? 'sin filtro'} ` +
            `severidades en catálogo niveles=${[...sevByNivel.keys()].sort().join(',')}`,
        );
        const puntosData = this.zonesToPuntosData(zonesArray, sevByNivel, puntosConfig);
        this.logger.log(`[upload] puntos a insertar=${puntosData.length}`);

        // Crear el mapa + sus puntos atómicamente
        const mapa = await this.prisma.$transaction(async (tx) => {
            const created = await tx.mapaPublicado.create({
                data: {
                    idChacra: dto.idChacra,
                    idTipoMapa: dto.idTipoMapa,
                    fechaMapa: new Date(dto.fechaMapa),
                    fechaGeneracion: new Date(),
                    fechaPublicacion: new Date(),
                    previewUrl: dto.previewUrl,
                    tilesUrlBase: dto.tilesUrlBase,
                    refProcExterna: dto.refProcExterna,
                    metadataLiviana: metadataLiviana as unknown as Prisma.InputJsonValue,
                    estado: 'publicado' as EstadoMapa,
                },
                select: this.mapaSelect(),
            });

            if (puntosData.length > 0) {
                const result = await tx.puntoProblema.createMany({
                    data: puntosData.map((p) => ({ ...p, idMapa: created.id })),
                });
                this.logger.log(`[upload] createMany ok: ${result.count} puntos creados para mapa=${created.id}`);
            } else {
                this.logger.warn(`[upload] mapa=${created.id} creado sin puntos (puntosData vacío)`);
            }

            return created;
        });

        return mapa;
    }

    /** Devuelve un map { nivel -> idSeveridad } leyendo el catálogo de severidades. */
    private async loadSeveridadesByNivel(): Promise<Map<number, string>> {
        const severidades = await this.prisma.catalogoSeveridad.findMany({
            where: { estado: 'activo' },
            select: { id: true, nivel: true },
        });
        const map = new Map<number, string>();
        for (const sev of severidades) map.set(sev.nivel, sev.id);
        if (map.size === 0) {
            throw new BadRequestException('No hay severidades en el catálogo. Corré el seed.');
        }
        return map;
    }

    /** Convierte el array de zones del map_output.json en filas listas para
     *  insertar en `punto_problema`.
     *
     *  Pasos (en orden):
     *  1. Parsea y descarta zonas inválidas (sin lat/lng).
     *  2. Si `minAreaM2 > 0`, filtra zonas más chicas (los polígonos NO se
     *     filtran — sólo se reduce qué se convierte en PuntoProblema).
     *  3. Si `clusterDistanceM > 0`, agrupa zonas cuyos centroides están a
     *     ≤ esa distancia (union-find sobre haversine) y genera UN punto
     *     representativo por grupo. Las zonas aisladas siguen 1-a-1. */
    private zonesToPuntosData(
        zones: unknown[],
        sevByNivel: Map<number, string>,
        config: { minAreaM2?: number; clusterDistanceM?: number },
    ): Array<{
        coordenadaX: number;
        coordenadaY: number;
        idSeveridad: string;
        descripcion: string;
        tipo: TipoProblema;
    }> {
        // 1. Parse + validate
        const parsed: ParsedZone[] = [];
        for (const raw of zones) {
            const z = this.parseZone(raw);
            if (z) parsed.push(z);
        }

        // 2. Filtro de área
        const minArea = Number.isFinite(config.minAreaM2 ?? NaN) ? Number(config.minAreaM2) : 0;
        const filtered = minArea > 0 ? parsed.filter((z) => z.areaM2 >= minArea) : parsed;

        // 3. Clustering opcional
        const eps = Number.isFinite(config.clusterDistanceM ?? NaN) ? Number(config.clusterDistanceM) : 0;
        const groups: ParsedZone[][] = eps > 0 ? this.clusterZonesByDistance(filtered, eps) : filtered.map((z) => [z]);

        // 4. Build punto por grupo
        const result: Array<{
            coordenadaX: number;
            coordenadaY: number;
            idSeveridad: string;
            descripcion: string;
            tipo: TipoProblema;
        }> = [];

        let nullBuilders = 0;
        for (const group of groups) {
            const punto = group.length === 1
                ? this.buildPuntoFromZone(group[0], sevByNivel)
                : this.buildPuntoFromCluster(group, sevByNivel);
            if (punto) result.push(punto);
            else nullBuilders++;
        }

        this.logger.log(
            `[zonesToPuntosData] raw=${zones.length} parsed=${parsed.length} ` +
            `afterAreaFilter=${filtered.length} groups=${groups.length} ` +
            `built=${result.length} discardedByBuilder=${nullBuilders}`,
        );

        return result;
    }

    /** Parsea una zona del JSON. Devuelve null si no tiene lat/lng numéricos. */
    private parseZone(raw: unknown): ParsedZone | null {
        if (!raw || typeof raw !== 'object') return null;
        const z = raw as Record<string, unknown>;

        const lat = Number(z.lat);
        const lng = Number(z.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const meanDepth = Number(z.mean_depth_cm);
        const areaM2 = Number(z.area_m2);

        return {
            type: typeof z.type === 'string' ? z.type : '',
            lat,
            lng,
            meanDepthCm: Number.isFinite(meanDepth) ? meanDepth : 0,
            areaM2: Number.isFinite(areaM2) ? areaM2 : 0,
        };
    }

    /** Agrupa zonas cuyos centroides están a ≤ epsMeters entre sí, usando
     *  union-find sobre distancia haversine. Conectividad transitiva: si
     *  A↔B y B↔C, A, B y C terminan en el mismo grupo. Complejidad O(n²). */
    private clusterZonesByDistance(zones: ParsedZone[], epsMeters: number): ParsedZone[][] {
        const n = zones.length;
        if (n === 0) return [];

        const parent = Array.from({ length: n }, (_, i) => i);
        const find = (i: number): number => {
            let root = i;
            while (parent[root] !== root) root = parent[root];
            // path compression
            let cur = i;
            while (parent[cur] !== root) {
                const next = parent[cur];
                parent[cur] = root;
                cur = next;
            }
            return root;
        };
        const union = (a: number, b: number) => {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent[ra] = rb;
        };

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (haversineMeters(zones[i].lat, zones[i].lng, zones[j].lat, zones[j].lng) <= epsMeters) {
                    union(i, j);
                }
            }
        }

        const buckets = new Map<number, ParsedZone[]>();
        for (let i = 0; i < n; i++) {
            const root = find(i);
            if (!buckets.has(root)) buckets.set(root, []);
            buckets.get(root)!.push(zones[i]);
        }

        return Array.from(buckets.values());
    }

    /** Construye un PuntoProblema para una zona individual. */
    private buildPuntoFromZone(
        z: ParsedZone,
        sevByNivel: Map<number, string>,
    ): { coordenadaX: number; coordenadaY: number; idSeveridad: string; descripcion: string; tipo: TipoProblema } | null {
        const nivel = this.severityLevelForZone(z.type, z.meanDepthCm);
        const idSeveridad = sevByNivel.get(nivel) ?? sevByNivel.get(1);
        if (!idSeveridad) return null;

        return {
            coordenadaX: z.lng,
            coordenadaY: z.lat,
            idSeveridad,
            descripcion: this.zoneDescription(z.type, z.meanDepthCm, z.areaM2),
            tipo: this.tipoFromZoneType(z.type),
        };
    }

    /** Construye un PuntoProblema representativo de un grupo de zonas
     *  fusionado por proximidad. La severidad es la peor del grupo, el
     *  centro es el promedio ponderado por área, y la descripción resume
     *  el contenido del grupo. */
    private buildPuntoFromCluster(
        zones: ParsedZone[],
        sevByNivel: Map<number, string>,
    ): { coordenadaX: number; coordenadaY: number; idSeveridad: string; descripcion: string; tipo: TipoProblema } | null {
        // Centroide ponderado por área. Si todas tienen área 0, promedio simple.
        const totalArea = zones.reduce((acc, z) => acc + z.areaM2, 0);
        let lat: number;
        let lng: number;
        if (totalArea > 0) {
            lat = zones.reduce((acc, z) => acc + z.lat * z.areaM2, 0) / totalArea;
            lng = zones.reduce((acc, z) => acc + z.lng * z.areaM2, 0) / totalArea;
        } else {
            lat = zones.reduce((acc, z) => acc + z.lat, 0) / zones.length;
            lng = zones.reduce((acc, z) => acc + z.lng, 0) / zones.length;
        }

        // Severidad: la peor de todas las zonas del cluster
        const worstNivel = Math.max(...zones.map((z) => this.severityLevelForZone(z.type, z.meanDepthCm)));
        const idSeveridad = sevByNivel.get(worstNivel) ?? sevByNivel.get(1);
        if (!idSeveridad) return null;

        // Resumen del grupo en la descripción
        const nFalta = zones.filter((z) => z.type === 'falta_agua').length;
        const nExceso = zones.filter((z) => z.type === 'exceso_agua').length;
        const composicion: string[] = [];
        if (nFalta > 0) composicion.push(`${nFalta} de falta de agua`);
        if (nExceso > 0) composicion.push(`${nExceso} de exceso de agua`);
        const descripcion = `Grupo de ${zones.length} zonas (${composicion.join(', ')}) · área total ${totalArea.toFixed(1)} m²`;

        // Tipo: si todas las zonas son del mismo tipo, ese tipo; si mezcla, 'mixto'.
        const tipo: TipoProblema =
            nFalta > 0 && nExceso === 0 ? 'falta_agua' :
            nExceso > 0 && nFalta === 0 ? 'exceso_agua' :
            nFalta > 0 && nExceso > 0 ? 'mixto' : 'desconocido';

        return {
            coordenadaX: lng,
            coordenadaY: lat,
            idSeveridad,
            descripcion,
            tipo,
        };
    }

    /** Mapea el `type` string del map_output.json al enum TipoProblema. */
    private tipoFromZoneType(type: string): TipoProblema {
        if (type === 'falta_agua') return 'falta_agua';
        if (type === 'exceso_agua') return 'exceso_agua';
        return 'desconocido';
    }

    /** Mapea (tipo, profundidad) a un nivel 1-4 del catálogo de severidad.
     *  - falta_agua: más severo cuanto menor la profundidad (umbral 3cm).
     *  - exceso_agua: más severo cuanto mayor la profundidad (umbral 15cm). */
    private severityLevelForZone(type: string, meanDepthCm: number): number {
        if (!Number.isFinite(meanDepthCm)) return 1;

        if (type === 'falta_agua') {
            if (meanDepthCm <= 1) return 4;
            if (meanDepthCm <= 2) return 3;
            if (meanDepthCm < 3) return 2;
            return 1;
        }
        if (type === 'exceso_agua') {
            if (meanDepthCm >= 20) return 4;
            if (meanDepthCm >= 18) return 3;
            if (meanDepthCm > 15) return 2;
            return 1;
        }
        return 1;
    }

    private zoneDescription(type: string, meanDepthCm: number, areaM2: number): string {
        const tipoLabel = type === 'falta_agua' ? 'Falta de agua' : type === 'exceso_agua' ? 'Exceso de agua' : type;
        const parts: string[] = [tipoLabel];
        if (Number.isFinite(meanDepthCm)) parts.push(`prof. media ${meanDepthCm.toFixed(1)} cm`);
        if (Number.isFinite(areaM2)) parts.push(`área ${areaM2.toFixed(1)} m²`);
        return parts.join(' · ');
    }

    // ─── Listar mapas de una chacra ─────────────────────────────────────
    async findByChacra(idChacra: string, user: AuthUser) {
        await this.assertChacraAcceso(idChacra, user);

        return this.prisma.mapaPublicado.findMany({
            where: { idChacra, estado: { not: 'archivado' as EstadoMapa } },
            select: this.mapaSelect(),
            orderBy: { fechaMapa: 'desc' },
        });
    }

    // ─── Detalle de un mapa (con puntos de problema) ────────────────────
    async findOne(id: string, user: AuthUser) {
        const mapa = await this.prisma.mapaPublicado.findUnique({
            where: { id },
            select: {
                ...this.mapaSelect(),
                puntos: {
                    select: {
                        id: true,
                        coordenadaX: true,
                        coordenadaY: true,
                        descripcion: true,
                        estado: true,
                        tipo: true,
                        fechaDeteccion: true,
                        severidad: { select: { id: true, nombre: true, nivel: true } },
                    },
                    orderBy: { fechaDeteccion: 'desc' },
                },
            },
        });

        if (!mapa) throw new NotFoundException('Mapa no encontrado');

        // Verificar acceso a la chacra del mapa
        await this.assertChacraAcceso(mapa.idChacra, user);

        return mapa;
    }

    // ─── Actualizar mapa (URLs, estado, metadata) ───────────────────────
    async update(id: string, dto: UpdateMapaDto, user: AuthUser) {
        const mapa = await this.prisma.mapaPublicado.findUnique({ where: { id } });
        if (!mapa) throw new NotFoundException('Mapa no encontrado');
        await this.assertChacraEnOrg(mapa.idChacra, user.idOrg);

        const data: Record<string, unknown> = {};
        if (dto.tilesUrlBase !== undefined) data.tilesUrlBase = dto.tilesUrlBase;
        if (dto.previewUrl !== undefined) data.previewUrl = dto.previewUrl;
        if (dto.resumenEstadistico !== undefined) data.resumenEstadistico = dto.resumenEstadistico;
        if (dto.metadataLiviana !== undefined) data.metadataLiviana = dto.metadataLiviana;
        if (dto.refProcExterna !== undefined) data.refProcExterna = dto.refProcExterna;

        if (dto.estado) {
            data.estado = dto.estado;
            // Cuando se publica, registrar la fecha
            if (dto.estado === 'publicado' && !mapa.fechaPublicacion) {
                data.fechaPublicacion = new Date();
            }
        }

        return this.prisma.mapaPublicado.update({
            where: { id },
            data,
            select: this.mapaSelect(),
        });
    }

    // ─── Archivar mapa ──────────────────────────────────────────────────
    async archive(id: string, user: AuthUser) {
        const mapa = await this.prisma.mapaPublicado.findUnique({ where: { id } });
        if (!mapa) throw new NotFoundException('Mapa no encontrado');
        await this.assertChacraEnOrg(mapa.idChacra, user.idOrg);

        return this.prisma.mapaPublicado.update({
            where: { id },
            data: { estado: 'archivado' as EstadoMapa },
            select: { id: true, estado: true },
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /** Verifica que la chacra pertenece a la org del usuario */
    private async assertChacraEnOrg(idChacra: string, idOrg: string) {
        const chacra = await this.prisma.chacra.findFirst({
            where: { id: idChacra, idOrganizacion: idOrg, estado: 'activo' },
        });
        if (!chacra) throw new NotFoundException('Chacra no encontrada en esta organización');
        return chacra;
    }

    /** Verifica acceso a la chacra según rol.
     *  - Admin: cualquier chacra de la org.
     *  - Productor: solo si es el dueño (idProductor).
     *  - Aguador: solo si tiene asignación activa. */
    private async assertChacraAcceso(idChacra: string, user: AuthUser) {
        const chacra = await this.assertChacraEnOrg(idChacra, user.idOrg);

        if (user.rol === ROLES.PRODUCTOR && chacra.idProductor !== user.idUO) {
            throw new ForbiddenException('No tenés acceso a esta chacra');
        }

        if (user.rol === ROLES.AGUADOR) {
            const asignacion = await this.prisma.usuarioChacra.findFirst({
                where: { idChacra, idUsuarioOrganizacion: user.idUO, estado: 'activo' },
            });
            if (!asignacion) {
                throw new ForbiddenException('No tenés asignación a esta chacra');
            }
        }
    }

    /** Select estándar de mapa (sin puntos) */
    private mapaSelect() {
        return {
            id: true,
            idChacra: true,
            fechaMapa: true,
            fechaGeneracion: true,
            fechaPublicacion: true,
            tilesUrlBase: true,
            previewUrl: true,
            resumenEstadistico: true,
            metadataLiviana: true,
            refProcExterna: true,
            estado: true,
            tipoMapa: { select: { id: true, nombre: true } },
        } as const;
    }
}

interface ParsedZone {
    type: string;
    lat: number;
    lng: number;
    meanDepthCm: number;
    areaM2: number;
}

/** Distancia haversine en metros entre dos puntos (lat/lng en grados). */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
