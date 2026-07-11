import { Router } from 'express';
import { z } from 'zod';
import type { DiscountCampaign, Recipe } from '@prisma/client';
import { requireAuth, requireRole } from '../auth';
import { normalizeDiscountCode } from '../discounts';
import { getOrderConfirmationMode, setOrderConfirmationMode } from '../orderSettings';
import { prisma } from '../prisma';

export const managerRouter = Router();

managerRouter.use(requireAuth, requireRole('Manager'));

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const toClosingDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const todayString = () => new Date().toISOString().slice(0, 10);

managerRouter.get('/settings', async (_req, res) => {
  res.json({ orderConfirmationMode: await getOrderConfirmationMode() });
});

managerRouter.patch('/settings', async (req, res) => {
  const body = z.object({ orderConfirmationMode: z.enum(['manual', 'auto']) }).parse(req.body);
  await setOrderConfirmationMode(body.orderConfirmationMode);
  res.json({ orderConfirmationMode: body.orderConfirmationMode });
});

const discountBodySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().max(300).optional().or(z.literal('')),
  discountType: z.enum(['Percent', 'Fixed']),
  discountValue: z.number().int().positive(),
  minOrderAmount: z.number().int().nonnegative().default(0),
  maxDiscount: z.number().int().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

const toDiscountDto = (campaign: DiscountCampaign) => ({
  id: campaign.id,
  name: campaign.name,
  code: campaign.code,
  description: campaign.description,
  discountType: campaign.discountType,
  discountValue: campaign.discountValue,
  minOrderAmount: campaign.minOrderAmount,
  maxDiscount: campaign.maxDiscount,
  usageLimit: campaign.usageLimit,
  usedCount: campaign.usedCount,
  isActive: campaign.isActive,
  startsAt: campaign.startsAt,
  endsAt: campaign.endsAt,
  createdAt: campaign.createdAt,
  updatedAt: campaign.updatedAt,
});

managerRouter.get('/discounts', async (_req, res) => {
  const campaigns = await prisma.discountCampaign.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 });
  res.json(campaigns.map(toDiscountDto));
});

managerRouter.post('/discounts', async (req, res) => {
  const body = discountBodySchema.parse(req.body);
  try {
    const campaign = await prisma.discountCampaign.create({
      data: {
        name: body.name.trim(),
        code: normalizeDiscountCode(body.code),
        description: body.description?.trim() || null,
        discountType: body.discountType,
        discountValue: body.discountValue,
        minOrderAmount: body.minOrderAmount,
        maxDiscount: body.maxDiscount ?? null,
        usageLimit: body.usageLimit ?? null,
        isActive: body.isActive,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
    });
    res.status(201).json(toDiscountDto(campaign));
  } catch {
    res.status(409).json({ message: 'Mã giảm giá đã tồn tại.' });
  }
});

managerRouter.patch('/discounts/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const body = discountBodySchema.partial().parse(req.body);
  try {
    const campaign = await prisma.discountCampaign.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        code: body.code === undefined ? undefined : normalizeDiscountCode(body.code),
        description: body.description === undefined ? undefined : body.description.trim() || null,
        discountType: body.discountType,
        discountValue: body.discountValue,
        minOrderAmount: body.minOrderAmount,
        maxDiscount: body.maxDiscount === undefined ? undefined : body.maxDiscount ?? null,
        usageLimit: body.usageLimit === undefined ? undefined : body.usageLimit ?? null,
        isActive: body.isActive,
        startsAt: body.startsAt === undefined ? undefined : body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt === undefined ? undefined : body.endsAt ? new Date(body.endsAt) : null,
      },
    });
    res.json(toDiscountDto(campaign));
  } catch {
    res.status(404).json({ message: 'Không tìm thấy mã giảm giá.' });
  }
});

managerRouter.delete('/discounts/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  try {
    await prisma.discountCampaign.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ message: 'Không tìm thấy mã giảm giá.' });
  }
});

