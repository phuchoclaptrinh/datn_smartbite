import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth';
import { prisma } from '../prisma';

export const usersRouter = Router();

usersRouter.post(
  '/',
  async (req, res) => {
    const body = z
      .object({
        fullName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(6).optional(),
      })
      .parse(req.body);

    const doc = await prisma.user.create({
      data: {
        fullName: body.fullName,
        email: body.email.trim().toLowerCase(),
        phone: body.phone,
        passwordHash: '',
        role: 'Customer',
        tasteProfile: [],
        allergies: [],
      },
      select: { id: true },
    });

    res.status(201).json({ id: doc.id });
  }
);

usersRouter.get('/', requireAuth, requireRole('Manager'), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      role: u.role,
      profile: {
        fullName: u.fullName,
        email: u.email,
        phone: u.phone ?? undefined,
      },
      preferences: {
        tasteProfile: u.tasteProfile,
        allergies: u.allergies,
      },
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }))
  );
});
