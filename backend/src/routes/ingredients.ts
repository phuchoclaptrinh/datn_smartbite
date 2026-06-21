import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

export const ingredientsRouter = Router();

ingredientsRouter.get('/', async (_req, res) => {
  const list = await prisma.ingredient.findMany({
    orderBy: { name: 'asc' },
    take: 1000,
  });
  res.json(
    list.map((i) => ({
      id: i.id,
      name: i.name,
      aliases: i.aliases,
      normalizedName: i.normalizedName,
      nameEn: i.nameEn,
      category: i.category,
      isStockManaged: i.isStockManaged,
      inventoryGroup: i.inventoryGroup,
    }))
  );
});

ingredientsRouter.post('/', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      aliases: z.array(z.string().min(1)).optional(),
    })
    .parse(req.body);

  const doc = await prisma.ingredient.create({
    data: {
      name: body.name,
      aliases: body.aliases ?? [],
    },
    select: { id: true },
  });

  res.status(201).json({ id: doc.id });
});
