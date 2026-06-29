import { Module } from '@nestjs/common';
import { PuntosService } from './puntos.service';
import { PuntosController } from './puntos.controller';
import { FileModule } from '../files/file.module';

@Module({
    imports: [FileModule],
    controllers: [PuntosController],
    providers: [PuntosService],
    exports: [PuntosService],
})
export class PuntosModule {}