managerRouter.get('/dashboard', async (_req, res) => {
  const [customerCount, ingredients, orderCount, pendingOrderCount, completedRevenue] = await Promise.all([
    prisma.user.count({ where: { role: 'Customer' } }),
    prisma.ingredient.findMany({ where: { isStockManaged: true }, select: { stockQuantity: true, minStock: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'Pending' } }),
    prisma.order.aggregate({ where: { status: 'Completed' }, _sum: { totalAmount: true } }),
  ]);

  res.json({
    customerCount,
    ingredientCount: ingredients.length,
    outOfStockCount: ingredients.filter((item) => item.stockQuantity === 0).length,
    lowStockCount: ingredients.filter((item) => item.stockQuantity > 0 && item.stockQuantity <= item.minStock).length,
    orderCount,
    pendingOrderCount,
    completedRevenue: completedRevenue._sum.totalAmount ?? 0,
    currency: 'VND',
  });
});

managerRouter.get('/orders', async (_req, res) => {
  const orders = await prisma.order.findMany({
    include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  res.json(
    orders.map((order) => ({
      id: order.id,
      customer: order.user,
      items: order.items,
      subtotalAmount: order.subtotalAmount,
      deliveryFeeAmount: order.deliveryFeeAmount,
      totalAmount: order.totalAmount,
      currency: order.currency,
      status: order.status,
      note: order.note,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }))
  );
});

managerRouter.patch('/orders/:id/status', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const body = z
    .object({ status: z.enum(['Pending', 'Preparing', 'Delivering', 'Completed', 'Cancelled']) })
    .parse(req.body);

  try {
    const order = await prisma.order.update({ where: { id }, data: { status: body.status }, select: { id: true, status: true } });
    res.json(order);
  } catch {
    res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng' });
  }
});


const menuBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().max(80).optional(),
  tags: z.array(z.string().min(1)).default([]),
  timeMin: z.number().int().positive().default(30),
  servings: z.number().int().positive().default(1),
  priceAmount: z.number().int().nonnegative(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().finite().positive().optional(),
        unit: z.enum(['g', 'ml', 'pcs']).optional(),
        optional: z.boolean().optional(),
      })
    )
    .default([]),
  steps: z.array(z.string().min(1)).default([]),
});

const toMenuItem = (recipe: Recipe) => ({
  id: recipe.id,
  sourceId: recipe.sourceId,
  name: recipe.name,
  category: recipe.category,
  description: recipe.description,
  tags: recipe.tags,
  timeMin: recipe.timeMin,
  servings: recipe.servings,
  price: { amount: recipe.priceAmount, currency: recipe.currency },
  imageUrl: recipe.imageUrl,
  ingredients: recipe.ingredients,
  steps: recipe.steps,
  createdAt: recipe.createdAt,
  updatedAt: recipe.updatedAt,
});

managerRouter.get('/menu', async (_req, res) => {
  const recipes = await prisma.recipe.findMany({
    where: { priceAmount: { gt: 0 } },
    orderBy: { updatedAt: 'desc' },
    take: 300,
  });
  res.json(recipes.map(toMenuItem));
});

managerRouter.post('/menu', async (req, res) => {
  const body = menuBodySchema.parse(req.body);
  const recipe = await prisma.recipe.create({
    data: {
      name: body.name.trim(),
      normalizedName: body.name.trim().toLowerCase(),
      category: body.category?.trim() || null,
      description: body.description.trim(),
      tags: body.tags.map((item) => item.trim()).filter(Boolean),
      timeMin: body.timeMin,
      servings: body.servings,
      priceAmount: body.priceAmount,
      currency: 'VND',
      imageUrl: body.imageUrl?.trim() || null,
      ingredients: body.ingredients,
      steps: body.steps,
    },
  });
  res.status(201).json(toMenuItem(recipe));
});

managerRouter.patch('/menu/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const body = menuBodySchema.partial().parse(req.body);
  try {
    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        normalizedName: body.name?.trim().toLowerCase(),
        category: body.category?.trim() || undefined,
        description: body.description?.trim(),
        tags: body.tags?.map((item) => item.trim()).filter(Boolean),
        timeMin: body.timeMin,
        servings: body.servings,
        priceAmount: body.priceAmount,
        imageUrl: body.imageUrl === undefined ? undefined : body.imageUrl.trim() || null,
        ingredients: body.ingredients,
        steps: body.steps,
      },
    });
    res.json(toMenuItem(recipe));
  } catch {
    res.status(404).json({ message: 'Không tìm thấy món' });
  }
});

