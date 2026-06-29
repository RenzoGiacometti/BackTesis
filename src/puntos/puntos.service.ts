import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePuntoDto } from './dto/create-punto.dto';
import { UpdatePuntoDto, UpdatePuntoEstadoDto } from './dto/update-punto.dto';
import { CreateComentarioDto } from './dto/create-comentario.dto';
import { ROLES } from '../common/constants/roles.constants';
import { AuthUser } from '../auth/strategies/jwt-access.strategy';
import { EstadoPunto } from '@prisma/client';

@Injectable()
export class PuntosService {
    constructor(private readonly prisma: PrismaService) {}

    // ═══════════════════════════════════════════════════════════════════════
    //  PUNTOS DE PROBLEMA
    // ═══════════════════════════════════════════════════════════════════════

    async create(dto: CreatePuntoDto, user: AuthUser) {
        const mapa = await this.assertMapaAcceso(dto.idMapa, user);

        const severidad = await this.prisma.catalogoSeveridad.findUnique({
            where: { id: dto.idSeveridad },
        });
        if (!severidad || severidad.estado !== 'activo') {
            throw new BadRequestException('Severidad no válida');
        }

        return this.prisma.puntoProblema.create({
            data: {
                idMapa: dto.idMapa,
                coordenadaX: dto.coordenadaX,
                coordenadaY: dto.coordenadaY,
                idSeveridad: dto.idSeveridad,
                descripcion: dto.descripcion,
            },
            select: this.puntoSelect(),
        });
    }

    async findByMapa(idMapa: string, user: AuthUser) {
        await this.assertMapaAcceso(idMapa, user);

        return this.prisma.puntoProblema.findMany({
            where: { idMapa },
            select: this.puntoSelect(),
            orderBy: { fechaDeteccion: 'desc' },
        });
    }

    async findOne(id: string, user: AuthUser) {
        const punto = await this.prisma.puntoProblema.findUnique({
            where: { id },
            select: {
                ...this.puntoSelect(),
                comentarios: {
                    where: { estado: 'activo' },
                    select: this.comentarioSelect(),
                    orderBy: { fechaCreacion: 'asc' },
                },
                historial: {
                    select: {
                        id: true,
                        estadoAnterior: true,
                        estadoNuevo: true,
                        observacion: true,
                        fechaCambio: true,
                        usuario: { select: { id: true, nombre: true, apellido: true } },
                    },
                    orderBy: { fechaCambio: 'desc' },
                },
            },
        });

        if (!punto) throw new NotFoundException('Punto de problema no encontrado');
        await this.assertMapaAcceso(punto.idMapa, user);

        return punto;
    }

    async update(id: string, dto: UpdatePuntoDto, user: AuthUser) {
        const punto = await this.assertPuntoAcceso(id, user);

        const data: Record<string, unknown> = {};
        if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
        if (dto.idSeveridad !== undefined) {
            const sev = await this.prisma.catalogoSeveridad.findUnique({ where: { id: dto.idSeveridad } });
            if (!sev || sev.estado !== 'activo') throw new BadRequestException('Severidad no válida');
            data.idSeveridad = dto.idSeveridad;
        }

        return this.prisma.puntoProblema.update({
            where: { id },
            data,
            select: this.puntoSelect(),
        });
    }

