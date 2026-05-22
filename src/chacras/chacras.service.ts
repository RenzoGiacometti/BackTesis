import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChacraDto } from './dto/create-chacra.dto';
import { UpdateChacraDto } from './dto/update-chacra.dto';
import { ROLES, RoleName } from '../common/constants/roles.constants';
import { AuthUser } from '../auth/strategies/jwt-access.strategy';

@Injectable()
export class ChacrasService {
    constructor(private readonly prisma: PrismaService) {}

    // ─── Crear chacra (Admin crea en cualquier org, la de su JWT) ──────────
    async create(dto: CreateChacraDto, user: AuthUser) {
        return this.prisma.chacra.create({
            data: {
                nombre: dto.nombre,
                descripcion: dto.descripcion,
                ubicacionTextual: dto.ubicacionTextual,
                superficie: dto.superficie,
                idOrganizacion: user.idOrg,
            },
            select: this.chacraSelect(),
        });
    }

    // ─── Listar chacras según rol ──────────────────────────────────────────
    // Admin: todas las de la org.
    // Productor: todas las de la org (es el dueño).
    // Aguador: solo las que tiene asignadas.
    async findAll(user: AuthUser) {
        const selectAsignaciones = {
            usuariosChacra: {
                where: { estado: 'activo' as const },
                select: {
                    id: true,
                    ...this.asignacionSelect(),
                },
            },
        };

        if (user.rol === ROLES.AGUADOR) {
            // El aguador solo ve chacras que tiene asignadas
            const asignaciones = await this.prisma.usuarioChacra.findMany({
                where: { idUsuarioOrganizacion: user.idUO, estado: 'activo' },
                select: {
                    chacra: {
                        select: {
                            ...this.chacraSelect(),
                            ...selectAsignaciones,
                        },
                    },
                },
            });
            return asignaciones.map((a) => a.chacra);
        }

        // Admin y Productor ven todas las chacras de la org
        return this.prisma.chacra.findMany({
            where: { idOrganizacion: user.idOrg, estado: 'activo' },
            select: {
                ...this.chacraSelect(),
                ...selectAsignaciones,
            },
            orderBy: { fechaAlta: 'desc' },
        });
    }

    // ─── Detalle de una chacra ─────────────────────────────────────────────
    async findOne(id: string, user: AuthUser) {
        const chacra = await this.prisma.chacra.findFirst({
            where: { id, idOrganizacion: user.idOrg },
            select: {
                ...this.chacraSelect(),
                usuariosChacra: {
                    where: { estado: 'activo' },
                    select: {
                        id: true,
                        ...this.asignacionSelect(),
                    },
                },
            },
        });

        if (!chacra) throw new NotFoundException('Chacra no encontrada');

        // Si es aguador, verificar que tiene asignación activa
        if (user.rol === ROLES.AGUADOR) {
            await this.assertAguadorAsignado(id, user.idUO);
        }

        return chacra;
    }

    // ─── Editar chacra (Admin o Productor) ─────────────────────────────────
    async update(id: string, dto: UpdateChacraDto, user: AuthUser) {
        await this.assertChacraEnOrg(id, user.idOrg);

        return this.prisma.chacra.update({
            where: { id },
            data: {
                nombre: dto.nombre,
                descripcion: dto.descripcion,
                ubicacionTextual: dto.ubicacionTextual,
                superficie: dto.superficie,
            },
            select: this.chacraSelect(),
        });
    }

