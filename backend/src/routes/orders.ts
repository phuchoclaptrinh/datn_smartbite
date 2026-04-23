import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { OrderModel } from '../models/Order';

export const ordersRouter = Router();

ordersRouter.get('/', async (req, res) => {
  const userId = z.string().min(1).parse(req.query.userId);
  const list = await OrderModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(100).lean();
  res.json(
    list.map((o) => ({
      id: o._id.toString(),
      userId: o.userId.toString(),
      items: o.items,
      subtotal: o.subtotal,
      deliveryFee: o.deliveryFee,
      total: o.total,
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

  const doc = await OrderModel.create({
    userId: new Types.ObjectId(body.userId),
    items: body.items,
    subtotal: { amount: subtotalAmount, currency: 'VND' },
    deliveryFee: body.deliveryFee,
    total: { amount: totalAmount, currency: 'VND' },
    status: 'Pending',
    note: body.note,
  });

  res.status(201).json({ id: doc._id.toString() });
});

ordersRouter.patch('/:id/status', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const body = z
    .object({
      status: z.enum(['Pending', 'Preparing', 'Delivering', 'Completed', 'Cancelled']),
    })
    .parse(req.body);

  const updated = await OrderModel.findByIdAndUpdate(id, { status: body.status }, { new: true }).lean();
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json({ ok: true });
});
