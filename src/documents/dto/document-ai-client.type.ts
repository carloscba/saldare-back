export interface DocumentAIClient {
  processDocument(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<{ extractedFields: Array<{ label: string; value: string; confidence: number }>; rawResponse: unknown }>;
}
