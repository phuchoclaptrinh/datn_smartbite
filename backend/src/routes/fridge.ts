import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

export const fridgeRouter = Router();

const userIdSchema = z.string().min(1);

fridgeRouter.get('/', async (req, res) => {
  const userId = userIdSchema.parse(req.query.userId);
  const list = await prisma.fridgeItem.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(
    list.map((it) => ({
      id: it.id,
      userId: it.userId,
      name: it.name,
      quantity: it.quantity,
      unit: it.unit,
      expiryDate: it.expiryDate ? it.expiryDate.toISOString().slice(0, 10) : undefined,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    }))
  );
});

fridgeRouter.post('/', async (req, res) => {
  const body = z
    .object({
      userId: z.string().min(1),
      name: z.string().min(1),
      quantity: z.number().finite().positive(),
      unit: z.enum(['g', 'ml', 'pcs']),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .parse(req.body);

  const doc = await prisma.fridgeItem.create({
    data: {
      userId: body.userId,
      name: body.name,
      quantity: Math.floor(body.quantity),
      unit: body.unit,
      expiryDate: body.expiryDate ? new Date(`${body.expiryDate}T00:00:00`) : null,
    },
    select: { id: true },
  });

  res.status(201).json({ id: doc.id });
});

fridgeRouter.patch('/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const body = z
    .object({
      name: z.string().min(1).optional(),
      quantity: z.number().finite().nonnegative().optional(),
      unit: z.enum(['g', 'ml', 'pcs']).optional(),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    })
    .parse(req.body);

  try {
    await prisma.fridgeItem.update({
      where: { id },
      data: {
        name: body.name,
        quantity: body.quantity === undefined ? undefined : Math.floor(body.quantity),
        unit: body.unit,
        expiryDate:
          body.expiryDate === undefined ? undefined : body.expiryDate === null ? null : new Date(`${body.expiryDate}T00:00:00`),
      },
    });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ message: 'Not found' });
  }
});

fridgeRouter.delete('/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  try {
    await prisma.fridgeItem.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ message: 'Not found' });
  }
});
