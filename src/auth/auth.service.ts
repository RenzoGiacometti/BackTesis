import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ROLES, RoleName } from '../common/constants/roles.constants';
import { JwtPayload, AuthUser } from './strategies/jwt-access.strategy';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { StringValue } from 'ms';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
    ) {}

    // ─── Register ─────────────────────────────────────────────────────────────
    // Crea usuario + organización + membresía como productor.
    // MVP: un usuario = una organización.

    async register(dto: RegisterDto, rolNombre: RoleName = ROLES.PRODUCTOR) {
        const existing = await this.prisma.usuario.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException('El email ya está registrado');
        }

        const rol = await this.prisma.rol.findUnique({ where: { nombre: rolNombre } });
        if (!rol) {
            throw new InternalServerErrorException(
                `Rol '${rolNombre}' no encontrado. Ejecutá el seed primero.`,
            );
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        // Transacción: usuario + org + membresía se crean juntos o no se crea nada
        const result = await this.prisma.$transaction(async (tx) => {
            const usuario = await tx.usuario.create({
                data: {
                    email: dto.email,
                    nombre: dto.nombre,
                    apellido: dto.apellido,
                    passwordHash,
                },
            });

            const org = await tx.organizacion.create({
                data: { nombre: dto.nombreOrganizacion ?? `Org de ${dto.nombre} ${dto.apellido}` },
            });

            const usuarioOrg = await tx.usuarioOrganizacion.create({
                data: {
                    idUsuario: usuario.id,
                    idOrganizacion: org.id,
                    idRol: rol.id,
                },
            });

            return { usuario, org, usuarioOrg };
        });

        const tokens = await this.generateTokens(
            result.usuario.id,
            result.usuario.email,
            rolNombre,
            result.org.id,
            result.usuarioOrg.id,
        );

        return {
            usuario: this.sanitizeUsuario(result.usuario),
            organizacion: { id: result.org.id, nombre: result.org.nombre },
            rol: rolNombre,
            ...tokens,
        };
    }

    // ─── Register in existing Org (CU01.01 — Productor agrega Aguador) ──────
    // Crea usuario y lo agrega como aguador a la org del usuario que invoca.
    // No genera tokens (el aguador inicia sesión por su cuenta después).

    async registerInOrg(dto: RegisterDto, idOrg: string, rolNombre: RoleName = ROLES.AGUADOR) {
        const existing = await this.prisma.usuario.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException('El email ya está registrado');
        }

        const rol = await this.prisma.rol.findUnique({ where: { nombre: rolNombre } });
        if (!rol) {
            throw new InternalServerErrorException(
                `Rol '${rolNombre}' no encontrado. Ejecutá el seed primero.`,
            );
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const result = await this.prisma.$transaction(async (tx) => {
            const usuario = await tx.usuario.create({
                data: {
                    email: dto.email,
                    nombre: dto.nombre,
                    apellido: dto.apellido,
                    passwordHash,
                },
            });

            const usuarioOrg = await tx.usuarioOrganizacion.create({
                data: {
                    idUsuario: usuario.id,
                    idOrganizacion: idOrg,
                    idRol: rol.id,
                },
            });

            return { usuario, usuarioOrg };
        });

        return {
            usuario: this.sanitizeUsuario(result.usuario),
            idUsuarioOrganizacion: result.usuarioOrg.id,
            rol: rolNombre,
        };
    }

    // ─── Login ────────────────────────────────────────────────────────────────
    // MVP: el usuario tiene exactamente una organización activa.
    // Cuando se implemente multi-org, este método devolverá la lista de orgs
    // y el cliente llamará a /auth/switch-org para elegir.

    async login(dto: LoginDto) {
        const usuario = await this.prisma.usuario.findUnique({
            where: { email: dto.email },
        });

        if (!usuario || usuario.estado !== 'activo') {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        const passwordValid = await bcrypt.compare(dto.password, usuario.passwordHash);
        if (!passwordValid) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        // Buscar membresía activa (MVP: solo hay una)
        const usuarioOrg = await this.prisma.usuarioOrganizacion.findFirst({
            where: { idUsuario: usuario.id, estado: 'activo' },
            include: {
                organizacion: true,
                rol: true,
            },
        });

        if (!usuarioOrg) {
            throw new UnauthorizedException('El usuario no pertenece a ninguna organización activa');
        }

        const tokens = await this.generateTokens(
            usuario.id,
            usuario.email,
            usuarioOrg.rol.nombre as RoleName,
            usuarioOrg.idOrganizacion,
            usuarioOrg.id,
        );

        return {
            usuario: this.sanitizeUsuario(usuario),
            organizacion: {
                id: usuarioOrg.organizacion.id,
                nombre: usuarioOrg.organizacion.nombre,
            },
            rol: usuarioOrg.rol.nombre,
            ...tokens,
        };
    }

    // ─── Refresh Token ────────────────────────────────────────────────────────

    async refreshTokens(refreshToken: string) {
        let payload: JwtPayload;

        try {
            payload = this.jwtService.verify(refreshToken, {
                secret: this.config.get<string>('JWT_REFRESH_SECRET'),
            });
        } catch {
            throw new UnauthorizedException('Refresh token inválido o expirado');
        }

        const stored = await this.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
        });

        if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
            throw new UnauthorizedException('Refresh token inválido o expirado');
        }

        // Rotación: revocar el anterior, emitir uno nuevo
        await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { isRevoked: true },
        });

        return this.generateTokens(
            payload.sub,
            payload.email,
            payload.rol,
            payload.idOrg,
            payload.idUO,
        );
    }

    // ─── Logout ───────────────────────────────────────────────────────────────

    async logout(refreshToken: string) {
        await this.prisma.refreshToken.updateMany({
            where: { token: refreshToken },
            data: { isRevoked: true },
        });
        return { message: 'Sesión cerrada correctamente' };
    }

    // ─── Profile (para /auth/me) ──────────────────────────────────────────────

    async getProfile(user: AuthUser) {
        const usuarioOrg = await this.prisma.usuarioOrganizacion.findUnique({
            where: { id: user.idUO },
            include: {
                usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
                organizacion: { select: { id: true, nombre: true } },
                rol: { select: { nombre: true } },
            },
        });

        if (!usuarioOrg) {
            throw new UnauthorizedException('Membresía no encontrada');
        }

        return {
            usuario: usuarioOrg.usuario,
            organizacion: usuarioOrg.organizacion,
            rol: usuarioOrg.rol.nombre,
        };
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async generateTokens(
        idUsuario: string,
        email: string,
        rol: RoleName,
        idOrg: string,
        idUO: string,
    ) {
        const payload: JwtPayload = { sub: idUsuario, email, rol, idOrg, idUO };

        const accessExpiration = this.config.get<string>('JWT_ACCESS_EXPIRATION') as StringValue;
        const refreshExpiration = this.config.get<string>('JWT_REFRESH_EXPIRATION') as StringValue;

        const accessToken = this.jwtService.sign(payload, {
            secret: this.config.get<string>('JWT_ACCESS_SECRET'),
            expiresIn: accessExpiration,
        });

        const refreshExpirationDays = 7;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + refreshExpirationDays);

        const refreshToken = this.jwtService.sign(
            { ...payload, jti: randomUUID() },
            {
                secret: this.config.get<string>('JWT_REFRESH_SECRET'),
                expiresIn: refreshExpiration,
            },
        );

        await this.prisma.refreshToken.create({
            data: { token: refreshToken, idUsuario, expiresAt },
        });

        return { accessToken, refreshToken };
    }

    private sanitizeUsuario(usuario: {
        id: string;
        email: string;
        nombre: string;
        apellido: string;
        estado: unknown;
        fechaCreacion: Date;
        passwordHash: string;
    }) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...safe } = usuario;
        return safe;
    }
}
