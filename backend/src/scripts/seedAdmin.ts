import { hashPassword } from '../auth';
import { prisma } from '../prisma';

const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@smartbite.vn').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? '123456';
const adminFullName = process.env.ADMIN_FULL_NAME ?? 'Quản lý SmartBite';

const main = async () => {
  if (adminPassword.length < 6) {
    throw new Error('ADMIN_PASSWORD must be at least 6 characters');
  }

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: adminFullName,
      passwordHash: hashPassword(adminPassword),
      role: 'Manager',
    },
    create: {
      fullName: adminFullName,
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: 'Manager',
      tasteProfile: [],
      allergies: [],
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
  });

  process.stdout.write(`Seeded manager account: ${user.email} (${user.role})\n`);
  process.stdout.write(`User id: ${user.id}\n`);
};

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
