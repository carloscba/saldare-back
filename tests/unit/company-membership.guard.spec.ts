import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CompanyMembershipGuard } from '../../src/documents/guards/company-membership.guard';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('CompanyMembershipGuard', () => {
  let guard: CompanyMembershipGuard;

  const mockPrisma = {
    companyMembership: {
      findFirst: jest.fn(),
    },
  };

  function createMockContext(
    query: Record<string, string> = {},
    body: Record<string, string> = {},
  ): { context: ExecutionContext; request: Record<string, unknown> } {
    const request: Record<string, unknown> = {
      user: { uid: 'test-user' },
      query,
      body,
      method: 'GET',
      route: { path: '/api/documents' },
      url: '/api/documents',
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    return { context, request };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyMembershipGuard,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    guard = module.get<CompanyMembershipGuard>(CompanyMembershipGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate()', () => {
    it('should allow access when user is a member of the company (query param)', async () => {
      const { context } = createMockContext({ companyId: 'company-1' });
      mockPrisma.companyMembership.findFirst.mockResolvedValue({
        id: 'mem-1',
        userId: 'test-user',
        companyId: 'company-1',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrisma.companyMembership.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'test-user',
          companyId: 'company-1',
          deletedAt: null,
        },
      });
    });

    it('should allow access when user is a member of the company (body field)', async () => {
      const { context } = createMockContext({}, { companyId: 'company-1' });
      mockPrisma.companyMembership.findFirst.mockResolvedValue({
        id: 'mem-1',
        userId: 'test-user',
        companyId: 'company-1',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should reject non-member with 403 ForbiddenException', async () => {
      const { context } = createMockContext({ companyId: 'company-2' });
      mockPrisma.companyMembership.findFirst.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        "You do not have access to this company's documents",
      );
    });

    it('should pass through when no companyId is present (for /:id endpoints)', async () => {
      const { context } = createMockContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrisma.companyMembership.findFirst).not.toHaveBeenCalled();
    });

    it('should query only active memberships (deletedAt IS NULL)', async () => {
      const { context } = createMockContext({ companyId: 'company-1' });
      mockPrisma.companyMembership.findFirst.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.companyMembership.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'test-user',
          companyId: 'company-1',
          deletedAt: null,
        },
      });
    });
  });
});
