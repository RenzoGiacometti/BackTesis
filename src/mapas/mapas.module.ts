import { Module } from '@nestjs/common';
import { MapasService } from './mapas.service';
import { MapasController } from './mapas.controller';
import { FileModule } from '../files/file.module';

@Module({
    imports: [FileModule],
    controllers: [MapasController],
    providers: [MapasService],
    exports: [MapasService],
})
export class MapasModule {}
