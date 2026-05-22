import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, UseGuards,
} from '@nestjs/common';
import { CatalogosService } from './catalogos.service';
import { CreateTipoMapaDto, CreateSeveridadDto } from './dto/create-catalogo.dto';
import { UpdateTipoMapaDto, UpdateSeveridadDto } from './dto/update-catalogo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROLES } from '../common/constants/roles.constants';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('catalogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('catalogos')
export class CatalogosController {
    constructor(private readonly catalogosService: CatalogosService) {}

    // ─── TIPOS DE MAPA ──────────────────────────────────────────────────

    @Post('tipos-mapa')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Crear tipo de mapa (NDVI, RGB, etc.)' })
    createTipoMapa(@Body() dto: CreateTipoMapaDto) {
        return this.catalogosService.createTipoMapa(dto);
    }

    @Get('tipos-mapa')
    @ApiOperation({ summary: 'Listar tipos de mapa activos' })
    findAllTiposMapa() {
        return this.catalogosService.findAllTiposMapa();
    }

    @Get('tipos-mapa/:id')
    @ApiOperation({ summary: 'Obtener tipo de mapa por ID' })
    findOneTipoMapa(@Param('id') id: string) {
        return this.catalogosService.findOneTipoMapa(id);
    }

    @Patch('tipos-mapa/:id')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Editar tipo de mapa' })
    updateTipoMapa(@Param('id') id: string, @Body() dto: UpdateTipoMapaDto) {
        return this.catalogosService.updateTipoMapa(id, dto);
    }

    @Delete('tipos-mapa/:id')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Desactivar tipo de mapa' })
    deactivateTipoMapa(@Param('id') id: string) {
        return this.catalogosService.deactivateTipoMapa(id);
    }

    // ─── SEVERIDADES ────────────────────────────────────────────────────

    @Post('severidades')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Crear severidad (baja, media, alta, crítica)' })
    createSeveridad(@Body() dto: CreateSeveridadDto) {
        return this.catalogosService.createSeveridad(dto);
    }

    @Get('severidades')
    @ApiOperation({ summary: 'Listar severidades activas' })
    findAllSeveridades() {
        return this.catalogosService.findAllSeveridades();
    }

    @Get('severidades/:id')
    @ApiOperation({ summary: 'Obtener severidad por ID' })
    findOneSeveridad(@Param('id') id: string) {
        return this.catalogosService.findOneSeveridad(id);
    }

    @Patch('severidades/:id')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Editar severidad' })
    updateSeveridad(@Param('id') id: string, @Body() dto: UpdateSeveridadDto) {
        return this.catalogosService.updateSeveridad(id, dto);
    }

    @Delete('severidades/:id')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Desactivar severidad' })
    deactivateSeveridad(@Param('id') id: string) {
        return this.catalogosService.deactivateSeveridad(id);
    }
}
