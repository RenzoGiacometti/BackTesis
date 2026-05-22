import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    UseGuards,
} from '@nestjs/common';
import { ChacrasService } from './chacras.service';
import { CreateChacraDto } from './dto/create-chacra.dto';
import { UpdateChacraDto } from './dto/update-chacra.dto';
import { AssignWorkerDto } from './dto/assign-worker.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ROLES } from '../common/constants/roles.constants';
import { AuthUser } from '../auth/strategies/jwt-access.strategy';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('chacras')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chacras')
export class ChacrasController {
    constructor(private readonly chacrasService: ChacrasService) {}

    // ─── CRUD ──────────────────────────────────────────────────────────────

    @Post()
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'CU03.01 — Crear chacra (Admin)' })
    create(@Body() dto: CreateChacraDto, @CurrentUser() user: AuthUser) {
        return this.chacrasService.create(dto, user);
    }

    @Get()
    @ApiOperation({ summary: 'Listar chacras según rol (Admin/Productor: todas, Aguador: asignadas)' })
    findAll(@CurrentUser() user: AuthUser) {
        return this.chacrasService.findAll(user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'CU01.02 / CU02.01 — Detalle de chacra con aguadores asignados' })
    findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.chacrasService.findOne(id, user);
    }

    @Patch(':id')
    @Roles(ROLES.ADMIN, ROLES.PRODUCTOR)
    @ApiOperation({ summary: 'CU03.06 — Modificar datos de chacra' })
    update(@Param('id') id: string, @Body() dto: UpdateChacraDto, @CurrentUser() user: AuthUser) {
        return this.chacrasService.update(id, dto, user);
    }

    @Delete(':id')
    @Roles(ROLES.ADMIN, ROLES.PRODUCTOR)
    @ApiOperation({ summary: 'Desactivar chacra (soft delete)' })
    deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.chacrasService.deactivate(id, user);
    }

    // ─── ASIGNACIONES ──────────────────────────────────────────────────────

    @Post(':id/asignaciones')
    @Roles(ROLES.ADMIN, ROLES.PRODUCTOR)
    @ApiOperation({ summary: 'CU01.06 — Asignar aguador a chacra' })
    assignWorker(
        @Param('id') id: string,
        @Body() dto: AssignWorkerDto,
        @CurrentUser() user: AuthUser,
    ) {
        return this.chacrasService.assignWorker(id, dto.idUsuarioOrganizacion, user);
    }

    @Get(':id/asignaciones')
    @Roles(ROLES.ADMIN, ROLES.PRODUCTOR)
    @ApiOperation({ summary: 'Listar aguadores asignados a una chacra' })
    findAssignments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.chacrasService.findAssignments(id, user);
    }

    @Delete(':id/asignaciones/:idUO')
    @Roles(ROLES.ADMIN, ROLES.PRODUCTOR)
    @ApiOperation({ summary: 'Remover asignación de aguador' })
    removeAssignment(
        @Param('id') id: string,
        @Param('idUO') idUO: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.chacrasService.removeAssignment(id, idUO, user);
    }
}
