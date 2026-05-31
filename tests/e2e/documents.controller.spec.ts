import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../../src/app.module';
import { PrismaService } from './../../src/prisma/prisma.service';
import { FirebaseAuthGuard } from './../../src/documents/guards/firebase-auth.guard';
import { HttpExceptionFilter } from './../../src/documents/filters/http-exception.filter';

const mockPrisma = {
  document: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  company: {
    findUnique: jest.fn(),
  },
};

const mockDocAiClient = {
  processDocument: jest.fn().mockResolvedValue({
    extractedFields: [],
    rawResponse: {},
  }),
};

class PassAuthGuard {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { uid: 'test-user' };
    return true;
  }
}

describe('DocumentsController (e2e)', () => {
  describe('without auth token', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrisma)
        .overrideProvider('DOCUMENT_AI_CLIENT')
        .useValue(mockDocAiClient)
        .compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalFilters(new HttpExceptionFilter());
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('POST /api/documents/upload should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .post('/api/documents/upload')
        .expect(401);
    });

    it('GET /api/documents should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/api/documents?companyId=0195f1a1-0000-0000-0000-000000000001')
        .expect(401);
    });

    it('DELETE /api/documents/:id should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .delete('/api/documents/doc-1')
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
        .overrideProvider('DOCUMENT_AI_CLIENT')
        .useValue(mockDocAiClient)
        .compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalFilters(new HttpExceptionFilter());
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('POST /api/documents/upload should return 400 with missing file', () => {
      return request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', 'Bearer test-token')
        .field('companyId', '0195f1a1-0000-0000-0000-000000000001')
        .expect(400);
    });

    it('GET /api/documents should return 200 with paginated list', () => {
      const docs = [
        { id: 'doc-1', companyId: '0195f1a1-0000-0000-0000-000000000001', filename: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, status: 'COMPLETED', extractedFields: [], errorMessage: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null },
      ];
      mockPrisma.document.findMany.mockResolvedValue(docs);
      mockPrisma.document.count.mockResolvedValue(1);

      return request(app.getHttpServer())
        .get('/api/documents?companyId=0195f1a1-0000-0000-0000-000000000001')
        .set('Authorization', 'Bearer test-token')
        .expect(200)
        .expect((res) => {
          expect(res.body.items).toHaveLength(1);
          expect(res.body.total).toBe(1);
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(20);
        });
    });

    it('GET /api/documents/:id should return 200 with document', () => {
      const doc = { id: 'doc-1', companyId: '0195f1a1-0000-0000-0000-000000000001', filename: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, status: 'COMPLETED', extractedFields: [], errorMessage: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null };
      mockPrisma.document.findUnique.mockResolvedValue(doc);

      return request(app.getHttpServer())
        .get('/api/documents/doc-1')
        .set('Authorization', 'Bearer test-token')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe('doc-1');
        });
    });

    it('GET /api/documents/:id should return 404 for non-existent document', () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .get('/api/documents/non-existent')
        .set('Authorization', 'Bearer test-token')
        .expect(404);
    });

    it('DELETE /api/documents/:id should return 200 with DELETED status', () => {
      const doc = { id: 'doc-1', companyId: '0195f1a1-0000-0000-0000-000000000001', filename: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, status: 'COMPLETED', extractedFields: [], errorMessage: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null };
      const deletedDoc = { ...doc, status: 'DELETED', deletedAt: new Date().toISOString() };
      mockPrisma.document.findUnique.mockResolvedValue(doc);
      mockPrisma.document.update.mockResolvedValue(deletedDoc);

      return request(app.getHttpServer())
        .delete('/api/documents/doc-1')
        .set('Authorization', 'Bearer test-token')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('DELETED');
          expect(res.body.deletedAt).toBeDefined();
        });
    });

    it('DELETE /api/documents/:id should return 404 for non-existent document', () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .delete('/api/documents/non-existent')
        .set('Authorization', 'Bearer test-token')
        .expect(404);
    });
  });
});
