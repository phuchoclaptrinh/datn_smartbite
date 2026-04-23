import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z
    .string({ required_error: 'Thiếu MONGODB_URI (hãy tạo file .env trong thư mục backend)' })
    .min(1, 'Thiếu MONGODB_URI (hãy tạo file .env trong thư mục backend)'),
  CORS_ORIGIN: z.string().default('*'),
});

export const env = EnvSchema.parse({
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
});
