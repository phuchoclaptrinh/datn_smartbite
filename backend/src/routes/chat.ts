import type { FridgeItem, Recipe } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env';
import { prisma } from '../prisma';

export const chatRouter = Router();

type RecipeIngredient = {
  name: string;
  quantity?: number;
  unit?: string;
  optional?: boolean;
};

type ChatAction = {
  type: 'ADD_TO_CART' | 'OPEN_CART';
  dishId?: string;
  quantity?: number;
};

type ChatDish = {
  id: string;
  name: string;
  description: string;
  price: { amount: number; currency: 'VND' };
  tags: string[];
  imageUrl?: string;
};

type CookingSuggestion = {
  recipeId: string;
  name: string;
  description: string;
  timeMin: number;
  servings: number;
  matchedIngredients: string[];
  missingIngredients: string[];
};

type ChatResponse = {
  message: string;
  suggestedDishIds: string[];
  suggestedDishes: ChatDish[];
  cookingSuggestions: CookingSuggestion[];
  actions: ChatAction[];
  sources: string[];
  mode: 'gemini-rag' | 'local-rag';
};

type GeminiPayload = {
  message?: string;
  suggestedDishIds?: string[];
  cookingRecipeIds?: string[];
  actions?: ChatAction[];
  sources?: string[];
};

type GeminiCallResult =
  | { ok: true; text: string; model: string }
  | { ok: false; status: number; errorText: string; model: string };

const GEMINI_TIMEOUT_MS = 30000;
const GEMINI_RETRY_DELAYS_MS = [700, 1500, 3000];
const GEMINI_TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const stopWords = new Set(['toi', 'muon', 'mon', 'an', 'cho', 'voi', 'va', 'co', 'the', 'gi', 'nao', 'mot', 'hay', 'giup', 'minh', 'tu', 'trong']);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const meaningfulTokens = (value: string) =>
  normalize(value)
    .split(' ')
    .filter((token) => token.length > 1 && !stopWords.has(token));

const parseIngredients = (recipe: Recipe): RecipeIngredient[] => {
  if (!Array.isArray(recipe.ingredients)) return [];
  return recipe.ingredients.filter((item): item is RecipeIngredient => {
    return Boolean(item && typeof item === 'object' && 'name' in item && typeof item.name === 'string');
  });
};

const recipeSearchText = (recipe: Recipe) =>
  [recipe.name, recipe.normalizedName ?? '', recipe.category ?? '', recipe.description, ...recipe.tags, ...parseIngredients(recipe).map((item) => item.name)].join(' ');

const textScore = (recipe: Recipe, message: string) => {
  const query = normalize(message);
  const haystack = normalize(recipeSearchText(recipe));
  const name = normalize(recipe.name);
  const tokens = meaningfulTokens(message);
  let score = 0;

  if (query && name === query) score += 100;
  if (query && name.includes(query)) score += 45;
  if (query && haystack.includes(query)) score += 25;
  for (const token of tokens) {
    if (name.includes(token)) score += 8;
    else if (haystack.includes(token)) score += 3;
  }

  if (/giau dam|protein|tap gym/.test(query) && /bo|ga|heo|tom|muc|ca|trung|dau hu/.test(haystack)) score += 16;
  if (/chay|rau cu|thanh dam/.test(query) && /chay|rau|nam|dau hu/.test(haystack)) score += 16;
  if (/cay|sa te|muoi ot/.test(query) && /cay|sa te|muoi ot|kim chi/.test(haystack)) score += 14;
  if (/hai san/.test(query) && /tom|muc|ca|ghe|cua|hau|hai san/.test(haystack)) score += 16;
  if (/lau/.test(query) && normalize(recipe.category ?? '').includes('lau')) score += 20;

  return score;
};

const isOrderIntent = (message: string) => /\b(dat|them|mua|order)\b/.test(normalize(message));
const isCookingIntent = (message: string) => /\b(nau|lam|cong thuc|tu lanh|nguyen lieu|che bien)\b/.test(normalize(message));