    // ─── Cambio de estado (con historial automático) ────────────────────
    async changeEstado(id: string, dto: UpdatePuntoEstadoDto, user: AuthUser) {
        const punto = await this.assertPuntoAcceso(id, user);

        if (punto.estado === dto.estado) {
            throw new BadRequestException(`El punto ya está en estado "${dto.estado}"`);
        }

        const [updated] = await this.prisma.$transaction([
            this.prisma.puntoProblema.update({
                where: { id },
                data: { estado: dto.estado as EstadoPunto },
                select: this.puntoSelect(),
            }),
            this.prisma.historialPuntoProblema.create({
                data: {
                    idPuntoProblema: id,
                    idUsuario: user.id,
                    estadoAnterior: punto.estado,
                    estadoNuevo: dto.estado as EstadoPunto,
                    observacion: dto.observacion,
                },
            }),
        ]);

        return updated;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  COMENTARIOS
    // ═══════════════════════════════════════════════════════════════════════

    async createComentario(idPunto: string, dto: CreateComentarioDto, user: AuthUser) {
        await this.assertPuntoAcceso(idPunto, user);

        return this.prisma.comentarioPunto.create({
            data: {
                idPuntoProblema: idPunto,
                idUsuario: user.id,
                texto: dto.texto,
                imagenUrl: dto.imagenUrl,
            },
            select: this.comentarioSelect(),
        });
    }

    async findComentarios(idPunto: string, user: AuthUser) {
        await this.assertPuntoAcceso(idPunto, user);

        return this.prisma.comentarioPunto.findMany({
            where: { idPuntoProblema: idPunto, estado: 'activo' },
            select: this.comentarioSelect(),
            orderBy: { fechaCreacion: 'asc' },
        });
    }

    async deleteComentario(idComentario: string, user: AuthUser) {
        const comentario = await this.prisma.comentarioPunto.findUnique({
            where: { id: idComentario },
            include: { puntoProblema: { select: { idMapa: true } } },
        });

        if (!comentario || comentario.estado !== 'activo') {
            throw new NotFoundException('Comentario no encontrado');
        }

        // Solo el autor o un admin pueden borrar
        if (comentario.idUsuario !== user.id && user.rol !== ROLES.ADMIN) {
            throw new ForbiddenException('No podés eliminar este comentario');
        }

        return this.prisma.comentarioPunto.update({
            where: { id: idComentario },
            data: { estado: 'inactivo' },
            select: { id: true, estado: true },
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /** Devuelve el mapa validando acceso por org y rol.
     *  Productor: solo accede a mapas de chacras que le pertenecen.
     *  Aguador: solo accede si tiene asignación activa a la chacra del mapa. */
    private async assertMapaAcceso(idMapa: string, user: AuthUser) {
        const mapa = await this.prisma.mapaPublicado.findUnique({
            where: { id: idMapa },
            select: {
                id: true,
                idChacra: true,
                chacra: { select: { idOrganizacion: true, idProductor: true } },
            },
        });

        if (!mapa || mapa.chacra.idOrganizacion !== user.idOrg) {
            throw new NotFoundException('Mapa no encontrado');
        }

        if (user.rol === ROLES.PRODUCTOR && mapa.chacra.idProductor !== user.idUO) {
            throw new ForbiddenException('No tenés acceso a esta chacra');
        }

        if (user.rol === ROLES.AGUADOR) {
            const asignacion = await this.prisma.usuarioChacra.findFirst({
                where: { idChacra: mapa.idChacra, idUsuarioOrganizacion: user.idUO, estado: 'activo' },
            });
            if (!asignacion) throw new ForbiddenException('No tenés asignación a esta chacra');
        }

        return mapa;
    }

    /** Devuelve el punto validando acceso al mapa padre */
    private async assertPuntoAcceso(id: string, user: AuthUser) {
        const punto = await this.prisma.puntoProblema.findUnique({
            where: { id },
            select: { id: true, idMapa: true, estado: true },
        });

        if (!punto) throw new NotFoundException('Punto de problema no encontrado');
        await this.assertMapaAcceso(punto.idMapa, user);

        return punto;
    }

    private puntoSelect() {
        return {
            id: true,
            idMapa: true,
            coordenadaX: true,
            coordenadaY: true,
            descripcion: true,
            estado: true,
            tipo: true,
            fechaDeteccion: true,
            severidad: { select: { id: true, nombre: true, nivel: true } },
        } as const;
    }

    private comentarioSelect() {
        return {
            id: true,
            texto: true,
            imagenUrl: true,
            fechaCreacion: true,
            usuario: { select: { id: true, nombre: true, apellido: true } },
        } as const;
    }
}
