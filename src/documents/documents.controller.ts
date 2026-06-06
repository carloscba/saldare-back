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
  MaxFileSizeValidator,
  ParseFilePipe,
  FileTypeValidator,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { DocumentsService } from './documents.service';
import { DocumentListQueryDto } from './dto/document-list-query.dto';

@Controller('api/documents')
@UseGuards(FirebaseAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async findAll(@Query(ValidationPipe) query: DocumentListQueryDto) {
    return this.documentsService.findAll(query.companyId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = process.env.UPLOAD_DIR ?? '/tmp/uploads';
          mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE ?? '5242880', 10) },
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
    @Body('ttlDays') ttlDays?: number,
  ) {
    return this.documentsService.upload(file, companyId, ttlDays);
  }
}
