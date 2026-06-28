import { Router } from 'express';
import { z } from 'zod';
import { calculateDiscountAmount, getDiscountUnavailableReason, normalizeDiscountCode } from '../discounts';
import { prisma } from '../prisma';

export const discountsRouter = Router();

discountsRouter.post('/validate', async (req, res) => {
  const body = z
    .object({
      code: z.string().min(1),
      subtotalAmount: z.number().int().nonnegative(),
    })
    .parse(req.body);

  const code = normalizeDiscountCode(body.code);
  const campaign = await prisma.discountCampaign.findUnique({ where: { code } });
  if (!campaign) {
    res.status(404).json({ message: 'Mã giảm giá không tồn tại.' });
    return;
  }

  const reason = getDiscountUnavailableReason(campaign, body.subtotalAmount);
  if (reason) {
    res.status(400).json({ message: reason });
    return;
  }

  const discountAmount = calculateDiscountAmount(campaign, body.subtotalAmount);
  res.json({
    id: campaign.id,
    name: campaign.name,
    code: campaign.code,
    discountAmount,
    finalAmount: Math.max(0, body.subtotalAmount - discountAmount),
    discountType: campaign.discountType,
    discountValue: campaign.discountValue,
  });
});
