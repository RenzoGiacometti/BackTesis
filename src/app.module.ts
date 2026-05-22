import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChacrasModule } from './chacras/chacras.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { MapasModule } from './mapas/mapas.module';
import { PuntosModule } from './puntos/puntos.module';
import { ReportesModule } from './reportes/reportes.module';
import { FileModule } from './files/file.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ChacrasModule,
    CatalogosModule,
    MapasModule,
    PuntosModule,
    ReportesModule,
    FileModule,
  ],
})
export class AppModule {}
