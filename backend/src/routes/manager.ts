import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth';
import { prisma } from '../prisma';

export const managerRouter = Router();

managerRouter.use(requireAuth, requireRole('Manager'));

managerRouter.get('/dashboard', async (_req, res) => {
  const [customerCount, ingredientCount, orderCount, pendingOrderCount, completedRevenue] = await Promise.all([
    prisma.user.count({ where: { role: 'Customer' } }),
    prisma.ingredient.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'Pending' } }),
    prisma.order.aggregate({ where: { status: 'Completed' }, _sum: { totalAmount: true } }),
  ]);

  res.json({
    customerCount,
    ingredientCount,
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
    res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
  }
});

managerRouter.get('/inventory', async (_req, res) => {
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: 'asc' }, take: 500 });
  res.json(ingredients);
});

managerRouter.post('/inventory', async (req, res) => {
  const body = z.object({ name: z.string().min(1), aliases: z.array(z.string().min(1)).default([]) }).parse(req.body);
  try {
    const ingredient = await prisma.ingredient.create({
      data: { name: body.name.trim(), aliases: body.aliases.map((item) => item.trim()) },
    });
    res.status(201).json(ingredient);
  } catch {
    res.status(409).json({ message: 'Nguyên liệu đã tồn tại' });
  }
});

managerRouter.patch('/inventory/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const body = z.object({ name: z.string().min(1).optional(), aliases: z.array(z.string().min(1)).optional() }).parse(req.body);
  try {
    const ingredient = await prisma.ingredient.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        aliases: body.aliases?.map((item) => item.trim()),
      },
    });
    res.json(ingredient);
  } catch {
    res.status(404).json({ message: 'Không tìm thấy nguyên liệu' });
  }
});

managerRouter.delete('/inventory/:id', async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  try {
    await prisma.ingredient.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ message: 'Không tìm thấy nguyên liệu' });
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
