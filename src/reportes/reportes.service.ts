import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { UpdateReporteDto } from './dto/update-reporte.dto';
import { ROLES } from '../common/constants/roles.constants';
import { AuthUser } from '../auth/strategies/jwt-access.strategy';
import { EstadoReporte } from '@prisma/client';

@Injectable()
export class ReportesService {
    constructor(private readonly prisma: PrismaService) {}

    // ─── Crear reporte ────────────────────────────────────────────────────
    async create(dto: CreateReporteDto, user: AuthUser) {
        await this.assertChacraAcceso(dto.idChacra, user);

        // Si se asocia a un mapa, verificar que existe y pertenece a la chacra
        if (dto.idMapa) {
            const mapa = await this.prisma.mapaPublicado.findFirst({
                where: { id: dto.idMapa, idChacra: dto.idChacra },
            });
            if (!mapa) throw new BadRequestException('Mapa no encontrado en esta chacra');
        }

        return this.prisma.reporte.create({
            data: {
                idChacra: dto.idChacra,
                idMapa: dto.idMapa,
                tipoReporte: dto.tipoReporte,
                titulo: dto.titulo,
                resumen: dto.resumen,
                archivoUrl: dto.archivoUrl,
            },
            select: this.reporteSelect(),
        });
    }

    // ─── Listar todos los reportes de la org ──────────────────────────────
    async findAll(user: AuthUser) {
        // Obtener todas las chacras accesibles para el usuario
        const chacraIds = await this.getChacraIdsAccesibles(user);

        return this.prisma.reporte.findMany({
            where: {
                idChacra: { in: chacraIds },
                estado: { not: 'archivado' as EstadoReporte },
            },
            select: this.reporteSelect(),
            orderBy: { fechaGeneracion: 'desc' },
        });
    }

    // ─── Listar reportes de una chacra ────────────────────────────────────
    async findByChacra(idChacra: string, user: AuthUser) {
        await this.assertChacraAcceso(idChacra, user);

        return this.prisma.reporte.findMany({
            where: {
                idChacra,
                estado: { not: 'archivado' as EstadoReporte },
            },
            select: this.reporteSelect(),
            orderBy: { fechaGeneracion: 'desc' },
        });
    }

    // ─── Detalle de un reporte ────────────────────────────────────────────
    async findOne(id: string, user: AuthUser) {
        const reporte = await this.prisma.reporte.findUnique({
            where: { id },
            select: this.reporteSelect(),
        });

        if (!reporte) throw new NotFoundException('Reporte no encontrado');

        await this.assertChacraAcceso(reporte.idChacra, user);

        return reporte;
    }

    // ─── Actualizar reporte ───────────────────────────────────────────────
    async update(id: string, dto: UpdateReporteDto, user: AuthUser) {
        const reporte = await this.prisma.reporte.findUnique({ where: { id } });
        if (!reporte) throw new NotFoundException('Reporte no encontrado');
        await this.assertChacraEnOrg(reporte.idChacra, user.idOrg);

        const data: Record<string, unknown> = {};
        if (dto.titulo !== undefined) data.titulo = dto.titulo;
        if (dto.resumen !== undefined) data.resumen = dto.resumen;
        if (dto.archivoUrl !== undefined) data.archivoUrl = dto.archivoUrl;
        if (dto.estado !== undefined) data.estado = dto.estado;

        return this.prisma.reporte.update({
            where: { id },
            data,
            select: this.reporteSelect(),
        });
    }

    // ─── Archivar reporte ─────────────────────────────────────────────────
    async archive(id: string, user: AuthUser) {
        const reporte = await this.prisma.reporte.findUnique({ where: { id } });
        if (!reporte) throw new NotFoundException('Reporte no encontrado');
        await this.assertChacraEnOrg(reporte.idChacra, user.idOrg);

        return this.prisma.reporte.update({
            where: { id },
            data: { estado: 'archivado' as EstadoReporte },
            select: { id: true, estado: true },
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    private async assertChacraEnOrg(idChacra: string, idOrg: string) {
        const chacra = await this.prisma.chacra.findFirst({
            where: { id: idChacra, idOrganizacion: idOrg, estado: 'activo' },
        });
        if (!chacra) throw new NotFoundException('Chacra no encontrada');
        return chacra;
    }

    private async assertChacraAcceso(idChacra: string, user: AuthUser) {
        await this.assertChacraEnOrg(idChacra, user.idOrg);

        if (user.rol === ROLES.AGUADOR) {
            const asignacion = await this.prisma.usuarioChacra.findFirst({
                where: { idChacra, idUsuarioOrganizacion: user.idUO, estado: 'activo' },
            });
            if (!asignacion) {
                throw new ForbiddenException('No tenes asignacion a esta chacra');
            }
        }
    }

    private async getChacraIdsAccesibles(user: AuthUser): Promise<string[]> {
        if (user.rol === ROLES.AGUADOR) {
            const asignaciones = await this.prisma.usuarioChacra.findMany({
                where: { idUsuarioOrganizacion: user.idUO, estado: 'activo' },
                select: { idChacra: true },
            });
            return asignaciones.map((a) => a.idChacra);
        }

        const chacras = await this.prisma.chacra.findMany({
            where: { idOrganizacion: user.idOrg, estado: 'activo' },
            select: { id: true },
        });
        return chacras.map((c) => c.id);
    }

    private reporteSelect() {
        return {
            id: true,
            idChacra: true,
            idMapa: true,
            tipoReporte: true,
            titulo: true,
            resumen: true,
            archivoUrl: true,
            fechaGeneracion: true,
            estado: true,
        } as const;
    }
}
