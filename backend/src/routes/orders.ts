import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth';
import { prisma } from '../prisma';

export const ordersRouter = Router();

ordersRouter.get('/', async (req, res) => {
  const userId = z.string().min(1).parse(req.query.userId);
  const list = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(
    list.map((o) => ({
      id: o.id,
      userId: o.userId,
      items: o.items,
      subtotal: { amount: o.subtotalAmount, currency: o.currency },
      deliveryFee: { amount: o.deliveryFeeAmount, currency: o.currency },
      total: { amount: o.totalAmount, currency: o.currency },
      status: o.status,
      note: o.note,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }))
  );
});

ordersRouter.post('/', async (req, res) => {
  const body = z
    .object({
      userId: z.string().min(1),
      items: z.array(
        z.object({
          dishId: z.string().min(1),
          name: z.string().min(1),
          quantity: z.number().int().positive(),
          price: z.object({ amount: z.number().int().nonnegative(), currency: z.literal('VND') }),
        })
      ),
      deliveryFee: z.object({ amount: z.number().int().nonnegative(), currency: z.literal('VND') }),
      note: z.string().max(200).optional(),
    })
    .parse(req.body);

  const subtotalAmount = body.items.reduce((sum, it) => sum + it.price.amount * it.quantity, 0);
  const totalAmount = subtotalAmount + body.deliveryFee.amount;

  const doc = await prisma.order.create({
    data: {
      userId: body.userId,
      items: body.items,
      subtotalAmount,
      deliveryFeeAmount: body.deliveryFee.amount,
      totalAmount,
      currency: 'VND',
      status: 'Pending',
      note: body.note,
    },
    select: { id: true },
  });

  res.status(201).json({ id: doc.id });
});

ordersRouter.patch('/:id/status', requireAuth, requireRole('Manager'), async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const body = z
    .object({
      status: z.enum(['Pending', 'Preparing', 'Delivering', 'Completed', 'Cancelled']),
    })
    .parse(req.body);

  try {
    await prisma.order.update({
      where: { id },
      data: { status: body.status },
    });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ message: 'Not found' });
  }
});
