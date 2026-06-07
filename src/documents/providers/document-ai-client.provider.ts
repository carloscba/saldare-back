import { FactoryProvider } from '@nestjs/common';
import { DocumentAIClient } from '../dto/document-ai-client.type';

interface DocAIPage {
  formFields?: Array<{
    fieldName?: { textAnchor?: { content?: string }; confidence?: number };
    fieldValue?: { textAnchor?: { content?: string }; confidence?: number };
  }>;
  tables?: Array<{
    headerRows?: Array<{
      cells?: Array<{ layout?: { textAnchor?: { content?: string } } }>;
    }>;
    bodyRows?: Array<{
      cells?: Array<{ layout?: { textAnchor?: { content?: string } } }>;
    }>;
  }>;
}

export const DocumentAiClientFactory: FactoryProvider<DocumentAIClient> = {
  provide: 'DOCUMENT_AI_CLIENT',
  useFactory: () => {
    const {
      DocumentProcessorServiceClient,
    } = require('@google-cloud/documentai');

    const client = new DocumentProcessorServiceClient({
      apiEndpoint: `${process.env.DOCUMENT_AI_PROCESSOR_LOCATION ?? 'us'}-documentai.googleapis.com`,
    });

    return {
      async processDocument(fileBuffer: Buffer, mimeType: string) {
        const projectId = process.env.DOCUMENT_AI_PROJECT_ID;
        const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
        const location = process.env.DOCUMENT_AI_PROCESSOR_LOCATION ?? 'us';

        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

        const [result] = await client.processDocument({
          name,
          rawDocument: {
            content: fileBuffer.toString('base64'),
            mimeType,
          },
        });

        const document = result.document;
        const pages = (document?.pages ?? []) as DocAIPage[];

        const extractedFields: Array<{
          label: string;
          value: string;
          confidence: number;
        }> = [];

        for (const page of pages) {
          for (const field of page.formFields ?? []) {
            extractedFields.push({
              label: field.fieldName?.textAnchor?.content ?? '',
              value: field.fieldValue?.textAnchor?.content ?? '',
              confidence:
                field.fieldValue?.confidence ??
                field.fieldName?.confidence ??
                0,
            });
          }

          for (const table of page.tables ?? []) {
            const headers = (table.headerRows ?? []).flatMap((row) =>
              (row.cells ?? []).map(
                (cell) => cell.layout?.textAnchor?.content ?? '',
              ),
            );
            for (const row of table.bodyRows ?? []) {
              const values = (row.cells ?? []).map(
                (cell) => cell.layout?.textAnchor?.content ?? '',
              );
              const rowLabel = values.join(' | ');
              extractedFields.push({
                label: headers.join(' | ') || 'table_row',
                value: rowLabel,
                confidence: 1,
              });
            }
          }
        }

        return {
          extractedFields,
          rawResponse: result,
        };
      },
    };
  },
};
