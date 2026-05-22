import { Module } from '@nestjs/common';
import { PuntosService } from './puntos.service';
import { PuntosController } from './puntos.controller';

@Module({
    controllers: [PuntosController],
    providers: [PuntosService],
    exports: [PuntosService],
})
export class PuntosModule {}
