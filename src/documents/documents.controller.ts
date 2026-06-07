import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Body,
  Req,
  MaxFileSizeValidator,
  ParseFilePipe,
  FileTypeValidator,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { CompanyMembershipGuard } from './guards/company-membership.guard';
import { DocumentsService } from './documents.service';
import { DocumentListQueryDto } from './dto/document-list-query.dto';

@Controller('api/documents')
@UseGuards(FirebaseAuthGuard, CompanyMembershipGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async findAll(@Query(ValidationPipe) query: DocumentListQueryDto) {
    return this.documentsService.findAll(query.companyId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req['user'] as { uid: string };
    return this.documentsService.findOne(id, user.uid);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req['user'] as { uid: string };
    return this.documentsService.remove(id, user.uid);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE ?? '5242880', 10),
      },
    }),
  )
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: '.(pdf|png|jpeg|jpg|tiff)' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('companyId') companyId: string,
    @Req() req: Request,
    @Body('ttlDays') ttlDays?: number,
  ) {
    const user = req['user'] as { uid: string };
    return this.documentsService.upload(file, companyId, user.uid, ttlDays);
  }
}