managerRouter.delete('/menu/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  try {
    await prisma.recipe.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ message: 'Không tìm thấy món' });
  }
});
managerRouter.get('/inventory', async (_req, res) => {
  const ingredients = await prisma.ingredient.findMany({ where: { isStockManaged: true }, orderBy: { name: 'asc' }, take: 500 });
  res.json(ingredients);
});

managerRouter.post('/inventory', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      aliases: z.array(z.string().min(1)).default([]),
      stockQuantity: z.number().int().nonnegative().default(0),
      unit: z.enum(['g', 'ml', 'pcs']).default('pcs'),
      minStock: z.number().int().nonnegative().default(0),
      inventoryGroup: z.enum(['Main', 'Auxiliary', 'Vegetable', 'Fruit', 'Staple', 'Sauce', 'Other']).default('Other'),
    })
    .parse(req.body);
  try {
    const ingredient = await prisma.ingredient.create({
      data: {
        name: body.name.trim(),
        aliases: body.aliases.map((item) => item.trim()),
        stockQuantity: body.stockQuantity,
        unit: body.unit,
        minStock: body.minStock,
        inventoryGroup: body.inventoryGroup,
      },
    });
    res.status(201).json(ingredient);
  } catch {
    res.status(409).json({ message: 'NguyÃªn liá»‡u Ä‘Ã£ tá»“n táº¡i' });
  }
});

managerRouter.patch('/inventory/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const body = z
    .object({
      name: z.string().min(1).optional(),
      aliases: z.array(z.string().min(1)).optional(),
      stockQuantity: z.number().int().nonnegative().optional(),
      unit: z.enum(['g', 'ml', 'pcs']).optional(),
      minStock: z.number().int().nonnegative().optional(),
      inventoryGroup: z.enum(['Main', 'Auxiliary', 'Vegetable', 'Fruit', 'Staple', 'Sauce', 'Other']).optional(),
    })
    .parse(req.body);
  try {
    const ingredient = await prisma.ingredient.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        aliases: body.aliases?.map((item) => item.trim()),
        stockQuantity: body.stockQuantity,
        unit: body.unit,
        minStock: body.minStock,
        inventoryGroup: body.inventoryGroup,
      },
    });
    res.json(ingredient);
  } catch {
    res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y nguyÃªn liá»‡u' });
  }
});

managerRouter.patch('/inventory/:id/adjust', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const body = z.object({ delta: z.number().int().refine((value) => value !== 0) }).parse(req.body);
  const current = await prisma.ingredient.findUnique({ where: { id } });
  if (!current) {
    res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y nguyÃªn liá»‡u' });
    return;
  }

  const stockQuantity = current.stockQuantity + body.delta;
  if (stockQuantity < 0) {
    res.status(400).json({ message: 'Sá»‘ lÆ°á»£ng xuáº¥t vÆ°á»£t quÃ¡ tá»“n kho' });
    return;
  }

  const ingredient = await prisma.$transaction(async (tx) => {
    const updated = await tx.ingredient.update({ where: { id }, data: { stockQuantity } });
    await tx.inventoryMovement.create({
      data: {
        ingredientId: id,
        type: body.delta > 0 ? 'Import' : 'Export',
        quantityDelta: body.delta,
        note: body.delta > 0 ? 'Nháº­p kho nhanh' : 'Xuáº¥t kho nhanh',
      },
    });
    return updated;
  });
  res.json(ingredient);
});

managerRouter.get('/inventory/closing/today', async (req, res) => {
  const date = dateSchema.default(todayString()).parse(req.query.date);
  const closingDate = toClosingDate(date);
  const [ingredients, closing] = await Promise.all([
    prisma.ingredient.findMany({ where: { isStockManaged: true }, orderBy: { name: 'asc' } }),
    prisma.inventoryClosing.findUnique({
      where: { closingDate },
      include: { items: { include: { ingredient: { select: { name: true } } }, orderBy: { ingredient: { name: 'asc' } } } },
    }),
  ]);

  res.json({
    date,
    closed: !!closing,
    closing: closing
      ? {
          id: closing.id,
          note: closing.note,
          createdAt: closing.createdAt,
          items: closing.items.map((item) => ({
            ingredientId: item.ingredientId,
            name: item.ingredient.name,
            expectedQuantity: item.expectedQuantity,
            actualQuantity: item.actualQuantity,
            variance: item.variance,
            unit: item.unit,
          })),
        }
      : null,
    inventory: ingredients.map((item) => ({
      ingredientId: item.id,
      name: item.name,
      expectedQuantity: item.stockQuantity,
      unit: item.unit,
      minStock: item.minStock,
    })),
  });
});

