import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ example: 'juan@pluvia.com' })
    @IsEmail({}, { message: 'Email inválido' })
    email: string;

    @ApiProperty({ example: 'Juan' })
    @IsString()
    @IsNotEmpty({ message: 'El nombre es requerido' })
    nombre: string;

    @ApiProperty({ example: 'García' })
    @IsString()
    @IsNotEmpty({ message: 'El apellido es requerido' })
    apellido: string;

    @ApiProperty({ example: 'Password1234!' })
    @IsString()
    @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    password: string;

    @ApiPropertyOptional({ example: 'Estancia La Pampa' })
    @IsString()
    @IsOptional()
    nombreOrganizacion?: string;
}
