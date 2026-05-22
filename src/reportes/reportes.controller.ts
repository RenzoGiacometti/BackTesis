import {
    Controller, Get, Post, Patch, Delete,
    Param, Body, UseGuards, UseInterceptors,
    UploadedFile, Res, Inject, StreamableFile,
    NotFoundException, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ReportesService } from './reportes.service';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { UpdateReporteDto } from './dto/update-reporte.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ROLES } from '../common/constants/roles.constants';
import { AuthUser } from '../auth/strategies/jwt-access.strategy';
import { FILE_STORAGE } from '../files/file-storage.interface';
import type { FileStorage } from '../files/file-storage.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';

@ApiTags('reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reportes')
export class ReportesController {
    constructor(
        private readonly reportesService: ReportesService,
        @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
    ) {}

    @Post()
    @Roles(ROLES.ADMIN, ROLES.PRODUCTOR)
    @ApiOperation({ summary: 'Crear reporte (JSON, sin archivo)' })
    create(@Body() dto: CreateReporteDto, @CurrentUser() user: AuthUser) {
        return this.reportesService.create(dto, user);
    }

    @Post('upload')
    @Roles(ROLES.ADMIN, ROLES.PRODUCTOR)
    @UseInterceptors(FileInterceptor('archivo', {
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
            if (allowed.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Solo se permiten archivos PDF, PNG o JPEG'), false);
            }
        },
    }))
    @ApiOperation({ summary: 'Crear reporte con archivo adjunto (multipart)' })
    @ApiConsumes('multipart/form-data')
    async uploadReporte(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { idChacra: string; tipoReporte: string; titulo: string; resumen?: string; idMapa?: string },
        @CurrentUser() user: AuthUser,
    ) {
        if (!file) {
            throw new BadRequestException('El archivo es obligatorio');
        }

        const archivoUrl = await this.fileStorage.upload(file, 'reportes');

        const dto: CreateReporteDto = {
            idChacra: body.idChacra,
            tipoReporte: body.tipoReporte,
            titulo: body.titulo,
            resumen: body.resumen,
            idMapa: body.idMapa,
            archivoUrl,
        };

        return this.reportesService.create(dto, user);
    }

    @Get(':id/download')
    @ApiOperation({ summary: 'Descargar archivo del reporte (streaming autenticado)' })
    async download(
        @Param('id') id: string,
        @CurrentUser() user: AuthUser,
        @Res({ passthrough: true }) res: Response,
    ) {
        const reporte = await this.reportesService.findOne(id, user);

        if (!reporte.archivoUrl) {
            throw new NotFoundException('Este reporte no tiene archivo adjunto');
        }

        const stream = this.fileStorage.getStream(reporte.archivoUrl);

        const ext = reporte.archivoUrl.split('.').pop() ?? 'pdf';
        const contentType = ext === 'pdf' ? 'application/pdf'
            : ext === 'png' ? 'image/png'
            : ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg'
            : 'application/octet-stream';

        const safeTitle = reporte.titulo.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
        res.set({
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${safeTitle}.${ext}"`,
        });

        return new StreamableFile(stream);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos los reportes accesibles' })
    findAll(@CurrentUser() user: AuthUser) {
        return this.reportesService.findAll(user);
    }

    @Get('chacra/:idChacra')
    @ApiOperation({ summary: 'Listar reportes de una chacra' })
    findByChacra(@Param('idChacra') idChacra: string, @CurrentUser() user: AuthUser) {
        return this.reportesService.findByChacra(idChacra, user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Detalle de un reporte' })
    findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.reportesService.findOne(id, user);
    }

    @Patch(':id')
    @Roles(ROLES.ADMIN, ROLES.PRODUCTOR)
    @ApiOperation({ summary: 'Actualizar reporte' })
    update(@Param('id') id: string, @Body() dto: UpdateReporteDto, @CurrentUser() user: AuthUser) {
        return this.reportesService.update(id, dto, user);
    }

    @Delete(':id')
    @Roles(ROLES.ADMIN)
    @ApiOperation({ summary: 'Archivar reporte' })
    archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
        return this.reportesService.archive(id, user);
    }
}
