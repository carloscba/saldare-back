import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateMovementDto {
  @IsDateString()
  @IsNotEmpty()
  movementDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;

  @IsUUID('4')
  @IsNotEmpty()
  documentId: string;
}
