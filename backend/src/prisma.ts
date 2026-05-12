import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const buildDatabaseUrlFromParts = () => {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASS;
  const name = process.env.DB_NAME;

  if (!host || !port || !user || !pass || !name) return undefined;

  const u = encodeURIComponent(user);
  const p = encodeURIComponent(pass);
  return `postgresql://${u}:${p}@${host}:${port}/${name}?schema=public`;
};

if (!process.env.DATABASE_URL) {
  const built = buildDatabaseUrlFromParts();
  if (built) process.env.DATABASE_URL = built;
}

export const prisma = new PrismaClient();
