import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class UpdateReporteDto {
    @IsString()
    @IsOptional()
    @MaxLength(300)
    titulo?: string;

    @IsString()
    @IsOptional()
    resumen?: string;

    @IsString()
    @IsOptional()
    archivoUrl?: string;

    @IsString()
    @IsOptional()
    @IsIn(['borrador', 'generado', 'archivado'])
    estado?: string;
}
