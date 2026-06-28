import type { DiscountCampaign } from '@prisma/client';

export const normalizeDiscountCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

export const calculateDiscountAmount = (campaign: DiscountCampaign, subtotalAmount: number) => {
  if (campaign.discountType === 'Percent') {
    const raw = Math.floor((subtotalAmount * campaign.discountValue) / 100);
    return Math.max(0, Math.min(raw, campaign.maxDiscount ?? raw, subtotalAmount));
  }

  return Math.max(0, Math.min(campaign.discountValue, subtotalAmount));
};

export const getDiscountUnavailableReason = (campaign: DiscountCampaign, subtotalAmount: number, now = new Date()) => {
  if (!campaign.isActive) return 'Mã giảm giá đang tắt.';
  if (campaign.startsAt && campaign.startsAt > now) return 'Mã giảm giá chưa bắt đầu.';
  if (campaign.endsAt && campaign.endsAt < now) return 'Mã giảm giá đã hết hạn.';
  if (campaign.usageLimit !== null && campaign.usedCount >= campaign.usageLimit) return 'Mã giảm giá đã hết lượt sử dụng.';
  if (subtotalAmount < campaign.minOrderAmount) return `Đơn hàng cần tối thiểu ${campaign.minOrderAmount.toLocaleString('vi-VN')} đ để dùng mã này.`;
  return null;
};