const findExactDish = (message: string, dishes: Recipe[]) => {
  const query = normalize(message);
  return [...dishes]
    .sort((left, right) => right.name.length - left.name.length)
    .find((dish) => query.includes(normalize(dish.name))) ?? null;
};

const retrieveMenu = (message: string, dishes: Recipe[]) => {
  const ranked = dishes
    .map((dish) => ({ dish, score: textScore(dish, message) }))
    .sort((left, right) => right.score - left.score || right.dish.updatedAt.getTime() - left.dish.updatedAt.getTime());
  const positive = ranked.filter((item) => item.score > 0).slice(0, 6).map((item) => item.dish);
  return positive.length ? positive : ranked.slice(0, 6).map((item) => item.dish);
};

const ingredientMatches = (fridgeName: string, ingredientName: string) => {
  const fridge = normalize(fridgeName);
  const ingredient = normalize(ingredientName);
  return Boolean(fridge && ingredient && (fridge.includes(ingredient) || ingredient.includes(fridge)));
};

const buildCookingSuggestion = (recipe: Recipe, fridgeItems: FridgeItem[]): CookingSuggestion => {
  const required = parseIngredients(recipe).filter((item) => !item.optional);
  const matchedIngredients: string[] = [];
  const missingIngredients: string[] = [];

  for (const ingredient of required) {
    if (fridgeItems.some((item) => ingredientMatches(item.name, ingredient.name))) matchedIngredients.push(ingredient.name);
    else missingIngredients.push(ingredient.name);
  }

  return {
    recipeId: recipe.id,
    name: recipe.name,
    description: recipe.description,
    timeMin: recipe.timeMin,
    servings: recipe.servings,
    matchedIngredients: matchedIngredients.slice(0, 6),
    missingIngredients: missingIngredients.slice(0, 6),
  };
};

const retrieveCooking = (message: string, recipes: Recipe[], fridgeItems: FridgeItem[]) =>
  recipes
    .map((recipe) => {
      const suggestion = buildCookingSuggestion(recipe, fridgeItems);
      const ingredientCount = parseIngredients(recipe).filter((item) => !item.optional).length;
      const coverage = ingredientCount ? suggestion.matchedIngredients.length / Math.min(ingredientCount, 6) : 0;
      const score = textScore(recipe, message) + suggestion.matchedIngredients.length * 12 + coverage * 30 - suggestion.missingIngredients.length;
      return { recipe, suggestion, score };
    })
    .sort((left, right) => right.score - left.score || right.recipe.updatedAt.getTime() - left.recipe.updatedAt.getTime())
    .slice(0, 5);

const toChatDish = (recipe: Recipe): ChatDish => ({
  id: recipe.id,
  name: recipe.name,
  description: recipe.description,
  price: { amount: recipe.priceAmount, currency: 'VND' },
  tags: recipe.tags,
  imageUrl: recipe.imageUrl ?? undefined,
});

const buildLocalResponse = (
  message: string,
  menuContext: Recipe[],
  cookingContext: ReturnType<typeof retrieveCooking>,
  allSaleDishes: Recipe[],
  hasFridgeItems: boolean
): ChatResponse => {
  const cookingIntent = isCookingIntent(message);
  const exactDish = isOrderIntent(message) ? findExactDish(message, allSaleDishes) : null;

  if (cookingIntent) {
    const cookingSuggestions = cookingContext.slice(0, 3).map((item) => item.suggestion);
    const first = cookingSuggestions[0];
    const ingredientNote = hasFridgeItems
      ? first.matchedIngredients.length
        ? `Bạn đã có ${first.matchedIngredients.join(', ')}.`
        : 'Các nguyên liệu trong tủ lạnh hiện chưa khớp nhiều với công thức này.'
      : 'Hãy thêm nguyên liệu vào tủ lạnh để mình đối chiếu chính xác hơn.';
    return {
      message: `Bạn có thể nấu ${first.name}. ${ingredientNote}`,
      suggestedDishIds: [],
      suggestedDishes: [],
      cookingSuggestions,
      actions: [],
      sources: hasFridgeItems ? ['recipe', 'fridge'] : ['recipe'],
      mode: 'local-rag',
    };
  }

  const selected = exactDish ? [exactDish] : menuContext.slice(0, 3);
  const first = selected[0];
  return {
    message: exactDish
      ? `Mình đã tìm thấy ${exactDish.name}. Món đã được thêm vào giỏ; bạn mở giỏ hàng để nhập địa chỉ và xác nhận đặt món.`
      : `Mình gợi ý ${first.name}. ${first.description} Giá ${first.priceAmount.toLocaleString('vi-VN')} ₫.`,
    suggestedDishIds: selected.map((dish) => dish.id),
    suggestedDishes: selected.map(toChatDish),
    cookingSuggestions: [],
    actions: exactDish ? [{ type: 'ADD_TO_CART', dishId: exactDish.id, quantity: 1 }] : [],
    sources: ['menu', 'database'],
    mode: 'local-rag',
  };
};

