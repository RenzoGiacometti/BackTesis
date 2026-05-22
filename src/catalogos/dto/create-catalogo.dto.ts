import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTipoMapaDto {
    @ApiProperty({ example: 'NDVI' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiPropertyOptional({ example: 'Índice de vegetación de diferencia normalizada' })
    @IsString()
    @IsOptional()
    descripcion?: string;
}

export class CreateSeveridadDto {
    @ApiProperty({ example: 'crítica' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ example: 4, description: 'Nivel numérico (mayor = más grave)' })
    @IsInt()
    @Min(1)
    nivel: number;

    @ApiPropertyOptional({ example: 'Requiere atención inmediata' })
    @IsString()
    @IsOptional()
    descripcion?: string;
}
