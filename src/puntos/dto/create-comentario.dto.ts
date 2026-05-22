import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateComentarioDto {
    @ApiProperty({ example: 'Revisé la zona, el canal estaba obstruido.' })
    @IsString()
    @IsNotEmpty()
    texto: string;

    @ApiPropertyOptional({ description: 'URL de imagen en S3 (se llena vía upload separado)' })
    @IsString()
    @IsOptional()
    imagenUrl?: string;
}
