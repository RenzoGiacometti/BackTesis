import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChacraDto {
    @ApiProperty({ example: 'Parcela Norte' })
    @IsString()
    @IsNotEmpty({ message: 'El nombre es requerido' })
    nombre: string;

    @ApiProperty({
        description: 'UUID del UsuarioOrganizacion del productor dueño. Debe ser un productor activo en la misma organización.',
    })
    @IsUUID()
    @IsNotEmpty({ message: 'Debés asignar un productor a la chacra' })
    idProductor: string;

    @ApiPropertyOptional({ example: 'Chacra principal con riego por goteo' })
    @IsString()
    @IsOptional()
    descripcion?: string;

    @ApiPropertyOptional({ example: 'Ruta 5, km 120, Salto' })
    @IsString()
    @IsOptional()
    ubicacionTextual?: string;

    @ApiPropertyOptional({ example: 150.5, description: 'Superficie en hectáreas' })
    @IsNumber()
    @Min(0)
    @IsOptional()
    superficie?: number;
}
