import { DocumentTable } from './document-table.type';

export interface DocumentAIClient {
  processDocument(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<{
    tables: DocumentTable[];
    rawResponse: unknown;
  }>;
}
