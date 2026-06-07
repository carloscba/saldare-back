import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyResponseDto } from './dto/company-response.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string): Promise<CompanyResponseDto[]> {
    const memberships = await this.prisma.companyMembership.findMany({
      where: { userId, deletedAt: null },
      include: { company: true },
      orderBy: { company: { name: 'asc' } },
    });

    return memberships.map((m) => ({
      id: m.company.id,
      name: m.company.name,
      createdAt: m.company.createdAt,
    }));
  }
}
