import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseAuthGuard } from '../documents/guards/firebase-auth.guard';
import { CompaniesService } from './companies.service';

@Controller('api/companies')
@UseGuards(FirebaseAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async findAll(@Req() req: Request) {
    const user = req['user'] as { uid: string };
    return this.companiesService.findByUser(user.uid);
  }
}
