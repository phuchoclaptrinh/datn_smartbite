import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z
  .object({
    PORT: z.coerce.number().default(4000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z.string().min(1).optional(),

    DB_HOST: z.string().min(1).optional(),
    DB_PORT: z.coerce.number().int().positive().optional(),
    DB_USER: z.string().min(1).optional(),
    DB_PASS: z.string().min(1).optional(),
    DB_NAME: z.string().min(1).optional(),

    JWT_SECRET: z.string().min(1).default('change-me'),
    JWT_EXPIRES_IN: z.string().min(1).default('1h'),

    CORS_ORIGIN: z.string().default('*'),

    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  })
  .superRefine((val, ctx) => {
    const missing: string[] = [];
    if (!val.DATABASE_URL) {
      if (!val.DB_HOST) missing.push('DB_HOST');
      if (!val.DB_PORT) missing.push('DB_PORT');
      if (!val.DB_USER) missing.push('DB_USER');
      if (!val.DB_PASS) missing.push('DB_PASS');
      if (!val.DB_NAME) missing.push('DB_NAME');
    }

    if (missing.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Missing DATABASE_URL or DB_* variables (${missing.join(', ')})`,
      });
    }

    if (val.NODE_ENV === 'production') {
      if (val.JWT_SECRET === 'change-me') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT_SECRET must be changed in production',
          path: ['JWT_SECRET'],
        });
      }

      if (val.CORS_ORIGIN === '*') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CORS_ORIGIN must not be "*" in production',
          path: ['CORS_ORIGIN'],
        });
      }
    }
  });

export const env = EnvSchema.parse({
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,

  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASS,
  DB_NAME: process.env.DB_NAME,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,

  CORS_ORIGIN: process.env.CORS_ORIGIN,

  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
});

if (!process.env.DATABASE_URL && env.DB_HOST && env.DB_PORT && env.DB_USER && env.DB_PASS && env.DB_NAME) {
  const u = encodeURIComponent(env.DB_USER);
  const p = encodeURIComponent(env.DB_PASS);
  process.env.DATABASE_URL = `postgresql://${u}:${p}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}?schema=public`;
}
