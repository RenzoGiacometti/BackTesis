import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @IsEmail({}, { message: 'Email inválido' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'La contraseña es requerida' })
    password: string;
}
