import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MovementsService } from './movements.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';

describe('MovementsService', () => {
  let service: MovementsService;
  let prisma: PrismaService;

  const mockDocument = {
    id: 'doc-001',
    companyId: 'company-001',
    status: 'COMPLETED',
    deletedAt: null,
  };

  const mockMovement = {
    id: 'mov-001',
    documentId: 'doc-001',
    movementDate: new Date('2026-06-01'),
    description: 'Test movement',
    amount: { toString: () => '100.50' },
    category: 'Groceries',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            document: {
              findUnique: jest.fn(),
            },
            companyMembership: {
              findFirst: jest.fn(),
            },
            movement: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MovementsService>(MovementsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    const dto: CreateMovementDto = {
      documentId: 'doc-001',
      movementDate: '2026-06-01',
      description: 'Test movement',
      amount: 100.5,
      category: 'Groceries',
    };

    it('should create a movement successfully', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.companyMembership.findFirst as jest.Mock).mockResolvedValue({
        id: 'mem-001',
        userId: 'user-001',
        companyId: 'company-001',
        deletedAt: null,
      });
      (prisma.movement.create as jest.Mock).mockResolvedValue(mockMovement);

      const result = await service.create(dto, 'user-001');

      expect(result).toBeDefined();
      expect(result.id).toBe('mov-001');
      expect(result.documentId).toBe('doc-001');
      expect(result.amount).toBe('100.50');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.movement.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when document not found', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create(dto, 'user-001')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when document is soft-deleted', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        ...mockDocument,
        deletedAt: new Date(),
      });

      await expect(service.create(dto, 'user-001')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when document is not COMPLETED', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        ...mockDocument,
        status: 'PENDING',
      });

      await expect(service.create(dto, 'user-001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for future movementDate', async () => {
      const futureDto = {
        ...dto,
        movementDate: '2099-12-31',
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.companyMembership.findFirst as jest.Mock).mockResolvedValue({
        id: 'mem-001',
        userId: 'user-001',
        companyId: 'company-001',
        deletedAt: null,
      });

      await expect(service.create(futureDto, 'user-001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException when user is not a company member', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.companyMembership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(dto, 'user-001')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    const mockMovements = [
      mockMovement,
      {
        ...mockMovement,
        id: 'mov-002',
        movementDate: new Date('2026-05-15'),
        amount: { toString: () => '200.00' },
      },
    ];

    it('should return paginated movements for a document', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.companyMembership.findFirst as jest.Mock).mockResolvedValue({
        id: 'mem-001',
        userId: 'user-001',
        companyId: 'company-001',
        deletedAt: null,
      });
      (prisma.movement.findMany as jest.Mock).mockResolvedValue(mockMovements);
      (prisma.movement.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findAll(
        { documentId: 'doc-001', page: 1, limit: 20 },
        'user-001',
      );

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should return empty list when no movements exist', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.companyMembership.findFirst as jest.Mock).mockResolvedValue({
        id: 'mem-001',
        userId: 'user-001',
        companyId: 'company-001',
        deletedAt: null,
      });
      (prisma.movement.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.movement.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findAll(
        { documentId: 'doc-001', page: 1, limit: 20 },
        'user-001',
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should throw ForbiddenException when user is not a company member', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.companyMembership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findAll({ documentId: 'doc-001' }, 'user-001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when document not found', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findAll({ documentId: 'doc-001' }, 'user-001'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('batchCreate', () => {
    const batchDto = {
      documentId: 'doc-001',
      movements: [
        {
          movementDate: '2026-06-01',
          description: 'Batch item 1',
          amount: 50.0,
          category: 'Food',
        },
        {
          movementDate: '2026-06-02',
          description: 'Batch item 2',
          amount: 75.0,
        },
      ],
    };

    it('should batch create movements successfully', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.companyMembership.findFirst as jest.Mock).mockResolvedValue({
        id: 'mem-001',
        userId: 'user-001',
        companyId: 'company-001',
        deletedAt: null,
      });
      (prisma.movement.create as jest.Mock)
        .mockResolvedValueOnce(mockMovement)
        .mockResolvedValueOnce({
          ...mockMovement,
          id: 'mov-002',
          description: 'Batch item 2',
          amount: { toString: () => '75.00' },
          category: null,
        });
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (ops: Promise<unknown>[]) => Promise.all(ops),
      );

      const result = await service.batchCreate(batchDto, 'user-001');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('mov-001');
      expect(result[1].id).toBe('mov-002');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when document is not COMPLETED', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        ...mockDocument,
        status: 'PENDING',
      });

      await expect(service.batchCreate(batchDto, 'user-001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.companyMembership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.batchCreate(batchDto, 'user-001')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException for future date in batch', async () => {
      const futureBatch = {
        ...batchDto,
        movements: [
          {
            movementDate: '2099-12-31',
            description: 'Future item',
            amount: 100,
          },
        ],
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.companyMembership.findFirst as jest.Mock).mockResolvedValue({
        id: 'mem-001',
        userId: 'user-001',
        companyId: 'company-001',
        deletedAt: null,
      });

      await expect(
        service.batchCreate(futureBatch, 'user-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
