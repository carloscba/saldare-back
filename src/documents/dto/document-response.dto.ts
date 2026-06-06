import { ExtractedField } from '../interfaces/extracted-field.interface';

export class DocumentResponseDto {
  id: string;
  companyId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: string;
  extractedFields?: ExtractedField[];
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
