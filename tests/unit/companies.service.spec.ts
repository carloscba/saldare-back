import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from '../../src/companies/companies.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('CompaniesService', () => {
  let service: CompaniesService;

  const mockPrisma = {
    companyMembership: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByUser()', () => {
    const userId = 'test-user';
    const createdAt = new Date('2026-01-01');

    it('should return companies for user with active memberships', async () => {
      mockPrisma.companyMembership.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          userId,
          companyId: 'company-1',
          company: { id: 'company-1', name: 'Acme Corp', createdAt },
        },
        {
          id: 'mem-2',
          userId,
          companyId: 'company-2',
          company: { id: 'company-2', name: 'Globex Inc', createdAt },
        },
      ]);

      const result = await service.findByUser(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'company-1', name: 'Acme Corp', createdAt });
      expect(result[1]).toEqual({ id: 'company-2', name: 'Globex Inc', createdAt });
    });

    it('should return empty array for user with no memberships', async () => {
      mockPrisma.companyMembership.findMany.mockResolvedValue([]);

      const result = await service.findByUser(userId);

      expect(result).toEqual([]);
    });

    it('should exclude soft-deleted memberships (deletedAt IS NULL filter)', async () => {
      mockPrisma.companyMembership.findMany.mockResolvedValue([]);

      await service.findByUser(userId);

      expect(mockPrisma.companyMembership.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: null },
        include: { company: true },
        orderBy: { company: { name: 'asc' } },
      });
    });

    it('should return only active memberships, not soft-deleted ones', async () => {
      mockPrisma.companyMembership.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          userId,
          companyId: 'company-1',
          company: { id: 'company-1', name: 'Acme Corp', createdAt },
        },
      ]);

      const result = await service.findByUser(userId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Acme Corp');
    });

    it('should return companies ordered by name ASC', async () => {
      mockPrisma.companyMembership.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          userId,
          companyId: 'company-1',
          company: { id: 'company-1', name: 'Acme Corp', createdAt },
        },
        {
          id: 'mem-2',
          userId,
          companyId: 'company-2',
          company: { id: 'company-2', name: 'Beta LLC', createdAt },
        },
      ]);

      const result = await service.findByUser(userId);

      expect(result[0].name).toBe('Acme Corp');
      expect(result[1].name).toBe('Beta LLC');
    });
  });
});
