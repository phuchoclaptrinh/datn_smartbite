import { Router } from 'express';
import { z } from 'zod';
import type { Recipe } from '@prisma/client';
import { prisma } from '../prisma';

export const recipesRouter = Router();

type RecipeIngredient = {
  name: string;
  quantity?: number;
  unit?: 'g' | 'ml' | 'pcs';
  optional?: boolean;
};

type SuggestionFridgeItem = {
  name: string;
  quantity: number;
  unit: 'g' | 'ml' | 'pcs';
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseIngredients = (recipe: Recipe): RecipeIngredient[] => {
  if (!Array.isArray(recipe.ingredients)) return [];
  return recipe.ingredients.filter((item): item is RecipeIngredient => {
    if (!item || typeof item !== 'object') return false;
    return typeof (item as RecipeIngredient).name === 'string';
  });
};

const ingredientMatches = (fridgeName: string, ingredientName: string) => {
  const fridge = normalize(fridgeName);
  const ingredient = normalize(ingredientName);
  return Boolean(fridge && ingredient && (fridge.includes(ingredient) || ingredient.includes(fridge)));
};

const textScore = (recipe: Recipe, query: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;
  const tokens = normalizedQuery.split(' ').filter((token) => token.length >= 2);
  const haystack = normalize(
    [
      recipe.name,
      recipe.normalizedName ?? '',
      recipe.category ?? '',
      recipe.description,
      ...recipe.tags,
      ...parseIngredients(recipe).map((item) => item.name),
    ].join(' ')
  );

  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 8 : 0), 0);
};

const toApiRecipe = (r: Recipe) => ({
  id: r.id,
  sourceId: r.sourceId,
  name: r.name,
  normalizedName: r.normalizedName,
  category: r.category,
  description: r.description,
  tags: r.tags,
  timeMin: r.timeMin,
  servings: r.servings,
  price: { amount: r.priceAmount, currency: r.currency },
  imageUrl: r.imageUrl,
  ingredients: r.ingredients,
  steps: r.steps,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const buildSuggestion = (recipe: Recipe, fridgeItems: SuggestionFridgeItem[], query: string) => {
  const ingredients = parseIngredients(recipe);
  const required = ingredients.filter((item) => !item.optional);
  const matched = ingredients.filter((ingredient) => fridgeItems.some((item) => ingredientMatches(item.name, ingredient.name)));
  const missing = required.filter((ingredient) => !fridgeItems.some((item) => ingredientMatches(item.name, ingredient.name)));
  const requiredCount = Math.max(required.length, 1);
  const percent = Math.min(100, Math.round((matched.filter((item) => !item.optional).length / requiredCount) * 100));
  const score = percent * 2 + matched.length * 12 - missing.length * 4 + textScore(recipe, query);

  return {
    recipe: toApiRecipe(recipe),
    percent,
    matched,
    missing,
    missingCount: missing.length,
    score,
  };
};

recipesRouter.get('/', async (_req, res) => {
  const list = await prisma.recipe.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(list.map(toApiRecipe));
});

recipesRouter.post('/suggestions', async (req, res) => {
  const body = z
    .object({
      query: z.string().default(''),
      fridgeItems: z
        .array(
          z.object({
            name: z.string().min(1),
            quantity: z.number().finite().nonnegative().default(0),
            unit: z.enum(['g', 'ml', 'pcs']),
          })
        )
        .default([]),
      limit: z.number().int().positive().max(50).default(30),
    })
    .parse(req.body);

  const recipes = await prisma.recipe.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  const suggestions = recipes
    .map((recipe) => buildSuggestion(recipe, body.fridgeItems, body.query))
    .filter((item) => {
      if (!body.query.trim()) return true;
      return item.score > item.percent * 2 || normalize(item.recipe.name).includes(normalize(body.query));
    })
    .sort((left, right) => right.score - left.score || left.missingCount - right.missingCount || left.recipe.name.localeCompare(right.recipe.name, 'vi'))
    .slice(0, body.limit);

  res.json(suggestions);
});

recipesRouter.post('/', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      description: z.string().min(1),
      tags: z.array(z.string().min(1)).optional(),
      timeMin: z.number().int().positive(),
      servings: z.number().int().positive(),
      priceAmount: z.number().int().nonnegative().default(0),
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

  const doc = await prisma.recipe.create({
    data: {
      name: body.name,
      description: body.description,
      tags: body.tags ?? [],
      timeMin: body.timeMin,
      servings: body.servings,
      priceAmount: body.priceAmount,
      currency: 'VND',
      imageUrl: body.imageUrl,
      ingredients: body.ingredients,
      steps: body.steps,
    },
    select: { id: true },
  });

  res.status(201).json({ id: doc.id });
});
