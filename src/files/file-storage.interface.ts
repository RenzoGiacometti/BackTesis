import { Readable } from 'stream';

export interface FileStorage {
    upload(file: Express.Multer.File, subdir: string): Promise<string>;
    getStream(relativePath: string): Promise<Readable>;
    delete(relativePath: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
