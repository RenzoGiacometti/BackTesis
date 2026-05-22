import {
    Controller,
    Get,
    Param,
    Patch,
    Body,
    Delete,
    UseGuards,
    ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ROLES, RoleName } from '../common/constants/roles.constants';
import { AuthUser } from '../auth/strategies/jwt-access.strategy';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    /** Lista todos los usuarios activos de la organización (Admin y Productor) */
    @Get()
    @Roles(ROLES.ADMIN, ROLES.PRODUCTOR)
    @ApiOperation({ summary: 'Listar usuarios de la organización (Admin / Productor)' })
    findAll(@CurrentUser() user: AuthUser) {
        // Productor no ve admins en la lista de equipo
        const excludeRoles = user.rol === ROLES.PRODUCTOR ? [ROLES.ADMIN] : [];
        return this.usersService.findAllByOrg(user.idOrg, excludeRoles);
    }

    /** Perfil propio o Admin puede ver cualquier usuario de la misma org */
    @Get(':id')
    @ApiOperation({ summary: 'Obtener usuario por ID' })
    findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        if (user.rol !== ROLES.ADMIN && user.id !== id) {
            throw new ForbiddenException('Sin acceso a este perfil');
        }
        return this.usersService.findOneInOrg(id, user.idOrg);
    }

    /** Admin cambia el rol de un usuario dentro de la organización */
    @Patch(':id/rol')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Cambiar rol de usuario en la organización (Admin)' })
    updateRol(@Param('id') id: string, @Body('rol') rol: string, @CurrentUser() user: AuthUser) {
        return this.usersService.updateRolInOrg(id, user.idOrg, rol as RoleName);
    }

    /** Admin desactiva la membresía de un usuario en la organización */
    @Delete(':id')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Desactivar usuario en la organización (Admin)' })
    deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.usersService.deactivateInOrg(id, user.idOrg);
    }
}
