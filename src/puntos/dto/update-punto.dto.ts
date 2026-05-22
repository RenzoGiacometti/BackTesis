import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const ESTADOS_PUNTO = ['pendiente', 'en_revision', 'resuelto', 'descartado'] as const;

export class UpdatePuntoEstadoDto {
    @ApiPropertyOptional({ enum: ESTADOS_PUNTO })
    @IsEnum(ESTADOS_PUNTO)
    estado: (typeof ESTADOS_PUNTO)[number];

    @ApiPropertyOptional({ description: 'Observación del cambio de estado' })
    @IsString()
    @IsOptional()
    observacion?: string;
}

export class UpdatePuntoDto {
    @ApiPropertyOptional({ description: 'UUID de la severidad' })
    @IsUUID()
    @IsOptional()
    idSeveridad?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    descripcion?: string;
}
