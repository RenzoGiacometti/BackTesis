import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMapaDto } from './dto/create-mapa.dto';
import { UpdateMapaDto } from './dto/update-mapa.dto';
import { ROLES } from '../common/constants/roles.constants';
import { AuthUser } from '../auth/strategies/jwt-access.strategy';
import { EstadoMapa } from '@prisma/client';

@Injectable()
export class MapasService {
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

    // ─── Crear mapa con metadata (upload con bounds) ─────────────────────
    async createWithMetadata(dto: CreateMapaDto, metadataLiviana: { bounds: number[][] }, user: AuthUser) {
        await this.assertChacraEnOrg(dto.idChacra, user.idOrg);

        const tipoMapa = await this.prisma.catalogoTipoMapa.findUnique({
            where: { id: dto.idTipoMapa },
        });
        if (!tipoMapa || tipoMapa.estado !== 'activo') {
            throw new BadRequestException('Tipo de mapa no valido');
        }

        return this.prisma.mapaPublicado.create({
            data: {
                idChacra: dto.idChacra,
                idTipoMapa: dto.idTipoMapa,
                fechaMapa: new Date(dto.fechaMapa),
                fechaGeneracion: new Date(),
                fechaPublicacion: new Date(),
                previewUrl: dto.previewUrl,
                tilesUrlBase: dto.tilesUrlBase,
                refProcExterna: dto.refProcExterna,
                metadataLiviana,
                estado: 'publicado' as EstadoMapa,
            },
            select: this.mapaSelect(),
        });
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

    /** Verifica acceso a la chacra según rol */
    private async assertChacraAcceso(idChacra: string, user: AuthUser) {
        await this.assertChacraEnOrg(idChacra, user.idOrg);

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
