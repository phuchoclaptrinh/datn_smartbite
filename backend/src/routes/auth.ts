import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, requireAuth, requireRole, signJwt, verifyPassword } from '../auth';
import { prisma } from '../prisma';

export const authRouter = Router();

const toAuthUser = (user: {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: 'Customer' | 'Manager';
  tasteProfile: string[];
  allergies: string[];
}) => ({
  id: user.id,
  role: user.role,
  profile: {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone ?? undefined,
  },
  preferences: {
    tasteProfile: user.tasteProfile,
    allergies: user.allergies,
  },
});

authRouter.post('/register', async (req, res) => {
  const body = z
    .object({
      fullName: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      phone: z.string().min(6).optional(),
    })
    .parse(req.body);

  const email = body.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) {
    res.status(409).json({ message: 'Email đã tồn tại' });
    return;
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: body.fullName.trim(),
          phone: body.phone,
          passwordHash: hashPassword(body.password),
          role: 'Customer',
        },
      })
    : await prisma.user.create({
        data: {
          fullName: body.fullName.trim(),
          email,
          phone: body.phone,
          passwordHash: hashPassword(body.password),
          role: 'Customer',
          tasteProfile: [],
          allergies: [],
        },
      });

  const token = signJwt({ id: user.id, email: user.email, role: user.role });
  res.status(201).json({ token, user: toAuthUser(user) });
});

authRouter.post('/managers', requireAuth, requireRole('Manager'), async (req, res) => {
  const body = z
    .object({
      fullName: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      phone: z.string().min(6).optional(),
    })
    .parse(req.body);

  const email = body.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    res.status(409).json({ message: 'Email đã tồn tại' });
    return;
  }

  const user = await prisma.user.create({
    data: {
      fullName: body.fullName.trim(),
      email,
      phone: body.phone,
      passwordHash: hashPassword(body.password),
      role: 'Manager',
      tasteProfile: [],
      allergies: [],
    },
  });

  res.status(201).json({ user: toAuthUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
    })
    .parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    return;
  }

  const token = signJwt({ id: user.id, email: user.email, role: user.role });
  res.json({ token, user: toAuthUser(user) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  res.json({ user: toAuthUser(user) });
});
