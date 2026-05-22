import { PartialType } from '@nestjs/swagger';
import { CreateTipoMapaDto, CreateSeveridadDto } from './create-catalogo.dto';

export class UpdateTipoMapaDto extends PartialType(CreateTipoMapaDto) {}
export class UpdateSeveridadDto extends PartialType(CreateSeveridadDto) {}
