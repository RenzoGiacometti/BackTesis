import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RoleName } from '../../common/constants/roles.constants';

/**
 * Payload almacenado en el access token JWT.
 * sub         → id_usuario
 * idOrg       → id_organizacion activa
 * idUO        → id_usuario_organizacion (necesario para queries de chacras)
 * rol         → nombre del rol en la org activa
 */
export interface JwtPayload {
    sub: string;
    email: string;
    rol: RoleName;
    idOrg: string;
    idUO: string;
    iat?: number;
    exp?: number;
}

/** Lo que queda disponible como req.user en cada request autenticado.
 *  Es una clase (no interface) para emitir metadata de decoradores con emitDecoratorMetadata. */
export class AuthUser {
    id: string;
    email: string;
    rol: RoleName;
    idOrg: string;
    idUO: string;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
    constructor(private readonly config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.get<string>('JWT_ACCESS_SECRET') as string,
        });
    }

    validate(payload: JwtPayload): AuthUser {
        return {
            id: payload.sub,
            email: payload.email,
            rol: payload.rol,
            idOrg: payload.idOrg,
            idUO: payload.idUO,
        };
    }
}