const isQuotaGeminiError = (raw: string) => {
  const lower = raw.toLowerCase();
  return lower.includes('quota exceeded') || lower.includes('resource_exhausted') || lower.includes('free_tier');
};

const isTransientGeminiError = (status: number, raw: string) => {
  const lower = raw.toLowerCase();
  if (isQuotaGeminiError(raw)) return false;
  return GEMINI_TRANSIENT_STATUS.has(status) || lower.includes('overloaded') || lower.includes('unavailable') || lower.includes('temporarily');
};

const summarizeGeminiError = (raw: string) => {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; status?: string } };
    return parsed.error?.message ?? parsed.error?.status ?? raw.slice(0, 300);
  } catch {
    return raw.slice(0, 300);
  }
};

const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const safeJsonParse = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()) as T;
  } catch {
    return null;
  }
};

const callGeminiModel = async (prompt: string, model: string): Promise<GeminiCallResult> => {
  try {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY ?? '')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!response.ok) return { ok: false, status: response.status, errorText: await response.text().catch(() => ''), model };
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return { ok: true, model, text: data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n').trim() ?? '' };
  } catch (error) {
    return { ok: false, status: 503, errorText: error instanceof Error ? error.message : 'Network request failed', model };
  }
};

const callGemini = async (prompt: string) => {
  if (!env.GEMINI_ENABLED || !env.GEMINI_API_KEY) return null;
  for (let attempt = 0; attempt <= GEMINI_RETRY_DELAYS_MS.length; attempt += 1) {
    const result = await callGeminiModel(prompt, env.GEMINI_MODEL);
    if (result.ok) return result.text || null;
    console.warn(`[chat] Gemini failed model=${result.model} attempt=${attempt + 1} status=${result.status} message=${summarizeGeminiError(result.errorText)}`);
    if (!isTransientGeminiError(result.status, result.errorText)) return null;
    const delayMs = GEMINI_RETRY_DELAYS_MS[attempt];
    if (delayMs) await delay(delayMs);
  }
  return null;
};