    // ─── Desactivar chacra (soft delete) ───────────────────────────────────
    async deactivate(id: string, user: AuthUser) {
        await this.assertChacraEnOrg(id, user.idOrg);

        return this.prisma.chacra.update({
            where: { id },
            data: { estado: 'inactivo' },
            select: { id: true, nombre: true, estado: true },
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ASIGNACIONES
    // ═══════════════════════════════════════════════════════════════════════

    // ─── Asignar aguador a chacra ──────────────────────────────────────────
    async assignWorker(idChacra: string, idUsuarioOrganizacion: string, user: AuthUser) {
        await this.assertChacraEnOrg(idChacra, user.idOrg);

        // Verificar que la membresía existe, pertenece a la misma org y es aguador
        const membresia = await this.prisma.usuarioOrganizacion.findFirst({
            where: { id: idUsuarioOrganizacion, idOrganizacion: user.idOrg },
            include: { rol: { select: { nombre: true } } },
        });

        if (!membresia) throw new NotFoundException('Membresía no encontrada en esta organización');
        if (membresia.rol.nombre !== ROLES.AGUADOR) {
            throw new ForbiddenException('Solo se pueden asignar usuarios con rol aguador');
        }

        // Verificar si ya existe la asignación (activa o inactiva)
        const existing = await this.prisma.usuarioChacra.findFirst({
            where: { idChacra, idUsuarioOrganizacion },
        });

        if (existing && existing.estado === 'activo') {
            throw new ConflictException('El aguador ya está asignado a esta chacra');
        }

        // Si existía pero inactiva, reactivar
        if (existing) {
            return this.prisma.usuarioChacra.update({
                where: { id: existing.id },
                data: { estado: 'activo' },
                include: this.asignacionInclude(),
            });
        }

        return this.prisma.usuarioChacra.create({
            data: { idChacra, idUsuarioOrganizacion },
            include: this.asignacionInclude(),
        });
    }

    // ─── Listar aguadores asignados a una chacra ───────────────────────────
    async findAssignments(idChacra: string, user: AuthUser) {
        await this.assertChacraEnOrg(idChacra, user.idOrg);

        return this.prisma.usuarioChacra.findMany({
            where: { idChacra, estado: 'activo' },
            include: this.asignacionInclude(),
        });
    }

    // ─── Remover asignación ────────────────────────────────────────────────
    async removeAssignment(idChacra: string, idUsuarioOrganizacion: string, user: AuthUser) {
        await this.assertChacraEnOrg(idChacra, user.idOrg);

        const asignacion = await this.prisma.usuarioChacra.findFirst({
            where: { idChacra, idUsuarioOrganizacion, estado: 'activo' },
        });

        if (!asignacion) throw new NotFoundException('Asignación no encontrada');

        return this.prisma.usuarioChacra.update({
            where: { id: asignacion.id },
            data: { estado: 'inactivo' },
            select: { id: true, estado: true },
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  HELPERS PRIVADOS
    // ═══════════════════════════════════════════════════════════════════════

    /** Verifica que la chacra existe y pertenece a la org del usuario */
    private async assertChacraEnOrg(idChacra: string, idOrg: string) {
        const chacra = await this.prisma.chacra.findFirst({
            where: { id: idChacra, idOrganizacion: idOrg },
        });
        if (!chacra) throw new NotFoundException('Chacra no encontrada');
        return chacra;
    }

    /** Verifica que el aguador tiene asignación activa a la chacra */
    private async assertAguadorAsignado(idChacra: string, idUO: string) {
        const asignacion = await this.prisma.usuarioChacra.findFirst({
            where: { idChacra, idUsuarioOrganizacion: idUO, estado: 'activo' },
        });
        if (!asignacion) throw new ForbiddenException('No tenés asignación a esta chacra');
    }

    /** Select estándar para chacra (sin geometría PostGIS) */
    private chacraSelect() {
        return {
            id: true,
            nombre: true,
            descripcion: true,
            ubicacionTextual: true,
            superficie: true,
            centroLat: true,
            centroLng: true,
            estado: true,
            fechaAlta: true,
            idOrganizacion: true,
        } as const;
    }

    /** Select para mostrar datos del aguador en una asignación (para usar dentro de select) */
    private asignacionSelect() {
        return {
            usuarioOrganizacion: {
                select: {
                    id: true,
                    usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
                    rol: { select: { nombre: true } },
                },
            },
        } as const;
    }

    /** Include para mostrar datos del aguador en una asignación (para usar con include a nivel superior) */
    private asignacionInclude() {
        return {
            usuarioOrganizacion: {
                include: {
                    usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
                    rol: { select: { nombre: true } },
                },
            },
        } as const;
    }
}
