import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompanyMembershipGuard implements CanActivate {
  private readonly logger = new Logger(CompanyMembershipGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.uid;

    const companyId = request.query?.companyId ?? request.body?.companyId;

    if (!companyId) {
      return true;
    }

    const membership = await this.prisma.companyMembership.findFirst({
      where: {
        userId,
        companyId,
        deletedAt: null,
      },
    });

    if (!membership) {
      this.logger.warn({
        timestamp: new Date().toISOString(),
        userId,
        requestedCompanyId: companyId,
        endpoint: `${request.method} ${request.route?.path ?? request.url}`,
        reason: 'not_member',
      });

      throw new ForbiddenException(
        "You do not have access to this company's documents",
      );
    }

    return true;
  }
}
