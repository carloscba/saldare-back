import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { FirebaseAuthGuard } from './../../src/documents/guards/firebase-auth.guard';

const mockPrisma = {
  companyMembership: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  company: {
    findUnique: jest.fn(),
  },
};

class PassAuthGuard {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { uid: 'test-user' };
    return true;
  }
}

describe('CompaniesController (e2e)', () => {
  describe('without auth token', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrisma)
        .compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('GET /api/companies should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/api/companies')
        .expect(401);
    });
  });

  describe('with auth token', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrisma)
        .overrideGuard(FirebaseAuthGuard)
        .useClass(PassAuthGuard)
        .compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('GET /api/companies should return 200 with companies list', () => {
      const createdAt = new Date('2026-01-01').toISOString();
      mockPrisma.companyMembership.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          userId: 'test-user',
          companyId: 'company-1',
          company: { id: 'company-1', name: 'Acme Corp', createdAt },
        },
        {
          id: 'mem-2',
          userId: 'test-user',
          companyId: 'company-2',
          company: { id: 'company-2', name: 'Globex Inc', createdAt },
        },
      ]);

      return request(app.getHttpServer())
        .get('/api/companies')
        .set('Authorization', 'Bearer test-token')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(2);
          expect(res.body[0]).toEqual({ id: 'company-1', name: 'Acme Corp', createdAt });
          expect(res.body[1]).toEqual({ id: 'company-2', name: 'Globex Inc', createdAt });
        });
    });

    it('GET /api/companies should return 200 with empty list when user has no memberships', () => {
      mockPrisma.companyMembership.findMany.mockResolvedValue([]);

      return request(app.getHttpServer())
        .get('/api/companies')
        .set('Authorization', 'Bearer test-token')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([]);
        });
    });
  });
});
