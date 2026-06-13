import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

describe('MovementsController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  describe('POST /api/movements', () => {
    it('should return 201 when movement is created successfully', async () => {
      const token = process.env.AUTH_BYPASS_TOKEN ?? 'test-token';

      return request(app.getHttpServer())
        .post('/api/movements')
        .set('Authorization', `Bearer ${token}`)
        .send({
          movementDate: '2026-06-01',
          description: 'Test movement',
          amount: 100.5,
          category: 'Test',
          documentId: '00000000-0000-4000-8000-000000000001',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('documentId');
          expect(res.body).toHaveProperty('movementDate');
          expect(res.body).toHaveProperty('description');
          expect(res.body).toHaveProperty('amount');
        });
    });

    it('should return 401 when no auth header is provided', () => {
      return request(app.getHttpServer())
        .post('/api/movements')
        .send({
          movementDate: '2026-06-01',
          description: 'Test',
          amount: 100,
          documentId: '00000000-0000-4000-8000-000000000001',
        })
        .expect(401);
    });

    it('should return 400 when required fields are missing', async () => {
      const token = process.env.AUTH_BYPASS_TOKEN ?? 'test-token';

      return request(app.getHttpServer())
        .post('/api/movements')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('should return 404 when document does not exist', async () => {
      const token = process.env.AUTH_BYPASS_TOKEN ?? 'test-token';

      return request(app.getHttpServer())
        .post('/api/movements')
        .set('Authorization', `Bearer ${token}`)
        .send({
          movementDate: '2026-06-01',
          description: 'Test',
          amount: 100,
          documentId: '00000000-0000-4000-8000-00000000ffff',
        })
        .expect(404);
    });
  });

  describe('GET /api/movements', () => {
    it('should return 200 with paginated results', async () => {
      const token = process.env.AUTH_BYPASS_TOKEN ?? 'test-token';

      return request(app.getHttpServer())
        .get('/api/movements')
        .set('Authorization', `Bearer ${token}`)
        .query({ documentId: '00000000-0000-4000-8000-000000000001' })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('items');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(res.body).toHaveProperty('totalPages');
          expect(Array.isArray(res.body.items)).toBe(true);
        });
    });

    it('should return 200 with empty items when no movements exist', async () => {
      const token = process.env.AUTH_BYPASS_TOKEN ?? 'test-token';

      return request(app.getHttpServer())
        .get('/api/movements')
        .set('Authorization', `Bearer ${token}`)
        .query({
          documentId: '00000000-0000-4000-8000-000000000002',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.items).toEqual([]);
          expect(res.body.total).toBe(0);
        });
    });

    it('should return 401 when no auth header is provided', () => {
      return request(app.getHttpServer())
        .get('/api/movements')
        .query({ documentId: '00000000-0000-4000-8000-000000000001' })
        .expect(401);
    });

    it('should return 400 when documentId is missing', async () => {
      const token = process.env.AUTH_BYPASS_TOKEN ?? 'test-token';

      return request(app.getHttpServer())
        .get('/api/movements')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('POST /api/movements/batch', () => {
    it('should return 201 when batch is created successfully', async () => {
      const token = process.env.AUTH_BYPASS_TOKEN ?? 'test-token';

      return request(app.getHttpServer())
        .post('/api/movements/batch')
        .set('Authorization', `Bearer ${token}`)
        .send({
          documentId: '00000000-0000-4000-8000-000000000001',
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
        })
        .expect(201)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(2);
          expect(res.body[0]).toHaveProperty('id');
          expect(res.body[1]).toHaveProperty('id');
        });
    });

    it('should return 401 when no auth header is provided', () => {
      return request(app.getHttpServer())
        .post('/api/movements/batch')
        .send({
          documentId: '00000000-0000-4000-8000-000000000001',
          movements: [],
        })
        .expect(401);
    });

    it('should return 400 when batch is empty', async () => {
      const token = process.env.AUTH_BYPASS_TOKEN ?? 'test-token';

      return request(app.getHttpServer())
        .post('/api/movements/batch')
        .set('Authorization', `Bearer ${token}`)
        .send({
          documentId: '00000000-0000-4000-8000-000000000001',
          movements: [],
        })
        .expect(400);
    });

    it('should return 400 when documentId is missing', async () => {
      const token = process.env.AUTH_BYPASS_TOKEN ?? 'test-token';

      return request(app.getHttpServer())
        .post('/api/movements/batch')
        .set('Authorization', `Bearer ${token}`)
        .send({
          movements: [
            {
              movementDate: '2026-06-01',
              description: 'Test',
              amount: 100,
            },
          ],
        })
        .expect(400);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
