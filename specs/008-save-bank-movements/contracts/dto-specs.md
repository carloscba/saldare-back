# DTO Specifications

**Feature**: 008-save-bank-movements

## CreateMovementDto

```typescript
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
```

Note: `@IsDateString()` validates ISO 8601 format. Additional custom validator (or service-level check) ensures `movementDate <= today` per C-005.

## BatchCreateMovementsDto

```typescript
import { IsArray, IsNotEmpty, IsUUID, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
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
```

## CreateMovementItemDto

```typescript
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMovementItemDto {
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
}
```

Note: No `documentId` on the item — it's set once at the batch level.

## MovementListQueryDto

```typescript
import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MovementListQueryDto {
  @IsUUID('4')
  documentId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

## MovementResponseDto

```typescript
export class MovementResponseDto {
  id: string;
  documentId: string;
  movementDate: string;
  description: string;
  amount: string;       // Prisma.Decimal serialized as string
  category: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

## PaginatedResponseDto

```typescript
export class PaginatedResponseDto<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```
