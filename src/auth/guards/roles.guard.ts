import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '../../common/constants/roles.constants';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../strategies/jwt-access.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Sin @Roles() → solo requiere autenticación (JwtAuthGuard)
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const user = context.switchToHttp().getRequest().user as AuthUser;

        if (!requiredRoles.includes(user?.rol)) {
            throw new ForbiddenException('No tenés permisos para acceder a este recurso');
        }

        return true;
    }
}
