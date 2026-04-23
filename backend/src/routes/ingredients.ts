import { Router } from 'express';
import { z } from 'zod';
import { IngredientModel } from '../models/Ingredient';

export const ingredientsRouter = Router();

ingredientsRouter.get('/', async (_req, res) => {
  const list = await IngredientModel.find().sort({ name: 1 }).limit(200).lean();
  res.json(
    list.map((i) => ({
      id: i._id.toString(),
      name: i.name,
      aliases: i.aliases,
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

  const doc = await IngredientModel.create({
    name: body.name,
    aliases: body.aliases ?? [],
  });

  res.status(201).json({ id: doc._id.toString() });
});
