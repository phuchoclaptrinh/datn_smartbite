import { prisma } from './prisma';

export type OrderConfirmationMode = 'manual' | 'auto';

export const ORDER_CONFIRMATION_SETTING_KEY = 'orderConfirmationMode';

export const getOrderConfirmationMode = async (): Promise<OrderConfirmationMode> => {
  const setting = await prisma.appSetting.findUnique({ where: { key: ORDER_CONFIRMATION_SETTING_KEY } });
  return setting?.value === 'auto' ? 'auto' : 'manual';
};

export const setOrderConfirmationMode = async (mode: OrderConfirmationMode) =>
  prisma.appSetting.upsert({
    where: { key: ORDER_CONFIRMATION_SETTING_KEY },
    update: { value: mode },
    create: { key: ORDER_CONFIRMATION_SETTING_KEY, value: mode },
  });