chatRouter.post('/', async (req, res) => {
  const body = z.object({
    userId: z.string().min(1).optional(),
    message: z.string().min(1).max(1000),
    history: z.array(z.object({ role: z.enum(['user', 'bot']), text: z.string().max(1000) })).max(10).optional(),
  }).parse(req.body);

  const [saleDishes, allRecipes, fridgeItems, recentOrders] = await Promise.all([
    prisma.recipe.findMany({ where: { priceAmount: { gt: 0 } }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.recipe.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 }),
    body.userId ? prisma.fridgeItem.findMany({ where: { userId: body.userId }, orderBy: { updatedAt: 'desc' }, take: 50 }) : Promise.resolve([]),
    body.userId ? prisma.order.findMany({ where: { userId: body.userId }, orderBy: { createdAt: 'desc' }, take: 5 }) : Promise.resolve([]),
  ]);

  if (!saleDishes.length || !allRecipes.length) {
    res.status(503).json({ message: 'Dữ liệu món ăn chưa sẵn sàng' });
    return;
  }

  const menuContext = retrieveMenu(body.message, saleDishes);
  const cookingContext = retrieveCooking(body.message, allRecipes, fridgeItems);
  const local = buildLocalResponse(body.message, menuContext, cookingContext, saleDishes, fridgeItems.length > 0);
  const prompt = [
    'Bạn là chatbot SmartBite. Chỉ tư vấn dựa trên dữ liệu PostgreSQL trong CONTEXT.',
    'Trả lời tiếng Việt ngắn gọn. Món bán dùng dishId; công thức nấu dùng recipeId.',
    'Chỉ tạo ADD_TO_CART khi người dùng yêu cầu đặt/thêm/mua và món có trong CONTEXT_MENU.',
    'Output JSON, không markdown, đúng schema:',
    '{"message":"string","suggestedDishIds":["dishId"],"cookingRecipeIds":["recipeId"],"actions":[{"type":"ADD_TO_CART","dishId":"dishId","quantity":1}],"sources":["menu","recipe","fridge","order","database"]}',
    `CONTEXT_MENU=${JSON.stringify(menuContext.map((dish) => ({ id: dish.id, name: dish.name, description: dish.description, category: dish.category, tags: dish.tags, priceAmount: dish.priceAmount, ingredients: parseIngredients(dish).map((item) => item.name) })))}`,
    `CONTEXT_COOKING=${JSON.stringify(cookingContext.map((item) => item.suggestion))}`,
    `CONTEXT_FRIDGE=${JSON.stringify(fridgeItems.map((item) => ({ name: item.name, quantity: item.quantity, unit: item.unit, expiryDate: item.expiryDate })))}`,
    `CONTEXT_RECENT_ORDERS=${JSON.stringify(recentOrders.map((order) => ({ status: order.status, items: order.items, createdAt: order.createdAt })))}`,
    `CHAT_HISTORY=${JSON.stringify(body.history ?? [])}`,
    `USER_MESSAGE=${body.message}`,
  ].join('\n');

  try {
    const raw = await callGemini(prompt);
    const parsed = raw ? safeJsonParse<GeminiPayload>(raw) : null;
    if (!parsed?.message) {
      res.json(local);
      return;
    }

    const saleById = new Map(saleDishes.map((dish) => [dish.id, dish]));
    const cookingById = new Map(cookingContext.map((item) => [item.recipe.id, item.suggestion]));
    const suggestedDishIds = (parsed.suggestedDishIds ?? []).filter((id) => saleById.has(id)).slice(0, 4);
    const cookingRecipeIds = (parsed.cookingRecipeIds ?? []).filter((id) => cookingById.has(id)).slice(0, 4);
    const actions = (isOrderIntent(body.message) ? parsed.actions ?? [] : [])
      .filter((action) => action.type === 'OPEN_CART' || (action.dishId && saleById.has(action.dishId)))
      .slice(0, 2)
      .map((action) => ({ ...action, quantity: action.quantity ?? 1 }));
    const finalDishIds = suggestedDishIds.length ? suggestedDishIds : local.suggestedDishIds;
    const finalCookingIds = cookingRecipeIds.length ? cookingRecipeIds : local.cookingSuggestions.map((item) => item.recipeId);

    res.json({
      message: parsed.message,
      suggestedDishIds: finalDishIds,
      suggestedDishes: finalDishIds.map((id) => saleById.get(id)).filter((dish): dish is Recipe => Boolean(dish)).map(toChatDish),
      cookingSuggestions: finalCookingIds.map((id) => cookingById.get(id)).filter((item): item is CookingSuggestion => Boolean(item)),
      actions,
      sources: parsed.sources?.length ? parsed.sources : local.sources,
      mode: 'gemini-rag',
    } satisfies ChatResponse);
  } catch (error) {
    console.warn(`[chat] Falling back to local RAG: ${error instanceof Error ? error.message : String(error)}`);
    res.json(local);
  }
});
