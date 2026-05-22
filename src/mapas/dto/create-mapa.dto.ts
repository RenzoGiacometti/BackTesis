import { IsString, IsNotEmpty, IsOptional, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMapaDto {
    @ApiProperty({ description: 'UUID de la chacra' })
    @IsUUID()
    @IsNotEmpty()
    idChacra: string;

    @ApiProperty({ description: 'UUID del tipo de mapa (catálogo)' })
    @IsUUID()
    @IsNotEmpty()
    idTipoMapa: string;

    @ApiProperty({ example: '2026-03-10', description: 'Fecha del relevamiento (YYYY-MM-DD)' })
    @IsDateString()
    @IsNotEmpty()
    fechaMapa: string;

    @ApiPropertyOptional({ description: 'URL base de tiles (se llena tras procesamiento)' })
    @IsString()
    @IsOptional()
    tilesUrlBase?: string;

    @ApiPropertyOptional({ description: 'URL de preview/thumbnail' })
    @IsString()
    @IsOptional()
    previewUrl?: string;

    @ApiPropertyOptional({ description: 'Referencia externa del procesamiento' })
    @IsString()
    @IsOptional()
    refProcExterna?: string;
}
