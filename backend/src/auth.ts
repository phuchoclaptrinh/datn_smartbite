import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from './env';
import { prisma } from './prisma';

export type AuthRole = 'Customer' | 'Manager';

export type AuthUser = {
  id: string;
  email: string;
  role: AuthRole;
};

const TOKEN_ALG = 'HS256';
const TOKEN_TYP = 'JWT';
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_LENGTH = 16;

const base64UrlEncode = (input: Buffer | string) =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const base64UrlDecode = (input: string) => {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), '=').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
};

const timingSafeEqualText = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(PASSWORD_SALT_LENGTH).toString('hex');
  const hash = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${hash}`;
};

export const verifyPassword = (password: string, stored: string) => {
  const [method, salt, hash] = stored.split(':');
  if (method !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');
  return timingSafeEqualText(candidate, hash);
};

const parseExpiresIn = (value: string) => {
  const match = value.trim().match(/^(\d+)([smhd])?$/i);
  if (!match) return 60 * 60;
  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 };
  return amount * multipliers[unit];
};

export const signJwt = (user: AuthUser) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + parseExpiresIn(env.JWT_EXPIRES_IN),
  };
  const header = { alg: TOKEN_ALG, typ: TOKEN_TYP };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', env.JWT_SECRET).update(data).digest();
  return `${data}.${base64UrlEncode(signature)}`;
};

export const verifyJwt = (token: string): AuthUser | null => {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = base64UrlEncode(crypto.createHmac('sha256', env.JWT_SECRET).update(data).digest());
    if (!timingSafeEqualText(encodedSignature, expectedSignature)) return null;

    const header = z.object({ alg: z.literal(TOKEN_ALG), typ: z.literal(TOKEN_TYP) }).safeParse(JSON.parse(base64UrlDecode(encodedHeader)));
    if (!header.success) return null;

    const payload = z
      .object({
        sub: z.string().min(1),
        email: z.string().email(),
        role: z.enum(['Customer', 'Manager']),
        exp: z.number(),
      })
      .safeParse(JSON.parse(base64UrlDecode(encodedPayload)));
    if (!payload.success) return null;
    if (payload.data.exp <= Math.floor(Date.now() / 1000)) return null;

    return { id: payload.data.sub, email: payload.data.email, role: payload.data.role };
  } catch {
    return null;
  }
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const authUser = token ? verifyJwt(token) : null;
  if (!authUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { id: authUser.id }, select: { id: true, role: true } });
  if (!exists) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  req.authUser = { ...authUser, role: exists.role };
  next();
};

export const requireRole = (...roles: AuthRole[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.authUser || !roles.includes(req.authUser.role)) {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  next();
};
