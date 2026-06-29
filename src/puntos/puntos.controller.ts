import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, UseGuards, UseInterceptors,
    UploadedFile, Inject, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PuntosService } from './puntos.service';
import { CreatePuntoDto } from './dto/create-punto.dto';
import { UpdatePuntoDto, UpdatePuntoEstadoDto } from './dto/update-punto.dto';
import { CreateComentarioDto } from './dto/create-comentario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ROLES } from '../common/constants/roles.constants';
import { AuthUser } from '../auth/strategies/jwt-access.strategy';
import { FILE_STORAGE } from '../files/file-storage.interface';
import type { FileStorage } from '../files/file-storage.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';

@ApiTags('puntos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('puntos')
export class PuntosController {
    constructor(
        private readonly puntosService: PuntosService,
        @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
    ) {}

    // ─── PUNTOS DE PROBLEMA ─────────────────────────────────────────────

    @Post()
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'CU01.03 — Crear punto de problema en un mapa' })
    create(@Body() dto: CreatePuntoDto, @CurrentUser() user: AuthUser) {
        return this.puntosService.create(dto, user);
    }

    @Get('mapa/:idMapa')
    @ApiOperation({ summary: 'Listar puntos de problema de un mapa' })
    findByMapa(@Param('idMapa') idMapa: string, @CurrentUser() user: AuthUser) {
        return this.puntosService.findByMapa(idMapa, user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Detalle de punto con comentarios e historial' })
    findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.puntosService.findOne(id, user);
    }

    @Patch(':id')
    @Roles(ROLES.ADMIN, ROLES.PRODUCTOR)
    @ApiOperation({ summary: 'Editar punto (descripción, severidad)' })
    update(@Param('id') id: string, @Body() dto: UpdatePuntoDto, @CurrentUser() user: AuthUser) {
        return this.puntosService.update(id, dto, user);
    }

    @Patch(':id/estado')
    @ApiOperation({ summary: 'CU02.02 / CU02.03 — Cambiar estado del punto (con historial)' })
    changeEstado(
        @Param('id') id: string,
        @Body() dto: UpdatePuntoEstadoDto,
        @CurrentUser() user: AuthUser,
    ) {
        return this.puntosService.changeEstado(id, dto, user);
    }

    // ─── COMENTARIOS ────────────────────────────────────────────────────

    @Post(':id/comentarios')
    @ApiOperation({ summary: 'CU02.03 — Agregar comentario a un punto' })
    createComentario(
        @Param('id') id: string,
        @Body() dto: CreateComentarioDto,
        @CurrentUser() user: AuthUser,
    ) {
        return this.puntosService.createComentario(id, dto, user);
    }

    @Post(':id/comentarios/upload')
    @UseInterceptors(FileInterceptor('imagen', {
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const allowed = ['image/png', 'image/jpeg', 'image/webp'];
            if (allowed.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Solo se permiten imágenes PNG, JPEG o WEBP'), false);
            }
        },
    }))
    @ApiOperation({ summary: 'CU02.03 — Agregar comentario con imagen adjunta (multipart)' })
    @ApiConsumes('multipart/form-data')
    async createComentarioConImagen(
        @Param('id') id: string,
        @UploadedFile() imagen: Express.Multer.File | undefined,
        @Body() body: { texto: string },
        @CurrentUser() user: AuthUser,
    ) {
        if (!body?.texto || !body.texto.trim()) {
            throw new BadRequestException('El texto del comentario es obligatorio');
        }
        if (!imagen) {
            throw new BadRequestException('La imagen es obligatoria en este endpoint; usá /comentarios para solo texto');
        }

        const imagenUrl = await this.fileStorage.upload(imagen, 'comentarios');
        return this.puntosService.createComentario(id, { texto: body.texto, imagenUrl }, user);
    }

    @Get(':id/comentarios')
    @ApiOperation({ summary: 'Listar comentarios de un punto' })
    findComentarios(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.puntosService.findComentarios(id, user);
    }

    @Delete('comentarios/:idComentario')
    @ApiOperation({ summary: 'Desactivar comentario (autor o admin)' })
    deleteComentario(
        @Param('idComentario') idComentario: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.puntosService.deleteComentario(idComentario, user);
    }
}
