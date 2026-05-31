import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FILE_STORAGE } from './file-storage.interface';
import { LocalStorageService } from './local-storage.service';
import { MinioStorageService } from './minio-storage.service';
import { FilesController } from './files.controller';

@Module({
    imports: [ConfigModule],
    controllers: [FilesController],
    providers: [
        {
            provide: FILE_STORAGE,
            useFactory: async (config: ConfigService) => {
                const backend = config.get<string>('STORAGE_TYPE', 'local');
                if (backend === 'minio') {
                    const service = new MinioStorageService(config);
                    await service.onModuleInit();
                    return service;
                }
                return new LocalStorageService();
            },
            inject: [ConfigService],
        },
    ],
    exports: [FILE_STORAGE],
})
export class FileModule {}
