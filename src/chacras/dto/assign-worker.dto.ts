import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignWorkerDto {
    @ApiProperty({ description: 'ID del usuario_organizacion del aguador a asignar' })
    @IsUUID('4', { message: 'ID de membresía inválido' })
    @IsNotEmpty()
    idUsuarioOrganizacion: string;
}
