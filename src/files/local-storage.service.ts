import { Injectable, BadRequestException } from '@nestjs/common';
import { FileStorage } from './file-storage.interface';
import { createReadStream, ReadStream } from 'fs';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { join, resolve, extname } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class LocalStorageService implements FileStorage {
    private readonly uploadsRoot = resolve(process.cwd(), 'uploads');

    async upload(file: Express.Multer.File, subdir: string): Promise<string> {
        const dir = join(this.uploadsRoot, subdir);
        await mkdir(dir, { recursive: true });

        const ext = extname(file.originalname) || '.bin';
        const filename = `${randomUUID()}${ext}`;
        const filePath = join(dir, filename);

        await writeFile(filePath, file.buffer);

        return `/uploads/${subdir}/${filename}`;
    }

    getStream(relativePath: string): ReadStream {
        const fullPath = this.resolveSafe(relativePath);
        return createReadStream(fullPath);
    }

    async delete(relativePath: string): Promise<void> {
        try {
            const fullPath = this.resolveSafe(relativePath);
            await unlink(fullPath);
        } catch (err: any) {
            if (err.code !== 'ENOENT') throw err;
        }
    }

    /** Resolve path and prevent directory traversal */
    private resolveSafe(relativePath: string): string {
        const cleaned = relativePath.replace(/^\/uploads\/?/, '');
        const fullPath = resolve(this.uploadsRoot, cleaned);

        if (!fullPath.startsWith(this.uploadsRoot)) {
            throw new BadRequestException('Ruta de archivo invalida');
        }

        return fullPath;
    }
}
