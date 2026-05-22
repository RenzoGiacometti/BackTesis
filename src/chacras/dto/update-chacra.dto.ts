import { PartialType } from '@nestjs/swagger';
import { CreateChacraDto } from './create-chacra.dto';

export class UpdateChacraDto extends PartialType(CreateChacraDto) {}
