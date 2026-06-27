import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth';
import { getOrderConfirmationMode } from '../orderSettings';
import { prisma } from '../prisma';

export const ordersRouter = Router();

const paymentInfoSchema = z.object({
  paymentMethod: z.enum(['COD', 'QR']).default('COD'),
  paymentStatus: z.enum(['Unpaid', 'Pending', 'Paid']).optional(),
  paymentProvider: z.string().max(80).optional(),
  paymentQrUrl: z.string().url().optional(),
  paymentContent: z.string().max(120).optional(),
});

const parsePaymentFromNote = (note?: string | null) => {
  if (!note) return {};
  const method = note.match(/Thanh toan: ([^\n]+)/)?.[1]?.trim();
  const status = note.match(/Trang thai thanh toan: ([^\n]+)/)?.[1]?.trim();
  const qrUrl = note.match(/QR: ([^\n]+)/)?.[1]?.trim();
  return {
    paymentMethod: method?.includes('QR') ? 'QR' : method ? 'COD' : undefined,
    paymentStatus: status === 'Pending' || status === 'Paid' || status === 'Unpaid' ? status : undefined,
    paymentQrUrl: qrUrl,
  };
};

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
      ...parsePaymentFromNote(o.note),
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
    .merge(paymentInfoSchema)
    .parse(req.body);

  const subtotalAmount = body.items.reduce((sum, it) => sum + it.price.amount * it.quantity, 0);
  const totalAmount = subtotalAmount + body.deliveryFee.amount;
  const confirmationMode = await getOrderConfirmationMode();
  const paymentStatus = body.paymentStatus ?? (body.paymentMethod === 'COD' ? 'Unpaid' : 'Pending');
  const initialStatus = paymentStatus === 'Paid' || (body.paymentMethod === 'COD' && confirmationMode === 'auto') ? 'Preparing' : 'Pending';
  const paymentNote = [
    body.note?.trim(),
    `Thanh toan: ${body.paymentMethod === 'QR' ? 'QR code' : 'Tien mat khi nhan hang'}`,
    `Trang thai thanh toan: ${paymentStatus}`,
    body.paymentProvider ? `Ngan hang/vi: ${body.paymentProvider}` : undefined,
    body.paymentContent ? `Noi dung CK: ${body.paymentContent}` : undefined,
    body.paymentQrUrl ? `QR: ${body.paymentQrUrl}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  const doc = await prisma.order.create({
    data: {
      userId: body.userId,
      items: body.items,
      subtotalAmount,
      deliveryFeeAmount: body.deliveryFee.amount,
      totalAmount,
      currency: 'VND',
      status: initialStatus,
      note: paymentNote,
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
