import { Router } from 'express';
import { prisma } from '../prisma';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ ok: true });
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: 'up' });
  } catch {
    res.status(503).json({ ok: false, database: 'down' });
  }
});
