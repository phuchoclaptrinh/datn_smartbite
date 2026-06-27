import { Request, Router } from 'express';
import { z } from 'zod';
import { env } from '../env';
import { prisma } from '../prisma';

export const paymentWebhooksRouter = Router();

const webhookSchema = z
  .object({
    amount: z.coerce.number().int().positive().optional(),
    transferAmount: z.coerce.number().int().positive().optional(),
    money: z.coerce.number().int().positive().optional(),
    description: z.string().optional(),
    content: z.string().optional(),
    transactionId: z.string().optional(),
    reference: z.string().optional(),
    referenceCode: z.string().optional(),
    bankCode: z.string().optional(),
    gateway: z.string().optional(),
    accountNumber: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

const getWebhookSecret = (req: Request) => {
  const authorization = req.header('authorization') ?? '';
  const apiKey = authorization.match(/^Apikey\s+(.+)$/i)?.[1]?.trim();
  return req.header('x-webhook-secret') ?? req.header('x-api-key') ?? apiKey ?? req.query.secret;
};

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase();
const normalizePaymentCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const extractPaymentContent = (note?: string | null) => note?.match(/Noi dung CK: ([^\n]+)/)?.[1]?.trim();

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

const getPayloadCandidates = (raw: unknown) => {
  const root = asRecord(raw);
  const data = root.data;
  const candidates: unknown[] = [root];
  if (Array.isArray(data)) candidates.push(...data);
  else if (data) candidates.push(data);
  return candidates;
};

const parseTransaction = (raw: unknown) => {
  for (const candidate of getPayloadCandidates(raw)) {
    const parsed = webhookSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const amount = parsed.data.amount ?? parsed.data.transferAmount ?? parsed.data.money;
    const description = parsed.data.description ?? parsed.data.content ?? '';
    if (amount && description.trim()) return { ...parsed.data, amount, description };
  }
  return null;
};

const markQrPaymentPaid = (note: string, input: { transactionId?: string; bankCode?: string; amount: number; matchReason: string }) => {
  const lines = note
    .split('\n')
    .filter(
      (line) =>
        !line.startsWith('Trang thai thanh toan:') &&
        !line.startsWith('Ma giao dich NH:') &&
        !line.startsWith('Ngan hang webhook:') &&
        !line.startsWith('So tien da nhan:') &&
        !line.startsWith('Kieu doi soat:') &&
        !line.startsWith('Thoi gian xac nhan:')
    );

  lines.push('Trang thai thanh toan: Paid');
  if (input.transactionId) lines.push(`Ma giao dich NH: ${input.transactionId}`);
  if (input.bankCode) lines.push(`Ngan hang webhook: ${input.bankCode}`);
  lines.push(`So tien da nhan: ${input.amount}`);
  lines.push(`Kieu doi soat: ${input.matchReason}`);
  lines.push(`Thoi gian xac nhan: ${new Date().toISOString()}`);

  return lines.join('\n');
};

paymentWebhooksRouter.post('/bank-webhook', async (req, res) => {
  if (env.BANK_WEBHOOK_SECRET && getWebhookSecret(req) !== env.BANK_WEBHOOK_SECRET) {
    res.status(401).json({ message: 'Invalid webhook secret' });
    return;
  }

  const body = parseTransaction(req.body);
  if (!body) {
    res.status(400).json({ message: 'Missing amount or description' });
    return;
  }

  const normalizedDescription = normalizeText(body.description);
  const normalizedDescriptionCode = normalizePaymentCode(body.description);
  const transactionId = body.transactionId ?? body.reference ?? body.referenceCode;
  const candidates = await prisma.order.findMany({
    where: {
      totalAmount: body.amount,
      status: 'Pending',
      note: {
        contains: 'Thanh toan: QR code',
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  let matchReason = 'payment-content';
  let matchedOrder = candidates.find((order) => {
    const note = order.note ?? '';
    if (!note.includes('Trang thai thanh toan: Pending')) return false;
    const paymentContent = extractPaymentContent(note);
    if (!paymentContent) return false;
    return normalizedDescription.includes(normalizeText(paymentContent)) || normalizedDescriptionCode.includes(normalizePaymentCode(paymentContent));
  });

  if (!matchedOrder && normalizedDescriptionCode.includes('SMARTBITE')) {
    const recentCandidates = candidates.filter((order) => Date.now() - order.createdAt.getTime() <= 60 * 60 * 1000);
    if (recentCandidates.length === 1) {
      matchedOrder = recentCandidates[0];
      matchReason = 'single-recent-amount';
    }
  }

  if (!matchedOrder) {
    res.json({
      ok: true,
      matched: false,
      message: 'Webhook received, but no pending QR order matched this transaction',
      amount: body.amount,
      candidateCount: candidates.length,
      smartbiteDetected: normalizedDescriptionCode.includes('SMARTBITE'),
    });
    return;
  }

  const updated = await prisma.order.update({
    where: { id: matchedOrder.id },
    data: {
      status: 'Preparing',
      note: markQrPaymentPaid(matchedOrder.note ?? '', {
        amount: body.amount,
        transactionId,
        bankCode: body.bankCode ?? body.gateway,
        matchReason,
      }),
    },
    select: { id: true, status: true, totalAmount: true },
  });

  res.json({ ok: true, matched: true, matchReason, orderId: updated.id, status: updated.status, amount: updated.totalAmount });
});
