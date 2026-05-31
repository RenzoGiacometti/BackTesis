import {
    Controller, Get, Param, Res, Inject,
    NotFoundException, BadRequestException,
    StreamableFile, HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FILE_STORAGE } from './file-storage.interface';
import type { FileStorage } from './file-storage.interface';
import { extname } from 'path';

const MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
};

const SAFE_SEGMENT = /^[a-zA-Z0-9_\-]+$/;

@Controller('uploads')
export class FilesController {
    constructor(
        @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
    ) {}

    @Get(':subdir/:filename')
    async serve(
        @Param('subdir') subdir: string,
        @Param('filename') filename: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        if (!SAFE_SEGMENT.test(subdir)) {
            throw new BadRequestException('Subdirectorio invalido');
        }

        const relativePath = `/uploads/${subdir}/${filename}`;

        let stream;
        try {
            stream = await this.fileStorage.getStream(relativePath);
        } catch (err) {
            if (err instanceof HttpException) throw err;
            throw new NotFoundException('Archivo no encontrado');
        }

        const ext = extname(filename).toLowerCase();
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

        res.set({ 'Content-Type': contentType });

        return new StreamableFile(stream);
    }
}
