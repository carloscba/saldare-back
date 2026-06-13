import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseAuthGuard } from '../documents/guards/firebase-auth.guard';
import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { BatchCreateMovementsDto } from './dto/batch-create-movements.dto';
import { MovementListQueryDto } from './dto/movement-list-query.dto';

@Controller('api/movements')
@UseGuards(FirebaseAuthGuard)
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  async findAll(
    @Query(new ValidationPipe({ whitelist: true, transform: true }))
    query: MovementListQueryDto,
    @Req() req: Request,
  ) {
    const user = req['user'] as { uid: string };
    return this.movementsService.findAll(query, user.uid);
  }

  @Post()
  async create(
    @Body(ValidationPipe) dto: CreateMovementDto,
    @Req() req: Request,
  ) {
    const user = req['user'] as { uid: string };
    return this.movementsService.create(dto, user.uid);
  }

  @Post('batch')
  async batchCreate(
    @Body(ValidationPipe) dto: BatchCreateMovementsDto,
    @Req() req: Request,
  ) {
    const user = req['user'] as { uid: string };
    return this.movementsService.batchCreate(dto, user.uid);
  }
}
