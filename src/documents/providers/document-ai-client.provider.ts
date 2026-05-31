import { FactoryProvider } from '@nestjs/common';
import { DocumentAIClient } from '../dto/document-ai-client.type';

export const DocumentAiClientFactory: FactoryProvider<DocumentAIClient> = {
  provide: 'DOCUMENT_AI_CLIENT',
  useFactory: () => {
    const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');

    const client = new DocumentProcessorServiceClient({
      apiEndpoint: 'us-central1-documentai.googleapis.com',
    });

    return {
      async processDocument(fileBuffer: Buffer, mimeType: string) {
        const projectId = process.env.DOCUMENT_AI_PROJECT_ID;
        const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
        const location = process.env.DOCUMENT_AI_PROCESSOR_LOCATION ?? 'us-central1';

        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

        const [result] = await client.processDocument({
          name,
          rawDocument: {
            content: fileBuffer.toString('base64'),
            mimeType,
          },
        });

        const document = result.document;
        const extractedFields = (document?.entities ?? []).map(
          (entity: { type: string; mentionText: string; confidence: number }) => ({
            label: entity.type,
            value: entity.mentionText,
            confidence: entity.confidence ?? 0,
          }),
        );

        return {
          extractedFields,
          rawResponse: result,
        };
      },
    };
  },
};
