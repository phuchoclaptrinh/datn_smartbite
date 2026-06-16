import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env';
import { prisma } from '../prisma';
import { menuDishes, type MenuDish } from '../data/menu';

export const chatRouter = Router();

type ChatAction = {
  type: 'ADD_TO_CART' | 'OPEN_CART';
  dishId?: string;
  quantity?: number;
};

type ChatResponse = {
  message: string;
  suggestedDishIds: string[];
  actions: ChatAction[];
  sources: string[];
  mode: 'gemini-rag' | 'local-rag';
};

type GeminiCallResult =
  | { ok: true; text: string; model: string }
  | { ok: false; status: number; errorText: string; fallback: string; model: string };

const GEMINI_TIMEOUT_MS = 30000;
const GEMINI_RETRY_DELAYS_MS = [700, 1500, 3000];
const GEMINI_TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const unique = (values: string[]) => values.filter((value, index) => value && values.indexOf(value) === index);

const getGeminiModels = () => unique([env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']);

const isTransientGeminiError = (status: number, raw: string) => {
  const lower = raw.toLowerCase();
  return (
    GEMINI_TRANSIENT_STATUS.has(status) ||
    lower.includes('overloaded') ||
    lower.includes('unavailable') ||
    lower.includes('temporarily') ||
    lower.includes('resource_exhausted')
  );
};

const summarizeGeminiError = (raw: string) => {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; status?: string; code?: number } };
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

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

const isOrderIntent = (text: string) => {
  const q = normalize(text);
  return q.includes('dat') || q.includes('them') || q.includes('mua') || q.includes('order');
};

const scoreDish = (dish: MenuDish, message: string) => {
  const q = normalize(message);
  const haystack = normalize(`${dish.name} ${dish.description} ${dish.tags.join(' ')}`);
  let score = 0;

  if (haystack.includes(q)) score += 10;
  if (q.includes('it tinh bot') || q.includes('low carb') || q.includes('giam can')) score += dish.tags.some((t) => normalize(t).includes('it tinh bot')) ? 12 : -2;
  if (q.includes('giau dam') || q.includes('protein') || q.includes('tap gym')) score += dish.tags.some((t) => normalize(t).includes('giau dam')) ? 12 : 0;
  if (q.includes('cay')) score += dish.tags.some((t) => normalize(t).includes('cay')) ? 12 : -1;
  if (q.includes('de an') || q.includes('nhe') || q.includes('pho')) score += dish.tags.some((t) => normalize(t).includes('de an')) ? 8 : 0;
  if (q.includes('com')) score += normalize(dish.name).includes('com') ? 8 : 0;
  if (q.includes('mi') || q.includes('ramen')) score += normalize(dish.name).includes('mi') || normalize(dish.name).includes('ramen') ? 8 : 0;
  if (q.includes('ca')) score += normalize(dish.name).includes('ca') ? 8 : 0;
  if (q.includes('bo')) score += normalize(dish.name).includes('bo') ? 8 : 0;
  if (q.includes('ga')) score += normalize(dish.name).includes('ga') ? 8 : 0;

  return score;
};

const retrieveMenu = (message: string) => {
  const ranked = menuDishes
    .map((dish) => ({ dish, score: scoreDish(dish, message) }))
    .sort((a, b) => b.score - a.score);
  const positive = ranked.filter((it) => it.score > 0).slice(0, 4).map((it) => it.dish);
  return positive.length ? positive : menuDishes.slice(0, 4);
};

const exactDishInText = (message: string) => {
  const q = normalize(message);
  return menuDishes.find((dish) => q.includes(normalize(dish.name))) ?? null;
};

const safeJsonParse = <T>(raw: string): T | null => {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
};

const buildLocalResponse = (message: string, menuContext: MenuDish[]): ChatResponse => {
  const exact = isOrderIntent(message) ? exactDishInText(message) : null;
  const suggested = exact ? [exact] : menuContext.slice(0, 3);
  const first = suggested[0];
  const actions: ChatAction[] = exact ? [{ type: 'ADD_TO_CART', dishId: exact.id, quantity: 1 }] : [];

  return {
    message: exact
      ? `Mình đã tìm thấy ${exact.name} và có thể thêm món này vào giỏ cho bạn. Khi sẵn sàng, hãy mở giỏ hàng để nhập địa chỉ giao hàng.`
      : `Mình gợi ý ${first.name}. Món này ${first.description.toLowerCase()} Giá ${first.priceAmount.toLocaleString('vi-VN')} ₫, khoảng ${first.kcal} kcal.`,
    suggestedDishIds: suggested.map((dish) => dish.id),
    actions,
    sources: ['menu'],
    mode: 'local-rag',
  };
};

const callGeminiModel = async (prompt: string, model: string): Promise<GeminiCallResult> => {
  try {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY ?? '')}`,
      {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return { ok: false, status: res.status, errorText, fallback: res.statusText, model };
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return { ok: true, model, text: data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n').trim() ?? '' };
  } catch (error) {
    const errorText = error instanceof Error ? error.message : 'Network request failed';
    return { ok: false, status: 503, errorText, fallback: 'Gemini request failed', model };
  }
};

const callGemini = async (prompt: string) => {
  if (!env.GEMINI_API_KEY) return null;
  let lastError: Extract<GeminiCallResult, { ok: false }> | null = null;

  for (const model of getGeminiModels()) {
    for (let attempt = 0; attempt <= GEMINI_RETRY_DELAYS_MS.length; attempt += 1) {
      const result = await callGeminiModel(prompt, model);

      if (result.ok) {
        if (model !== env.GEMINI_MODEL) {
          console.warn(`[chat] Gemini primary model failed; used fallback model ${model}`);
        }
        return result.text || null;
      }

      lastError = result;
      console.warn(
        `[chat] Gemini failed model=${result.model} attempt=${attempt + 1} status=${result.status} message=${summarizeGeminiError(result.errorText)}`
      );

      if (!isTransientGeminiError(result.status, result.errorText)) {
        return null;
      }

      const delayMs = GEMINI_RETRY_DELAYS_MS[attempt];
      if (delayMs) {
        await delay(delayMs);
      }
    }
  }

  if (lastError) {
    console.warn(`[chat] Gemini fallback exhausted status=${lastError.status} message=${summarizeGeminiError(lastError.errorText)}`);
  }
  return null;
};

chatRouter.post('/', async (req, res) => {
  const body = z
    .object({
      userId: z.string().min(1).optional(),
      message: z.string().min(1).max(1000),
      history: z
        .array(
          z.object({
            role: z.enum(['user', 'bot']),
            text: z.string().max(1000),
          })
        )
        .max(10)
        .optional(),
    })
    .parse(req.body);

  const menuContext = retrieveMenu(body.message);
  const [fridgeItems, recipes, orders] = await Promise.all([
    body.userId
      ? prisma.fridgeItem.findMany({ where: { userId: body.userId }, orderBy: { updatedAt: 'desc' }, take: 20 })
      : Promise.resolve([]),
    prisma.recipe.findMany({ orderBy: { updatedAt: 'desc' }, take: 20 }),
    body.userId ? prisma.order.findMany({ where: { userId: body.userId }, orderBy: { createdAt: 'desc' }, take: 5 }) : Promise.resolve([]),
  ]);

  const local = buildLocalResponse(body.message, menuContext);

  const prompt = [
    'Bạn là chatbot tư vấn món ăn của SmartBite. Trả lời bằng tiếng Việt, ngắn gọn, thực tế.',
    'Chỉ dùng dữ liệu trong CONTEXT để gợi ý. Nếu người dùng muốn đặt/thêm/mua một món có trong menu, trả action ADD_TO_CART.',
    'Output bắt buộc là JSON hợp lệ, không markdown, theo schema:',
    '{"message":"string","suggestedDishIds":["dishId"],"actions":[{"type":"ADD_TO_CART","dishId":"dishId","quantity":1}],"sources":["menu","fridge","recipe","order"]}',
    '',
    'CONTEXT_MENU:',
    JSON.stringify(
      menuContext.map((dish) => ({
        id: dish.id,
        name: dish.name,
        description: dish.description,
        tags: dish.tags,
        priceAmount: dish.priceAmount,
        kcal: dish.kcal,
        proteinG: dish.proteinG,
        carbsG: dish.carbsG,
        fatG: dish.fatG,
      })),
      null,
      2
    ),
    '',
    'CONTEXT_FRIDGE:',
    JSON.stringify(
      fridgeItems.map((it) => ({ name: it.name, quantity: it.quantity, unit: it.unit, expiryDate: it.expiryDate })),
      null,
      2
    ),
    '',
    'CONTEXT_RECIPES:',
    JSON.stringify(
      recipes.map((r) => ({ name: r.name, tags: r.tags, timeMin: r.timeMin, servings: r.servings, ingredients: r.ingredients })),
      null,
      2
    ),
    '',
    'CONTEXT_RECENT_ORDERS:',
    JSON.stringify(
      orders.map((o) => ({ status: o.status, items: o.items, totalAmount: o.totalAmount, createdAt: o.createdAt })),
      null,
      2
    ),
    '',
    'CHAT_HISTORY:',
    JSON.stringify(body.history ?? [], null, 2),
    '',
    `USER_MESSAGE: ${body.message}`,
  ].join('\n');

  try {
    const raw = await callGemini(prompt);
    if (!raw) {
      res.json(local);
      return;
    }

    const parsed = safeJsonParse<Omit<ChatResponse, 'mode'>>(raw);
    if (!parsed?.message) {
      res.json(local);
      return;
    }

    const validDishIds = new Set(menuDishes.map((dish) => dish.id));
    const suggestedDishIds = (parsed.suggestedDishIds ?? []).filter((id) => validDishIds.has(id)).slice(0, 4);
    const actions = (parsed.actions ?? [])
      .filter((action) => action.type === 'OPEN_CART' || (action.dishId && validDishIds.has(action.dishId)))
      .slice(0, 3)
      .map((action) => ({ ...action, quantity: action.quantity ?? 1 }));

    res.json({
      message: parsed.message,
      suggestedDishIds: suggestedDishIds.length ? suggestedDishIds : local.suggestedDishIds,
      actions,
      sources: parsed.sources?.length ? parsed.sources : ['menu'],
      mode: 'gemini-rag',
    } satisfies ChatResponse);
  } catch {
    res.json(local);
  }
});
