import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const adapter = new PrismaPg(datasourceUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  const existingA = await prisma.company.findUnique({
    where: { id: 'a0000000-0000-0000-0000-000000000001' },
  });

  if (!existingA) {
    await prisma.company.create({
      data: {
        id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Acme Corp',
      },
    });
    console.log('Created company: Acme Corp');
  }

  const existingB = await prisma.company.findUnique({
    where: { id: 'a0000000-0000-0000-0000-000000000002' },
  });

  if (!existingB) {
    await prisma.company.create({
      data: {
        id: 'a0000000-0000-0000-0000-000000000002',
        name: 'Globex Inc',
      },
    });
    console.log('Created company: Globex Inc');
  }

  const devUserId = 'dev-user';
  const companyId1 = 'a0000000-0000-0000-0000-000000000001';
  const companyId2 = 'a0000000-0000-0000-0000-000000000002';

  const existingMem1 = await prisma.companyMembership.findFirst({
    where: { userId: devUserId, companyId: companyId1 },
  });

  if (!existingMem1) {
    await prisma.companyMembership.create({
      data: {
        userId: devUserId,
        companyId: companyId1,
      },
    });
    console.log(`Created membership: ${devUserId} -> Acme Corp`);
  } else if (existingMem1.deletedAt) {
    await prisma.companyMembership.update({
      where: { id: existingMem1.id },
      data: { deletedAt: null },
    });
    console.log(`Reactivated membership: ${devUserId} -> Acme Corp`);
  }

  const existingMem2 = await prisma.companyMembership.findFirst({
    where: { userId: devUserId, companyId: companyId2 },
  });

  if (!existingMem2) {
    await prisma.companyMembership.create({
      data: {
        userId: devUserId,
        companyId: companyId2,
      },
    });
    console.log(`Created membership: ${devUserId} -> Globex Inc`);
  } else if (existingMem2.deletedAt) {
    await prisma.companyMembership.update({
      where: { id: existingMem2.id },
      data: { deletedAt: null },
    });
    console.log(`Reactivated membership: ${devUserId} -> Globex Inc`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
