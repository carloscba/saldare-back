import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from '../../src/documents/documents.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigType } from '@nestjs/config';
import documentAiConfig from '../../src/documents/config/document-ai.config';
import { DocumentAIClient } from '../../src/documents/dto/document-ai-client.type';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: PrismaService;
  let documentAi: DocumentAIClient;

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

  const mockDocumentAi = {
    processDocument: jest.fn(),
  };

  const mockConfig: ConfigType<typeof documentAiConfig> = {
    projectId: 'test-project',
    processorId: 'test-processor',
    processorLocation: 'us-central1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'DOCUMENT_AI_CLIENT', useValue: mockDocumentAi },
        { provide: documentAiConfig.KEY, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    prisma = module.get<PrismaService>(PrismaService);
    documentAi = module.get<DocumentAIClient>('DOCUMENT_AI_CLIENT');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload()', () => {
    const validFile = {
      buffer: Buffer.from('fake-pdf-content'),
      mimetype: 'application/pdf',
      size: 1024,
      originalname: 'invoice.pdf',
      path: '/tmp/uploads/invoice.pdf',
    } as Express.Multer.File;

    const companyId = '0195f1a1-0000-0000-0000-000000000001';
    const ttlDays = 30;

    it('should create a document and return the result', async () => {
      const createdAt = new Date();
      mockPrisma.company.findUnique.mockResolvedValue({ id: companyId, name: 'Test Company' });
      mockPrisma.document.create.mockResolvedValue({
        id: 'doc-1',
        companyId,
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        status: 'PENDING',
        extractedFields: null,
        rawResponse: null,
        errorMessage: null,
        ttlDays: 30,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
      });
      mockPrisma.document.update.mockResolvedValue({
        id: 'doc-1',
        companyId,
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        status: 'COMPLETED',
        extractedFields: [{ label: 'total', value: '100', confidence: 0.95 }],
        rawResponse: { data: 'ok' },
        errorMessage: null,
        ttlDays: 30,
        createdAt,
        updatedAt: new Date(),
        deletedAt: null,
      });
      mockDocumentAi.processDocument.mockResolvedValue({
        extractedFields: [{ label: 'total', value: '100', confidence: 0.95 }],
        rawResponse: { data: 'ok' },
      });

      const result = await service.upload(validFile, companyId, ttlDays);

      expect(result).toBeDefined();
      expect(result.status).toBe('COMPLETED');
      expect(mockPrisma.document.create).toHaveBeenCalled();
    });

    it('should throw if company does not exist', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.upload(validFile, 'non-existent-id', ttlDays)).rejects.toThrow();
    });
  });

  describe('findAll()', () => {
    const companyId = '0195f1a1-0000-0000-0000-000000000001';

    it('should return paginated documents filtered by companyId', async () => {
      const docs = [
        { id: 'doc-1', companyId, filename: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, status: 'COMPLETED', extractedFields: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
      ];
      mockPrisma.document.findMany.mockResolvedValue(docs);
      mockPrisma.document.count.mockResolvedValue(1);

      const result = await service.findAll(companyId, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId }) }),
      );
    });

    it('should filter by status when provided', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);

      await service.findAll(companyId, { page: 1, limit: 20, status: 'COMPLETED' });

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });
  });

  describe('remove()', () => {
    const docId = 'doc-1';
    const companyId = '0195f1a1-0000-0000-0000-000000000001';

    it('should soft-delete a document and return it', async () => {
      const doc = { id: docId, companyId, filename: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, status: 'COMPLETED', extractedFields: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
      const deletedDoc = { ...doc, status: 'DELETED', deletedAt: new Date() };
      mockPrisma.document.findUnique.mockResolvedValue(doc);
      mockPrisma.document.update.mockResolvedValue(deletedDoc);

      const result = await service.remove(docId);

      expect(result.status).toBe('DELETED');
      expect(result.deletedAt).toBeDefined();
      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: docId },
          data: expect.objectContaining({ status: 'DELETED' }),
        }),
      );
    });

    it('should throw NotFoundException if document does not exist', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(service.remove(docId)).rejects.toThrow('Document not found');
    });

    it('should throw NotFoundException if already deleted', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: docId, companyId, filename: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, status: 'DELETED', extractedFields: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date(),
      });

      await expect(service.remove(docId)).rejects.toThrow('Document not found');
    });
  });

  describe('findOne()', () => {
    const docId = 'doc-1';
    const companyId = '0195f1a1-0000-0000-0000-000000000001';

    it('should return a document by id', async () => {
      const doc = { id: docId, companyId, filename: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, status: 'COMPLETED', extractedFields: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
      mockPrisma.document.findUnique.mockResolvedValue(doc);

      const result = await service.findOne(docId);

      expect(result.id).toBe(docId);
      expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({ where: { id: docId } });
    });

    it('should throw NotFoundException if document does not exist', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(service.findOne(docId)).rejects.toThrow('Document not found');
    });

    it('should throw NotFoundException if document is soft-deleted', async () => {
      const deletedDoc = { id: docId, companyId, filename: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, status: 'DELETED', extractedFields: null, errorMessage: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date() };
      mockPrisma.document.findUnique.mockResolvedValue(deletedDoc);

      await expect(service.findOne(docId)).rejects.toThrow('Document not found');
    });
  });
});
