import { Module } from '@nestjs/common';
import { FILE_STORAGE } from './file-storage.interface';
import { LocalStorageService } from './local-storage.service';

@Module({
    providers: [
        {
            provide: FILE_STORAGE,
            useClass: LocalStorageService,
        },
    ],
    exports: [FILE_STORAGE],
})
export class FileModule {}
