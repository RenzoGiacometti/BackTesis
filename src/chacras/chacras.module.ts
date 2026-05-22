import { Module } from '@nestjs/common';
import { ChacrasService } from './chacras.service';
import { ChacrasController } from './chacras.controller';

@Module({
    controllers: [ChacrasController],
    providers: [ChacrasService],
    exports: [ChacrasService],
})
export class ChacrasModule {}
