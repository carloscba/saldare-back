import { FactoryProvider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { DocumentAIClient } from '../dto/document-ai-client.type';
import { DocumentTable } from '../dto/document-table.type';
import documentAiConfig from '../config/document-ai.config';

interface DocAITextAnchor {
  content?: string;
  textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }>;
}

interface DocAIPage {
  tables?: Array<{
    headerRows?: Array<{
      cells?: Array<{ layout?: { textAnchor?: DocAITextAnchor } }>;
    }>;
    bodyRows?: Array<{
      cells?: Array<{ layout?: { textAnchor?: DocAITextAnchor } }>;
    }>;
  }>;
}

export const DocumentAiClientFactory: FactoryProvider<DocumentAIClient> = {
  provide: 'DOCUMENT_AI_CLIENT',
  inject: [documentAiConfig.KEY],
  useFactory: (config: ConfigType<typeof documentAiConfig>) => {
    const {
      DocumentProcessorServiceClient,
    } = require('@google-cloud/documentai');

    const client = new DocumentProcessorServiceClient({
      apiEndpoint: `${config.processorLocation}-documentai.googleapis.com`,
    });

    function getCellText(
      cell: { layout?: { textAnchor?: DocAITextAnchor } },
      fullText: string,
    ): string {
      const anchor = cell.layout?.textAnchor;
      if (!anchor) return '';

      if (anchor.content && anchor.content.trim() !== '') {
        return anchor.content;
      }

      if (anchor.textSegments && anchor.textSegments.length > 0) {
        const seg = anchor.textSegments[0];
        const start = Number(seg.startIndex ?? 0);
        const end = Number(seg.endIndex ?? start);
        if (end > start && fullText) {
          return fullText.slice(start, end);
        }
      }

      return anchor.content ?? '';
    }

    return {
      async processDocument(fileBuffer: Buffer, mimeType: string) {
        const name = `projects/${config.projectId}/locations/${config.processorLocation}/processors/${config.processorId}`;

        const [result] = await client.processDocument({
          name,
          rawDocument: {
            content: fileBuffer.toString('base64'),
            mimeType,
          },
        });

        const document = result.document;
        const pages = (document?.pages ?? []) as DocAIPage[];
        const fullText = (document as { text?: string })?.text ?? '';

        const tables: DocumentTable[] = [];

        for (const page of pages) {
          for (const table of page.tables ?? []) {
            const headerRows = table.headerRows ?? [];
            const bodyRows = table.bodyRows ?? [];

            console.log(
              `[DocAI] Table found — headers: ${headerRows.length} rows, ` +
                `body: ${bodyRows.length} rows`,
            );

            const headers = headerRows.flatMap((row) =>
              (row.cells ?? []).map((cell) => getCellText(cell, fullText)),
            );

            if (bodyRows.length > 0 && bodyRows[0]?.cells?.length) {
              const sampleTexts = bodyRows[0].cells.map((c) =>
                getCellText(c, fullText),
              );
              console.log(
                `[DocAI] First body row (${bodyRows[0].cells.length} cells): [${sampleTexts.join(' | ')}]`,
              );
            } else {
              console.log(
                `[DocAI] Body rows present=${bodyRows.length > 0}, ` +
                  `first row cells=${bodyRows[0]?.cells?.length ?? 'undefined'}`,
              );
            }

            const rows: string[][] = [];

            for (const bodyRow of bodyRows) {
              const values = (bodyRow.cells ?? []).map((cell) =>
                getCellText(cell, fullText),
              );

              while (values.length < headers.length) {
                values.push('');
              }

              rows.push(values.slice(0, headers.length));
            }

            tables.push({ headers, rows });
          }
        }

        console.log(`[DocAI] Total tables extracted: ${tables.length}`);

        return {
          tables,
          rawResponse: result,
        };
      },
    };
  },
};
