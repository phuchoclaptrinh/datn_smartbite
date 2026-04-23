import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { FridgeItemModel } from '../models/FridgeItem';

export const fridgeRouter = Router();

const userIdSchema = z.string().min(1);

fridgeRouter.get('/', async (req, res) => {
  const userId = userIdSchema.parse(req.query.userId);
  const list = await FridgeItemModel.find({ userId: new Types.ObjectId(userId) }).sort({ updatedAt: -1 }).lean();
  res.json(
    list.map((it) => ({
      id: it._id.toString(),
      userId: it.userId.toString(),
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

  const doc = await FridgeItemModel.create({
    userId: new Types.ObjectId(body.userId),
    name: body.name,
    quantity: Math.floor(body.quantity),
    unit: body.unit,
    expiryDate: body.expiryDate ? new Date(`${body.expiryDate}T00:00:00`) : undefined,
  });

  res.status(201).json({ id: doc._id.toString() });
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

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.quantity !== undefined) patch.quantity = Math.floor(body.quantity);
  if (body.unit !== undefined) patch.unit = body.unit;
  if (body.expiryDate !== undefined) {
    patch.expiryDate = body.expiryDate === null ? undefined : new Date(`${body.expiryDate}T00:00:00`);
  }

  const updated = await FridgeItemModel.findByIdAndUpdate(id, patch, { new: true }).lean();
  if (!updated) return res.status(404).json({ message: 'Not found' });

  res.json({ ok: true });
});

fridgeRouter.delete('/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const r = await FridgeItemModel.findByIdAndDelete(id).lean();
  if (!r) return res.status(404).json({ message: 'Not found' });
  res.json({ ok: true });
});
