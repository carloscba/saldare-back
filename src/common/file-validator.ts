import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
}

export async function validateFile(
  buffer: Buffer,
  mimetype: string,
  size: number,
): Promise<FileValidationResult> {
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 5MB limit' };
  }

  if (!mimetype || !ALLOWED_MIME_TYPES.includes(mimetype)) {
    return { valid: false, error: 'Unsupported file type. Accepted: PDF, PNG, JPEG, TIFF' };
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
    return { valid: false, error: 'File content does not match expected format' };
  }

  return { valid: true, mimeType: detected.mime };
}
