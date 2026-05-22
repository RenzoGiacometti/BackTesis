import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMapaDto {
    @ApiPropertyOptional({ description: 'URL base de tiles' })
    @IsString()
    @IsOptional()
    tilesUrlBase?: string;

    @ApiPropertyOptional({ description: 'URL de preview/thumbnail' })
    @IsString()
    @IsOptional()
    previewUrl?: string;

    @ApiPropertyOptional({ description: 'Resumen estadístico (JSON libre)' })
    @IsObject()
    @IsOptional()
    resumenEstadistico?: Record<string, unknown>;

    @ApiPropertyOptional({ description: 'Metadata liviana (JSON libre)' })
    @IsObject()
    @IsOptional()
    metadataLiviana?: Record<string, unknown>;

    @ApiPropertyOptional({ description: 'Referencia externa del procesamiento' })
    @IsString()
    @IsOptional()
    refProcExterna?: string;

    @ApiPropertyOptional({ enum: ['borrador', 'procesando', 'publicado', 'archivado'] })
    @IsEnum(['borrador', 'procesando', 'publicado', 'archivado'] as const)
    @IsOptional()
    estado?: 'borrador' | 'procesando' | 'publicado' | 'archivado';
}
