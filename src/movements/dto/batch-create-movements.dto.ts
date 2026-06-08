import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { CreateMovementItemDto } from './create-movement-item.dto';

export class BatchCreateMovementsDto {
  @IsUUID('4')
  @IsNotEmpty()
  documentId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Type(() => CreateMovementItemDto)
  movements: CreateMovementItemDto[];
}
