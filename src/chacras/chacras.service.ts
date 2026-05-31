import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
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
        // El productor debe ser una membresía activa de la misma org y con rol productor
        const productor = await this.prisma.usuarioOrganizacion.findFirst({
            where: { id: dto.idProductor, idOrganizacion: user.idOrg, estado: 'activo' },
            include: { rol: { select: { nombre: true } } },
        });

        if (!productor) {
            throw new NotFoundException('Productor no encontrado en esta organización');
        }
        if (productor.rol.nombre !== ROLES.PRODUCTOR) {
            throw new BadRequestException('El usuario asignado debe tener rol productor');
        }

        return this.prisma.chacra.create({
            data: {
                nombre: dto.nombre,
                descripcion: dto.descripcion,
                ubicacionTextual: dto.ubicacionTextual,
                superficie: dto.superficie,
                idOrganizacion: user.idOrg,
                idProductor: dto.idProductor,
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

        const selectUltimoMapa = {
            mapas: {
                where: { estado: 'publicado' as const },
                orderBy: [{ fechaMapa: 'desc' as const }, { fechaGeneracion: 'desc' as const }],
                take: 1,
                select: {
                    id: true,
                    previewUrl: true,
                    fechaMapa: true,
                    tipoMapa: { select: { id: true, nombre: true } },
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
                            ...selectUltimoMapa,
                        },
                    },
                },
            });
            return asignaciones.map((a) => a.chacra);
        }

        // Productor: solo las chacras donde figura como dueño.
        // Admin: todas las chacras de su organización.
        const baseWhere = {
            idOrganizacion: user.idOrg,
            estado: 'activo' as const,
            ...(user.rol === ROLES.PRODUCTOR ? { idProductor: user.idUO } : {}),
        };

        return this.prisma.chacra.findMany({
            where: baseWhere,
            select: {
                ...this.chacraSelect(),
                ...selectAsignaciones,
                ...selectUltimoMapa,
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

        // Aguador: tiene que estar asignado a la chacra.
        // Productor: tiene que ser el dueño.
        if (user.rol === ROLES.AGUADOR) {
            await this.assertAguadorAsignado(id, user.idUO);
        } else if (user.rol === ROLES.PRODUCTOR && chacra.idProductor !== user.idUO) {
            throw new ForbiddenException('No tenés acceso a esta chacra');
        }

        return chacra;
    }

    // ─── Editar chacra (Admin o Productor dueño) ───────────────────────────
    async update(id: string, dto: UpdateChacraDto, user: AuthUser) {
        await this.assertChacraAccesible(id, user);

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
        await this.assertChacraAccesible(id, user);

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
        await this.assertChacraAccesible(idChacra, user);

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
        await this.assertChacraAccesible(idChacra, user);

        return this.prisma.usuarioChacra.findMany({
            where: { idChacra, estado: 'activo' },
            include: this.asignacionInclude(),
        });
    }

    // ─── Remover asignación ────────────────────────────────────────────────
    async removeAssignment(idChacra: string, idUsuarioOrganizacion: string, user: AuthUser) {
        await this.assertChacraAccesible(idChacra, user);

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

    /** Como assertChacraEnOrg pero además, si el user es PRODUCTOR, exige
     *  que sea el dueño de la chacra. Admin puede acceder a todas. */
    private async assertChacraAccesible(idChacra: string, user: AuthUser) {
        const chacra = await this.assertChacraEnOrg(idChacra, user.idOrg);
        if (user.rol === ROLES.PRODUCTOR && chacra.idProductor !== user.idUO) {
            throw new ForbiddenException('No tenés acceso a esta chacra');
        }
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
            idProductor: true,
            productor: {
                select: {
                    id: true,
                    usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
                },
            },
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
