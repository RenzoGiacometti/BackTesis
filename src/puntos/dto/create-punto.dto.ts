import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePuntoDto {
    @ApiProperty({ description: 'UUID del mapa publicado' })
    @IsUUID()
    @IsNotEmpty()
    idMapa: string;

    @ApiProperty({ example: -58.31, description: 'Longitud (X)' })
    @IsNumber()
    coordenadaX: number;

    @ApiProperty({ example: -31.42, description: 'Latitud (Y)' })
    @IsNumber()
    coordenadaY: number;

    @ApiProperty({ description: 'UUID de la severidad (catálogo)' })
    @IsUUID()
    @IsNotEmpty()
    idSeveridad: string;

    @ApiPropertyOptional({ example: 'Posible plaga detectada en sector noreste' })
    @IsString()
    @IsOptional()
    descripcion?: string;
}
