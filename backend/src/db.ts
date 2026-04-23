import { prisma } from './prisma';

export const connectDb = async () => {
  await prisma.$connect();
};

export const disconnectDb = async () => {
  await prisma.$disconnect();
};
