import { registerAs } from '@nestjs/config';

export default registerAs('documentAi', () => ({
  projectId: process.env.DOCUMENT_AI_PROJECT_ID,
  processorId: process.env.DOCUMENT_AI_PROCESSOR_ID,
  processorLocation: process.env.DOCUMENT_AI_PROCESSOR_LOCATION ?? 'us-central1',
}));
