import { ExtractedData } from './extracted-data.type';

export class DocumentResponseDto {
  id: string;
  companyId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: string;
  extractedFields?: ExtractedData;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
