import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { ConfigType } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import documentAiConfig from './config/document-ai.config';
import type { DocumentAIClient } from './dto/document-ai-client.type';
import { DocumentResponseDto } from './dto/document-response.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('DOCUMENT_AI_CLIENT')
    private readonly documentAi: DocumentAIClient,
    @Inject(documentAiConfig.KEY)
    private readonly config: ConfigType<typeof documentAiConfig>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredDocuments(): Promise<void> {
    const now = new Date();

    const expired = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        status: { in: ['COMPLETED', 'FAILED'] },
      },
    });

    let count = 0;
    for (const doc of expired) {
      const expiry = new Date(
        doc.createdAt.getTime() + doc.ttlDays * 86_400_000,
      );
      if (expiry < now) {
        await this.prisma.document.update({
          where: { id: doc.id },
          data: { status: 'DELETED', deletedAt: now },
        });
        count++;
      }
    }

    if (count > 0) {
      this.logger.log(`Soft-deleted ${count} expired documents`);
    }
  }

  async findAll(
    companyId: string,
    query: { page?: number; limit?: number; status?: string },
  ): Promise<{
    items: DocumentResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = { companyId, deletedAt: null };
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      items: items.map((doc) =>
        this.toResponseDto(doc as Record<string, unknown>),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId: string): Promise<DocumentResponseDto> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    const membership = await this.prisma.companyMembership.findFirst({
      where: { userId, companyId: doc.companyId, deletedAt: null },
    });
    if (!membership) {
      throw new NotFoundException('Document not found');
    }

    return this.toResponseDto(doc);
  }

  async remove(id: string, userId: string): Promise<DocumentResponseDto> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    const membership = await this.prisma.companyMembership.findFirst({
      where: { userId, companyId: doc.companyId, deletedAt: null },
    });
    if (!membership) {
      throw new NotFoundException('Document not found');
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: new Date() },
    });

    return this.toResponseDto(updated);
  }

  async upload(
    file: Express.Multer.File,
    companyId: string,
    userId: string,
    ttlDays?: number,
  ): Promise<DocumentResponseDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const membership = await this.prisma.companyMembership.findFirst({
      where: { userId, companyId, deletedAt: null },
    });
    if (!membership) {
      throw new NotFoundException('Company not found');
    }

    const document = await this.prisma.document.create({
      data: {
        companyId,
        filename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: 'PENDING',
        ttlDays: ttlDays ?? 30,
      },
    });

    try {
      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: 'PROCESSING' },
      });

      this.logger.log(`Processing document ${document.id} with Document AI`);

      const result = await this.documentAi.processDocument(
        file.buffer,
        file.mimetype,
      );

      this.logger.log(`Document AI processing succeeded for ${document.id}`);

      const updated = await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'COMPLETED',
          extractedFields: JSON.parse(
            JSON.stringify({ tables: result.tables }),
          ),
          rawResponse: JSON.parse(JSON.stringify(result.rawResponse)),
        },
      });

      return this.toResponseDto(updated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Document processing failed';

      this.logger.error(
        `Document AI processing failed for ${document.id}: ${message}`,
      );

      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: 'FAILED', errorMessage: message },
      });

      throw new ServiceUnavailableException({
        message: 'Document processing service is temporarily unavailable',
        retryAfter: 30,
      });
    }
  }

  private toResponseDto(doc: Record<string, unknown>): DocumentResponseDto {
    let extractedFields: DocumentResponseDto['extractedFields'];

    if (doc.extractedFields != null) {
      if (Array.isArray(doc.extractedFields)) {
        extractedFields = { tables: [] };
      } else {
        extractedFields =
          doc.extractedFields as DocumentResponseDto['extractedFields'];
      }
    }

    return {
      id: doc.id as string,
      companyId: doc.companyId as string,
      filename: doc.filename as string,
      mimeType: doc.mimeType as string,
      fileSize: doc.fileSize as number,
      status: doc.status as string,
      extractedFields,
      errorMessage: doc.errorMessage as string | undefined,
      createdAt: doc.createdAt as Date,
      updatedAt: doc.updatedAt as Date,
      deletedAt: doc.deletedAt as Date | undefined,
    };
  }
}
