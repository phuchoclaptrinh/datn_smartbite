import { Router } from 'express';
import { z } from 'zod';
import { calculateDiscountAmount, getDiscountUnavailableReason, normalizeDiscountCode } from '../discounts';
import { prisma } from '../prisma';

export const discountsRouter = Router();

discountsRouter.get('/', async (req, res) => {
  const subtotalAmount = z.coerce.number().int().nonnegative().default(0).parse(req.query.subtotalAmount);
  const campaigns = await prisma.discountCampaign.findMany({
    where: { isActive: true },
    orderBy: [{ updatedAt: 'desc' }],
    take: 50,
  });

  res.json(
    campaigns.map((campaign) => {
      const unavailableReason = getDiscountUnavailableReason(campaign, subtotalAmount);
      const discountAmount = unavailableReason ? 0 : calculateDiscountAmount(campaign, subtotalAmount);
      return {
        id: campaign.id,
        name: campaign.name,
        code: campaign.code,
        description: campaign.description,
        discountAmount,
        finalAmount: Math.max(0, subtotalAmount - discountAmount),
        discountType: campaign.discountType,
        discountValue: campaign.discountValue,
        minOrderAmount: campaign.minOrderAmount,
        maxDiscount: campaign.maxDiscount,
        unavailableReason,
      };
    })
  );
});

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
