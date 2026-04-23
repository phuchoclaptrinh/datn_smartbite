import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string({ required_error: 'Thiếu DATABASE_URL (hãy tạo file .env trong thư mục backend)' })
    .min(1, 'Thiếu DATABASE_URL (hãy tạo file .env trong thư mục backend)'),
  CORS_ORIGIN: z.string().default('*'),
});

export const env = EnvSchema.parse({
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
});
