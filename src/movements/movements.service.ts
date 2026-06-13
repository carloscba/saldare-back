import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Movement } from '@prisma/client';
import { CreateMovementDto } from './dto/create-movement.dto';
import { BatchCreateMovementsDto } from './dto/batch-create-movements.dto';
import { MovementListQueryDto } from './dto/movement-list-query.dto';
import { MovementResponseDto } from './dto/movement-response.dto';
import { PaginatedResponseDto } from './dto/paginated-response.dto';

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateMovementDto,
    userId: string,
  ): Promise<MovementResponseDto> {
    const doc = await this.prisma.document.findUnique({
      where: { id: dto.documentId },
    });
    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    if (doc.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Only COMPLETED documents can accept movements',
      );
    }

    const membership = await this.prisma.companyMembership.findFirst({
      where: { userId, companyId: doc.companyId, deletedAt: null },
    });
    if (!membership) {
      throw new ForbiddenException('Document not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const movementDate = new Date(dto.movementDate);
    if (movementDate > today) {
      throw new BadRequestException('Movement date cannot be in the future');
    }

    const movement = await this.prisma.movement.create({
      data: {
        documentId: dto.documentId,
        movementDate: new Date(dto.movementDate),
        description: dto.description,
        amount: dto.amount,
        category: dto.category,
      },
    });

    return this.toResponseDto(movement);
  }

  async findAll(
    query: MovementListQueryDto,
    userId: string,
  ): Promise<PaginatedResponseDto<MovementResponseDto>> {
    const doc = await this.prisma.document.findUnique({
      where: { id: query.documentId },
    });
    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    const membership = await this.prisma.companyMembership.findFirst({
      where: { userId, companyId: doc.companyId, deletedAt: null },
    });
    if (!membership) {
      throw new ForbiddenException('Document not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { documentId: query.documentId, deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.movement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { movementDate: 'desc' },
      }),
      this.prisma.movement.count({ where }),
    ]);

    return {
      items: items.map((m) => this.toResponseDto(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async batchCreate(
    dto: BatchCreateMovementsDto,
    userId: string,
  ): Promise<MovementResponseDto[]> {
    const doc = await this.prisma.document.findUnique({
      where: { id: dto.documentId },
    });
    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    if (doc.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Only COMPLETED documents can accept movements',
      );
    }

    const membership = await this.prisma.companyMembership.findFirst({
      where: { userId, companyId: doc.companyId, deletedAt: null },
    });
    if (!membership) {
      throw new ForbiddenException('Document not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const item of dto.movements) {
      const movementDate = new Date(item.movementDate);
      if (movementDate > today) {
        throw new BadRequestException(
          `Movement date cannot be in the future: ${item.movementDate}`,
        );
      }
    }

    const movements = await this.prisma.$transaction(
      dto.movements.map((item) =>
        this.prisma.movement.create({
          data: {
            documentId: dto.documentId,
            movementDate: new Date(item.movementDate),
            description: item.description,
            amount: item.amount,
            category: item.category,
          },
        }),
      ),
    );

    return movements.map((m) => this.toResponseDto(m));
  }

  private toResponseDto(movement: Movement): MovementResponseDto {
    return {
      id: movement.id,
      documentId: movement.documentId,
      movementDate: movement.movementDate.toISOString().split('T')[0],
      description: movement.description,
      amount: movement.amount.toString(),
      category: movement.category,
      createdAt: movement.createdAt.toISOString(),
      updatedAt: movement.updatedAt.toISOString(),
      deletedAt: movement.deletedAt?.toISOString() ?? null,
    };
  }
}
