import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { CompanyMembershipGuard } from './guards/company-membership.guard';
import documentAiConfig from './config/document-ai.config';
import { DocumentAiClientFactory } from './providers/document-ai-client.provider';

@Module({
  imports: [ConfigModule.forFeature(documentAiConfig)],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    FirebaseAuthGuard,
    CompanyMembershipGuard,
    DocumentAiClientFactory,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
