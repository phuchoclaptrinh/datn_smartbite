import { Router } from 'express';
import { z } from 'zod';
import { RecipeModel } from '../models/Recipe';

export const recipesRouter = Router();

recipesRouter.get('/', async (_req, res) => {
  const list = await RecipeModel.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json(
    list.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      description: r.description,
      tags: r.tags,
      timeMin: r.timeMin,
      servings: r.servings,
      imageUrl: r.imageUrl,
      ingredients: r.ingredients,
      steps: r.steps,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  );
});

recipesRouter.post('/', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      description: z.string().min(1),
      tags: z.array(z.string().min(1)).optional(),
      timeMin: z.number().int().positive(),
      servings: z.number().int().positive(),
      imageUrl: z.string().url().optional(),
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
    })
    .parse(req.body);

  const doc = await RecipeModel.create({
    name: body.name,
    description: body.description,
    tags: body.tags ?? [],
    timeMin: body.timeMin,
    servings: body.servings,
    imageUrl: body.imageUrl,
    ingredients: body.ingredients,
    steps: body.steps,
  });

  res.status(201).json({ id: doc._id.toString() });
});