managerRouter.post('/inventory/closing', async (req, res) => {
  const body = z
    .object({
      date: dateSchema.default(todayString()),
      note: z.string().max(500).optional(),
      items: z.array(z.object({ ingredientId: z.string().min(1), actualQuantity: z.number().int().nonnegative() })).min(1),
    })
    .parse(req.body);

  const uniqueIds = new Set(body.items.map((item) => item.ingredientId));
  if (uniqueIds.size !== body.items.length) {
    res.status(400).json({ message: 'Danh sÃ¡ch kiá»ƒm kho cÃ³ nguyÃªn liá»‡u trÃ¹ng láº·p' });
    return;
  }

  const actualById = new Map(body.items.map((item) => [item.ingredientId, item.actualQuantity]));
  const closingDate = toClosingDate(body.date);

  const existingClosing = await prisma.inventoryClosing.findUnique({
    where: { closingDate },
    include: { items: true },
  });

  const ingredients = existingClosing
    ? await prisma.ingredient.findMany({ where: { id: { in: body.items.map((item) => item.ingredientId) } }, orderBy: { name: 'asc' } })
    : await prisma.ingredient.findMany({ where: { isStockManaged: true }, orderBy: { name: 'asc' } });

  if (existingClosing) {
    const closingItemIds = new Set(existingClosing.items.map((item) => item.ingredientId));
    if (closingItemIds.size !== body.items.length || body.items.some((item) => !closingItemIds.has(item.ingredientId))) {
      res.status(400).json({ message: 'Cần kiểm đếm đầy đủ các nguyên liệu đã có trong phiếu chốt kho' });
      return;
    }
    if (ingredients.length !== body.items.length) {
      res.status(400).json({ message: 'Một số nguyên liệu trong phiếu chốt kho không còn tồn tại' });
      return;
    }
  } else if (ingredients.length !== body.items.length || ingredients.some((ingredient) => !uniqueIds.has(ingredient.id))) {
    res.status(400).json({ message: 'Cần kiểm đếm đầy đủ tất cả nguyên liệu trong kho' });
    return;
  }

  const closing = await prisma.$transaction(
    async (tx) => {
      if (existingClosing) {
        await tx.inventoryClosing.update({
          where: { id: existingClosing.id },
          data: { note: body.note?.trim() || null },
        });

        const oldItems = new Map(existingClosing.items.map((item) => [item.ingredientId, item]));

        for (const ingredient of ingredients) {
          const oldItem = oldItems.get(ingredient.id)!;
          const actualQuantity = actualById.get(ingredient.id)!;
          const variance = actualQuantity - oldItem.expectedQuantity;
          const stockDelta = actualQuantity - ingredient.stockQuantity;

          await tx.inventoryClosingItem.update({
            where: { closingId_ingredientId: { closingId: existingClosing.id, ingredientId: ingredient.id } },
            data: { actualQuantity, variance, unit: ingredient.unit },
          });

          await tx.ingredient.update({ where: { id: ingredient.id }, data: { stockQuantity: actualQuantity } });

          if (stockDelta !== 0) {
            await tx.inventoryMovement.create({
              data: {
                ingredientId: ingredient.id,
                type: 'Adjustment',
                quantityDelta: stockDelta,
                note: `Chốt lại cuối ngày ${body.date}`,
              },
            });
          }
        }

        return tx.inventoryClosing.findUniqueOrThrow({
          where: { id: existingClosing.id },
          include: { items: true },
        });
      }

        const created = await tx.inventoryClosing.create({
          data: {
            closingDate,
            createdById: req.authUser!.id,
            note: body.note?.trim() || null,
            items: {
              create: ingredients.map((ingredient) => {
                const actualQuantity = actualById.get(ingredient.id)!;
                return {
                  ingredientId: ingredient.id,
                  expectedQuantity: ingredient.stockQuantity,
                  actualQuantity,
                  variance: actualQuantity - ingredient.stockQuantity,
                  unit: ingredient.unit,
                };
              }),
            },
          },
          include: { items: true },
        });

        for (const ingredient of ingredients) {
          const actualQuantity = actualById.get(ingredient.id)!;
          const variance = actualQuantity - ingredient.stockQuantity;
          await tx.ingredient.update({ where: { id: ingredient.id }, data: { stockQuantity: actualQuantity } });
          if (variance !== 0) {
            await tx.inventoryMovement.create({
              data: {
                ingredientId: ingredient.id,
                type: 'Adjustment',
                quantityDelta: variance,
                note: `Äá»‘i soÃ¡t cuá»‘i ngÃ y ${body.date}`,
              },
            });
          }
        }

        return created;
      },
      { isolationLevel: 'Serializable' }
  );

    const totalVariance = closing.items.reduce((sum, item) => sum + Math.abs(item.variance), 0);
    const mismatchCount = closing.items.filter((item) => item.variance !== 0).length;
    res.status(existingClosing ? 200 : 201).json({ id: closing.id, date: body.date, itemCount: closing.items.length, mismatchCount, totalVariance });
});

