import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '../common/constants/roles.constants';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    /** Lista usuarios activos de una organización.
     *  Si excludeRoles tiene valores, filtra esos roles del resultado. */
    async findAllByOrg(idOrganizacion: string, excludeRoles: string[] = []) {
        const where: Record<string, unknown> = { idOrganizacion, estado: 'activo' };

        if (excludeRoles.length > 0) {
            where.rol = { nombre: { notIn: excludeRoles } };
        }

        return this.prisma.usuarioOrganizacion.findMany({
            where,
            include: {
                usuario: {
                    select: { id: true, email: true, nombre: true, apellido: true, estado: true, fechaCreacion: true },
                },
                rol: { select: { nombre: true } },
            },
        });
    }

    /** Busca un usuario por ID dentro de una organización */
    async findOneInOrg(idUsuario: string, idOrganizacion: string) {
        const membresia = await this.prisma.usuarioOrganizacion.findFirst({
            where: { idUsuario, idOrganizacion },
            include: {
                usuario: {
                    select: { id: true, email: true, nombre: true, apellido: true, estado: true, fechaCreacion: true },
                },
                rol: { select: { nombre: true } },
            },
        });

        if (!membresia) throw new NotFoundException('Usuario no encontrado en esta organización');
        return membresia;
    }

    /** Cambia el rol de un usuario dentro de la organización (solo Admin) */
    async updateRolInOrg(idUsuario: string, idOrganizacion: string, rolNombre: RoleName) {
        const rol = await this.prisma.rol.findUnique({ where: { nombre: rolNombre } });
        if (!rol) throw new NotFoundException(`Rol '${rolNombre}' no existe`);

        const membresia = await this.prisma.usuarioOrganizacion.findFirst({
            where: { idUsuario, idOrganizacion },
        });

        if (!membresia) throw new NotFoundException('Usuario no encontrado en esta organización');

        return this.prisma.usuarioOrganizacion.update({
            where: { id: membresia.id },
            data: { idRol: rol.id },
            include: {
                usuario: { select: { id: true, email: true, nombre: true, apellido: true } },
                rol: { select: { nombre: true } },
            },
        });
    }

    /** Desactiva la membresía de un usuario en la organización (soft delete) */
    async deactivateInOrg(idUsuario: string, idOrganizacion: string) {
        const membresia = await this.prisma.usuarioOrganizacion.findFirst({
            where: { idUsuario, idOrganizacion },
        });

        if (!membresia) throw new NotFoundException('Usuario no encontrado en esta organización');

        return this.prisma.usuarioOrganizacion.update({
            where: { id: membresia.id },
            data: { estado: 'inactivo' },
            select: { id: true, idUsuario: true, estado: true },
        });
    }
}
