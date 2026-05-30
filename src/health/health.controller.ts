import { All, Controller, MethodNotAllowedException, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('health')
export class HealthController {
  @All()
  handleHealth(@Req() req: Request): { status: string } {
    if (req.method !== 'GET') {
      throw new MethodNotAllowedException();
    }
    return { status: 'ok' };
  }
}