managerRouter.get('/inventory/analysis', async (req, res) => {
  const days = z.coerce.number().int().min(1).max(30).default(7).parse(req.query.days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [ingredients, exportMovements, closingItems, latestClosing] = await Promise.all([
    prisma.ingredient.findMany({ where: { isStockManaged: true }, orderBy: { name: 'asc' } }),
    prisma.inventoryMovement.findMany({ where: { type: 'Export', createdAt: { gte: since } }, select: { ingredientId: true, quantityDelta: true } }),
    prisma.inventoryClosingItem.findMany({
      where: { closing: { closingDate: { gte: since } } },
      select: { ingredientId: true, variance: true },
    }),
    prisma.inventoryClosing.findFirst({ orderBy: { closingDate: 'desc' }, select: { closingDate: true, createdAt: true } }),
  ]);

  const usage = new Map<string, number>();
  for (const movement of exportMovements) usage.set(movement.ingredientId, (usage.get(movement.ingredientId) ?? 0) + Math.abs(movement.quantityDelta));
  const variance = new Map<string, { total: number; count: number }>();
  for (const item of closingItems) {
    const current = variance.get(item.ingredientId) ?? { total: 0, count: 0 };
    variance.set(item.ingredientId, { total: current.total + Math.abs(item.variance), count: current.count + 1 });
  }

  const riskOrder = { Out: 0, Low: 1, Watch: 2, Good: 3 } as const;
  type InventoryRisk = keyof typeof riskOrder;
  const analysis = ingredients.map((ingredient) => {
    const averageDailyUsage = Math.ceil((usage.get(ingredient.id) ?? 0) / days);
    const varianceData = variance.get(ingredient.id);
    const averageVariance = varianceData ? Math.round(varianceData.total / varianceData.count) : 0;
    const targetStock = Math.max(ingredient.minStock * 2, averageDailyUsage * 3);
    const suggestedImport = Math.max(0, targetStock - ingredient.stockQuantity);
    const risk: InventoryRisk = ingredient.stockQuantity === 0 ? 'Out' : ingredient.stockQuantity <= ingredient.minStock ? 'Low' : suggestedImport > 0 ? 'Watch' : 'Good';
    return {
      ingredientId: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      currentStock: ingredient.stockQuantity,
      minStock: ingredient.minStock,
      averageDailyUsage,
      averageVariance,
      suggestedImport,
      risk,
    };
  });

  analysis.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk] || b.suggestedImport - a.suggestedImport);
  res.json({ days, latestClosing, items: analysis });
});

managerRouter.delete('/inventory/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  try {
    await prisma.ingredient.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y nguyÃªn liá»‡u' });
  }
});

managerRouter.get('/customers', async (_req, res) => {
  const customers = await prisma.user.findMany({
    where: { role: 'Customer' },
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  res.json(
    customers.map((customer) => ({
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      orderCount: customer._count.orders,
      createdAt: customer.createdAt,
    }))
  );
});



