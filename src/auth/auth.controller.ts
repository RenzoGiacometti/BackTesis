import {
    Controller,
    Post,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
    Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { ROLES, RoleName } from '../common/constants/roles.constants';
import { AuthUser } from './strategies/jwt-access.strategy';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class RegisterWithRoleDto extends RegisterDto {
    @ApiProperty({ enum: ['admin', 'productor', 'aguador'], example: 'aguador' })
    @IsIn(['admin', 'productor', 'aguador'])
    @IsOptional()
    rol?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    @ApiOperation({ summary: 'Registrar nuevo usuario con su organización (productor por defecto)' })
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('register/admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(ROLES.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Admin: registrar usuario con rol específico en su org' })
    registerWithRole(@Body() dto: RegisterWithRoleDto, @CurrentUser() user: AuthUser) {
        return this.authService.registerInOrg(dto, user.idOrg, (dto.rol as RoleName) ?? ROLES.PRODUCTOR);
    }

    @Post('register/aguador')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(ROLES.PRODUCTOR, ROLES.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'CU01.01 — Productor/Admin agrega aguador a su org' })
    registerAguador(@Body() dto: RegisterDto, @CurrentUser() user: AuthUser) {
        return this.authService.registerInOrg(dto, user.idOrg, ROLES.AGUADOR);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Iniciar sesión — retorna access token + refresh token + contexto de org' })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Renovar access token usando refresh token' })
    refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshTokens(dto.refreshToken);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Cerrar sesión (revoca el refresh token)' })
    logout(@Body() dto: RefreshTokenDto) {
        return this.authService.logout(dto.refreshToken);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Perfil del usuario autenticado' })
    me(@CurrentUser() user: AuthUser) {
        return this.authService.getProfile(user);
    }
}
