import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, UseGuards, UseInterceptors,
    UploadedFile, Inject, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MapasService } from './mapas.service';
import { CreateMapaDto } from './dto/create-mapa.dto';
import { UpdateMapaDto } from './dto/update-mapa.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ROLES } from '../common/constants/roles.constants';
import { AuthUser } from '../auth/strategies/jwt-access.strategy';
import { FILE_STORAGE } from '../files/file-storage.interface';
import type { FileStorage } from '../files/file-storage.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';

@ApiTags('mapas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mapas')
export class MapasController {
    constructor(
        private readonly mapasService: MapasService,
        @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
    ) {}

    @Post()
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Crear mapa (JSON, sin archivo)' })
    create(@Body() dto: CreateMapaDto, @CurrentUser() user: AuthUser) {
        return this.mapasService.create(dto, user);
    }

    @Post('upload')
    @Roles(ROLES.ADMIN)
    @UseInterceptors(FileInterceptor('imagen', {
        limits: { fileSize: 20 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const allowed = ['image/png', 'image/jpeg', 'image/tiff'];
            if (allowed.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Solo se permiten imagenes PNG, JPEG o TIFF'), false);
            }
        },
    }))
    @ApiOperation({ summary: 'CU03.03 - Cargar mapa con imagen (multipart)' })
    @ApiConsumes('multipart/form-data')
    async uploadMapa(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: {
            idChacra: string;
            idTipoMapa: string;
            fechaMapa: string;
            swLat: string;
            swLng: string;
            neLat: string;
            neLng: string;
        },
        @CurrentUser() user: AuthUser,
    ) {
        if (!file) {
            throw new BadRequestException('La imagen del mapa es obligatoria');
        }

        const previewUrl = await this.fileStorage.upload(file, 'mapas');

        const bounds = [
            [parseFloat(body.swLat), parseFloat(body.swLng)],
            [parseFloat(body.neLat), parseFloat(body.neLng)],
        ];

        if (bounds.some((b) => b.some((v) => isNaN(v)))) {
            throw new BadRequestException('Las coordenadas de bounds son invalidas');
        }

        const dto: CreateMapaDto = {
            idChacra: body.idChacra,
            idTipoMapa: body.idTipoMapa,
            fechaMapa: body.fechaMapa,
            previewUrl,
        };

        return this.mapasService.createWithMetadata(dto, { bounds }, user);
    }

    @Get('chacra/:idChacra')
    @ApiOperation({ summary: 'CU01.02 / CU02.01 - Listar mapas de una chacra' })
    findByChacra(@Param('idChacra') idChacra: string, @CurrentUser() user: AuthUser) {
        return this.mapasService.findByChacra(idChacra, user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'CU01.07 - Detalle de mapa con puntos de problema' })
    findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.mapasService.findOne(id, user);
    }

    @Patch(':id')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Actualizar mapa (URLs, estado, metadata)' })
    update(@Param('id') id: string, @Body() dto: UpdateMapaDto, @CurrentUser() user: AuthUser) {
        return this.mapasService.update(id, dto, user);
    }

    @Delete(':id')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Archivar mapa' })
    archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.mapasService.archive(id, user);
    }
}
