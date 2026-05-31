import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, UseGuards, UseInterceptors,
    UploadedFiles, Inject, BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
    @UseInterceptors(FileFieldsInterceptor(
        [
            { name: 'imagen', maxCount: 1 },
            { name: 'mapOutput', maxCount: 1 },
        ],
        {
            limits: { fileSize: 20 * 1024 * 1024 },
            fileFilter: (_req, file, cb) => {
                if (file.fieldname === 'imagen') {
                    const allowed = ['image/png', 'image/jpeg', 'image/tiff'];
                    if (allowed.includes(file.mimetype)) {
                        cb(null, true);
                    } else {
                        cb(new BadRequestException('Solo se permiten imagenes PNG, JPEG o TIFF'), false);
                    }
                    return;
                }
                if (file.fieldname === 'mapOutput') {
                    const allowed = ['application/json', 'text/json', 'application/octet-stream'];
                    if (allowed.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.json')) {
                        cb(null, true);
                    } else {
                        cb(new BadRequestException('mapOutput debe ser un archivo JSON'), false);
                    }
                    return;
                }
                cb(new BadRequestException(`Campo no soportado: ${file.fieldname}`), false);
            },
        },
    ))
    @ApiOperation({ summary: 'CU03.03 - Cargar mapa con imagen (multipart). Opcional: adjuntar map_output.json para autocompletar bounds y zonas.' })
    @ApiConsumes('multipart/form-data')
    async uploadMapa(
        @UploadedFiles() files: { imagen?: Express.Multer.File[]; mapOutput?: Express.Multer.File[] },
        @Body() body: {
            idChacra: string;
            idTipoMapa: string;
            fechaMapa: string;
            swLat?: string;
            swLng?: string;
            neLat?: string;
            neLng?: string;
            minAreaM2?: string;
            clusterDistanceM?: string;
        },
        @CurrentUser() user: AuthUser,
    ) {
        const imagen = files?.imagen?.[0];
        const mapOutputFile = files?.mapOutput?.[0];

        if (!imagen) {
            throw new BadRequestException('La imagen del mapa es obligatoria');
        }

        const metadataLiviana = mapOutputFile
            ? this.parseMapOutput(mapOutputFile)
            : this.buildMetadataFromBody(body);

        const previewUrl = await this.fileStorage.upload(imagen, 'mapas');

        const dto: CreateMapaDto = {
            idChacra: body.idChacra,
            idTipoMapa: body.idTipoMapa,
            fechaMapa: body.fechaMapa,
            previewUrl,
        };

        const puntosConfig = this.parsePuntosConfig(body);

        return this.mapasService.createWithMetadata(dto, metadataLiviana, user, puntosConfig);
    }

    /** Lee minAreaM2 y clusterDistanceM del multipart body, valida que sean
     *  numéricos no negativos. Valores ausentes o vacíos quedan undefined
     *  (el service los interpreta como "sin filtro / sin clustering"). */
    private parsePuntosConfig(body: {
        minAreaM2?: string;
        clusterDistanceM?: string;
    }): { minAreaM2?: number; clusterDistanceM?: number } {
        const config: { minAreaM2?: number; clusterDistanceM?: number } = {};

        if (body.minAreaM2 !== undefined && body.minAreaM2 !== '') {
            const value = Number(body.minAreaM2);
            if (!Number.isFinite(value) || value < 0) {
                throw new BadRequestException('minAreaM2 debe ser un número >= 0');
            }
            config.minAreaM2 = value;
        }

        if (body.clusterDistanceM !== undefined && body.clusterDistanceM !== '') {
            const value = Number(body.clusterDistanceM);
            if (!Number.isFinite(value) || value < 0) {
                throw new BadRequestException('clusterDistanceM debe ser un número >= 0');
            }
            config.clusterDistanceM = value;
        }

        return config;
    }

    /** Parsea el map_output.json del backend Python y construye metadataLiviana */
    private parseMapOutput(file: Express.Multer.File): {
        bounds: [[number, number], [number, number]];
        zones?: unknown[];
    } {
        let parsed: unknown;
        try {
            parsed = JSON.parse(file.buffer.toString('utf-8'));
        } catch {
            throw new BadRequestException('map_output.json no es un JSON valido');
        }

        if (!parsed || typeof parsed !== 'object') {
            throw new BadRequestException('map_output.json no tiene estructura valida');
        }
        const data = parsed as Record<string, unknown>;

        const b = data.bounds as Record<string, unknown> | undefined;
        if (!b || typeof b !== 'object') {
            throw new BadRequestException('map_output.json no contiene "bounds"');
        }
        const { north, south, east, west } = b as { north: unknown; south: unknown; east: unknown; west: unknown };
        const nums = [north, south, east, west].map((v) => Number(v));
        if (nums.some((n) => Number.isNaN(n))) {
            throw new BadRequestException('bounds.{north,south,east,west} deben ser numericos');
        }
        const [n, s, e, w] = nums;

        const bounds: [[number, number], [number, number]] = [
            [s, w],
            [n, e],
        ];

        const rawZones = Array.isArray(data.zones) ? data.zones : [];
        const zones = rawZones
            .map((z) => this.normalizeZone(z))
            .filter((z): z is NonNullable<typeof z> => z !== null);

        return zones.length > 0 ? { bounds, zones } : { bounds };
    }

    /** Normaliza una zona del map_output.json al shape que consume el front */
    private normalizeZone(raw: unknown): {
        id: number;
        type: string;
        polygon: unknown;
        lat: number;
        lng: number;
        area_m2: number;
        mean_depth_cm: number;
    } | null {
        if (!raw || typeof raw !== 'object') return null;
        const z = raw as Record<string, unknown>;
        const polygon = z.polygon;
        if (!polygon || typeof polygon !== 'object') return null;

        const id = Number(z.id);
        const lat = Number(z.lat);
        const lng = Number(z.lng);
        const area = Number(z.area_m2);
        const depth = Number(z.mean_depth_cm);
        const type = typeof z.type === 'string' ? z.type : '';
        if (Number.isNaN(id) || Number.isNaN(lat) || Number.isNaN(lng) || !type) return null;

        return {
            id,
            type,
            polygon,
            lat,
            lng,
            area_m2: Number.isFinite(area) ? area : 0,
            mean_depth_cm: Number.isFinite(depth) ? depth : 0,
        };
    }

    /** Construye metadataLiviana desde los 4 bounds del body (flujo legacy) */
    private buildMetadataFromBody(body: {
        swLat?: string;
        swLng?: string;
        neLat?: string;
        neLng?: string;
    }): { bounds: [[number, number], [number, number]] } {
        if (!body.swLat || !body.swLng || !body.neLat || !body.neLng) {
            throw new BadRequestException(
                'Tenes que adjuntar map_output.json o ingresar swLat/swLng/neLat/neLng',
            );
        }
        const swLat = parseFloat(body.swLat);
        const swLng = parseFloat(body.swLng);
        const neLat = parseFloat(body.neLat);
        const neLng = parseFloat(body.neLng);
        if ([swLat, swLng, neLat, neLng].some((v) => Number.isNaN(v))) {
            throw new BadRequestException('Las coordenadas de bounds son invalidas');
        }
        return { bounds: [[swLat, swLng], [neLat, neLng]] };
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
