import {
  All,
  Controller,
  MethodNotAllowedException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

@Controller('api/health')
export class HealthController {
  @All()
  handleHealth(@Req() req: Request): { status: string } {
    if (req.method !== 'GET') {
      throw new MethodNotAllowedException();
    }
    return { status: 'ok' };
  }
}
