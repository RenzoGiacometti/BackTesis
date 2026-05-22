import { IsNotEmpty, IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateReporteDto {
    @IsUUID()
    @IsNotEmpty()
    idChacra: string;

    @IsUUID()
    @IsOptional()
    idMapa?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    tipoReporte: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(300)
    titulo: string;

    @IsString()
    @IsOptional()
    resumen?: string;

    @IsString()
    @IsOptional()
    archivoUrl?: string;
}
