import { Module } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { FileModule } from '../files/file.module';

@Module({
    imports: [FileModule],
    controllers: [ReportesController],
    providers: [ReportesService],
    exports: [ReportesService],
})
export class ReportesModule {}
