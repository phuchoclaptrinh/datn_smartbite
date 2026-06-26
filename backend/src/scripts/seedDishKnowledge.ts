import fs from 'fs';
import path from 'path';
import type { FridgeUnit, InventoryGroup, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

type SourceIngredient = {
  ingredient_id: string;
  name_vi: string;
  name_en?: string;
  quantity?: number;
  unit?: string;
  category?: string;
  importance?: number;
  name_normalized?: string;
};

type SourceDish = {
  id: string;
  name_vi: string;
  name_normalized?: string;
  category?: string;
  ingredients?: SourceIngredient[];
  type?: string;
};

const categoryLabel: Record<string, string> = {
  'mon banh': 'Món bánh',
  'mon chien': 'Món chiên',
  'mon xao': 'Món xào',
  'mon canh': 'Món canh',
  'mon kho': 'Món kho',
  'mon nuong': 'Món nướng',
  'mon goi - salad': 'Gỏi và salad',
  'mon nuoc': 'Món nước',
  'mon lau': 'Món lẩu',
  'mon hap': 'Món hấp',
  'mon chao': 'Món cháo',
  'mon chay': 'Món chay',
  'mon trang mieng': 'Món tráng miệng',
  'an vat': 'Ăn vặt',
};

const estimatedTime: Record<string, number> = {
  'mon banh': 45,
  'mon chien': 30,
  'mon xao': 25,
  'mon canh': 35,
  'mon kho': 60,
  'mon nuong': 45,
  'mon goi - salad': 20,
  'mon nuoc': 45,
  'mon lau': 60,
  'mon hap': 35,
  'mon chao': 45,
  'mon chay': 35,
  'mon trang mieng': 40,
  'an vat': 30,
};

const basePrice: Record<string, number> = {
  'mon banh': 35000,
  'mon chien': 55000,
  'mon xao': 59000,
  'mon canh': 49000,
  'mon kho': 59000,
  'mon nuong': 75000,
  'mon goi - salad': 55000,
  'mon nuoc': 55000,
  'mon lau': 179000,
  'mon hap': 69000,
  'mon chao': 45000,
  'mon chay': 45000,
  'mon trang mieng': 35000,
  'an vat': 39000,
};

const estimatePrice = (dish: SourceDish) => {
  const text = `${dish.name_normalized ?? ''} ${(dish.ingredients ?? []).map((item) => item.name_normalized ?? '').join(' ')}`;
  let price = basePrice[dish.category ?? ''] ?? 55000;
  if (/ca hoi/.test(text)) price += 30000;
  else if (/cua|ghe|tom hum/.test(text)) price += 30000;
  else if (/tom|muc|hai san/.test(text)) price += 20000;
  else if (/thit bo| bo /.test(` ${text} `)) price += 20000;
  else if (/ga|heo|ca /.test(text)) price += 10000;
  if ((dish.ingredients ?? []).length >= 11) price += 10000;
  return Math.ceil(price / 10000) * 10000 - 1000;
};

const countUnits = new Set(['cái', 'quả', 'trái', 'củ', 'nhánh', 'tép', 'cây', 'con', 'gói', 'lá', 'miếng', 'hộp', 'bó', 'ống', 'hạt']);

const pickImportantIngredients = (dish: SourceDish, limit = 5) =>
  (dish.ingredients ?? [])
    .filter((item) => item.name_vi?.trim())
    .sort((left, right) => (right.importance ?? 1) - (left.importance ?? 1))
    .slice(0, limit)
    .map((item) => item.name_vi.trim());

const buildCookingSteps = (dish: SourceDish) => {
  const category = dish.category ?? '';
  const mainIngredients = pickImportantIngredients(dish, 4);
  const ingredientText = mainIngredients.length ? mainIngredients.join(', ') : 'nguyên liệu chính';
  const dishName = dish.name_vi;

  const commonPrep = `Sơ chế ${ingredientText}; rửa sạch, cắt miếng vừa ăn và để ráo.`;
  const season = `Ướp ${ingredientText} với muối, tiêu, hành tỏi và gia vị phù hợp trong 10-15 phút.`;
  const finish = `Nêm nếm lại cho vừa ăn, trình bày ${dishName} ra đĩa và dùng khi còn nóng.`;

  const templates: Record<string, string[]> = {
    'mon chien': [
      commonPrep,
      season,
      'Làm nóng dầu ở lửa vừa, cho nguyên liệu vào chiên đến khi vàng giòn hai mặt.',
      'Vớt ra giấy thấm dầu để món ăn ráo và giữ độ giòn.',
      finish,
    ],
    'mon xao': [
      commonPrep,
      season,
      'Phi thơm hành tỏi với một ít dầu ăn.',
      'Cho nguyên liệu vào xào nhanh trên lửa lớn để giữ độ ngọt và màu sắc.',
      finish,
    ],
    'mon canh': [
      commonPrep,
      'Đun sôi nước hoặc nước dùng, cho nguyên liệu lâu chín vào trước.',
      'Hạ lửa vừa, nấu đến khi nguyên liệu mềm và nước canh ngọt.',
      'Nêm muối, hạt nêm, nước mắm theo khẩu vị.',
      `Thêm rau thơm nếu có rồi múc ${dishName} ra tô.`,
    ],
    'mon kho': [
      commonPrep,
      season,
      'Thắng màu hoặc phi thơm hành tỏi, cho nguyên liệu đã ướp vào đảo săn.',
      'Thêm nước hoặc nước dừa xâm xấp, kho lửa nhỏ đến khi nước sệt lại.',
      finish,
    ],
    'mon nuong': [
      commonPrep,
      season,
      'Làm nóng lò nướng hoặc bếp than, phết một lớp dầu mỏng lên nguyên liệu.',
      'Nướng đến khi chín vàng, trở mặt và phết thêm sốt trong quá trình nướng.',
      finish,
    ],
    'mon goi - salad': [
      commonPrep,
      'Pha nước trộn với nước mắm hoặc sốt, đường, chanh và tỏi ớt theo khẩu vị.',
      'Trộn nguyên liệu với nước trộn nhẹ tay để giữ độ giòn.',
      'Để 5 phút cho thấm vị, thêm rau thơm hoặc đậu phộng nếu có.',
      `Bày ${dishName} ra đĩa và dùng ngay.`,
    ],
    'mon nuoc': [
      commonPrep,
      'Chuẩn bị nước dùng bằng cách ninh xương hoặc nấu nước nền với gia vị thơm.',
      'Chần hoặc làm chín phần nguyên liệu chính riêng để giữ vị sạch.',
      'Xếp bún, phở hoặc topping vào tô rồi chan nước dùng nóng.',
      `Thêm rau thơm, hành và dùng ${dishName} khi còn nóng.`,
    ],
    'mon lau': [
      commonPrep,
      'Nấu nước lẩu với xương hoặc nước dùng, thêm gia vị chua cay tùy món.',
      'Chuẩn bị các loại rau, nấm và topping ăn kèm trên đĩa riêng.',
      'Khi ăn, nhúng nguyên liệu vào nồi lẩu đang sôi đến khi vừa chín.',
      'Nêm lại nước lẩu trong quá trình dùng nếu cần.',
    ],
    'mon hap': [
      commonPrep,
      season,
      'Đun sôi nước trong nồi hấp, có thể thêm sả, gừng hoặc hành để tạo mùi thơm.',
      'Cho nguyên liệu vào xửng, hấp đến khi chín mềm và giữ được vị ngọt tự nhiên.',
      finish,
    ],
    'mon chao': [
      'Vo gạo sạch, rang sơ nếu muốn cháo thơm hơn.',
      commonPrep,
      'Nấu gạo với nhiều nước đến khi nở mềm.',
      'Cho nguyên liệu chính vào nấu chín, khuấy đều để cháo sánh.',
      `Nêm gia vị, thêm hành ngò rồi dùng ${dishName} khi còn nóng.`,
    ],
    'mon chay': [
      commonPrep,
      'Phi thơm hành hoặc boa rô với một ít dầu ăn.',
      'Cho nguyên liệu vào nấu hoặc xào theo độ chín từ lâu đến nhanh.',
      'Nêm nước tương, muối, hạt nêm chay theo khẩu vị.',
      finish,
    ],
    'mon banh': [
      'Chuẩn bị đầy đủ nguyên liệu khô và nguyên liệu ướt theo định lượng.',
      `Trộn ${ingredientText} đến khi hỗn hợp hòa quyện.`,
      'Tạo hình bánh hoặc cho hỗn hợp vào khuôn.',
      'Nướng, hấp hoặc chiên theo đặc trưng của món đến khi chín.',
      `Để nguội bớt rồi thưởng thức ${dishName}.`,
    ],
    'mon trang mieng': [
      commonPrep,
      'Chuẩn bị phần nền ngọt như nước đường, sữa, cốt dừa hoặc thạch tùy món.',
      'Kết hợp các nguyên liệu theo thứ tự để giữ màu sắc và kết cấu.',
      'Làm lạnh nếu cần để món tráng miệng ngon hơn.',
      `Trình bày ${dishName} ra ly hoặc chén và dùng ngay.`,
    ],
    'an vat': [
      commonPrep,
      season,
      'Chế biến nguyên liệu bằng cách chiên, nướng hoặc trộn tùy đặc trưng món.',
      'Pha sốt chấm hoặc gia vị rắc kèm để tăng hương vị.',
      `Bày ${dishName} ra đĩa nhỏ và dùng như món ăn nhẹ.`,
    ],
  };

  return templates[category] ?? [commonPrep, season, 'Chế biến nguyên liệu đến khi chín vừa và giữ được hương vị tự nhiên.', finish];
};

const sourceInventoryGroup = (category?: string): InventoryGroup => {
  if (category === 'vegetables') return 'Vegetable';
  if (category === 'fresh_fruits') return 'Fruit';
  if (category === 'seasonings') return 'Auxiliary';
  if (category?.includes('meat') || category?.includes('seafood') || category?.includes('fish')) return 'Main';
  if (category?.includes('rice') || category?.includes('noodle') || category?.includes('flour')) return 'Staple';
  if (category?.includes('sauce') || category?.includes('oil') || category?.includes('beverage')) return 'Sauce';
  return 'Other';
};

const normalizeQuantity = (quantity?: number, rawUnit?: string): { quantity?: number; unit?: FridgeUnit } => {
  if (!quantity || quantity <= 0) return {};
  const unit = (rawUnit ?? '').trim().toLowerCase();
  if (['g', 'gr', 'gram'].includes(unit)) return { quantity, unit: 'g' };
  if (unit === 'kg') return { quantity: quantity * 1000, unit: 'g' };
  if (unit === 'ml') return { quantity, unit: 'ml' };
  if (['l', 'lít', 'lit'].includes(unit)) return { quantity: quantity * 1000, unit: 'ml' };
  if (['muỗng canh', 'thìa canh'].includes(unit)) return { quantity: quantity * 15, unit: 'ml' };
  if (['muỗng cà phê', 'thìa cà phê'].includes(unit)) return { quantity: quantity * 5, unit: 'ml' };
  if (unit === 'chén') return { quantity: quantity * 240, unit: 'ml' };
  if (countUnits.has(unit)) return { quantity, unit: 'pcs' };
  return {};
};

const main = async () => {
  const dataPath = path.resolve(process.cwd(), 'prisma', 'data', 'dish_knowledge_sample.json');
  const dishes = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as SourceDish[];
  if (dishes.length !== 100) throw new Error(`Expected 100 dishes, found ${dishes.length}`);

  await prisma.recipe.deleteMany({
    where: {
      sourceId: {
        not: null,
        notIn: dishes.map((dish) => dish.id),
      },
    },
  });

  const ingredientByName = new Map<string, SourceIngredient>();
  for (const dish of dishes) {
    for (const ingredient of dish.ingredients ?? []) {
      if (ingredient.name_vi?.trim() && !ingredientByName.has(ingredient.name_vi.trim())) {
        ingredientByName.set(ingredient.name_vi.trim(), ingredient);
      }
    }
  }

  const existingIngredients = await prisma.ingredient.findMany({
    where: { name: { in: [...ingredientByName.keys()] } },
    select: { name: true, aliases: true, isStockManaged: true },
  });
  const existingByName = new Map(existingIngredients.map((item) => [item.name, item]));

  for (const [name, source] of ingredientByName) {
    const aliases = [...new Set([...(existingByName.get(name)?.aliases ?? []), source.name_en, source.name_normalized].filter(Boolean) as string[])];
    await prisma.ingredient.upsert({
      where: { name },
      update: {
        aliases,
        normalizedName: source.name_normalized,
        nameEn: source.name_en,
        category: source.category,
        inventoryGroup: existingByName.get(name)?.isStockManaged ? undefined : sourceInventoryGroup(source.category),
      },
      create: {
        name,
        aliases,
        normalizedName: source.name_normalized,
        nameEn: source.name_en,
        category: source.category,
        inventoryGroup: sourceInventoryGroup(source.category),
        isStockManaged: false,
        stockQuantity: 0,
        unit: 'pcs',
        minStock: 0,
      },
    });
  }

  for (const dish of dishes) {
    const category = dish.category ?? 'khac';
    const ingredients = (dish.ingredients ?? []).map((ingredient) => {
      const normalized = normalizeQuantity(ingredient.quantity, ingredient.unit);
      return {
        name: ingredient.name_vi,
        ...normalized,
        optional: (ingredient.importance ?? 1) <= 1,
        originalQuantity: ingredient.quantity,
        originalUnit: ingredient.unit,
        sourceIngredientId: ingredient.ingredient_id,
      };
    }) satisfies Prisma.JsonArray;
    const importantNames = (dish.ingredients ?? []).filter((item) => (item.importance ?? 1) >= 2).slice(0, 5).map((item) => item.name_vi);
    const label = categoryLabel[category] ?? category;
    const priceAmount = estimatePrice(dish);
    const steps = buildCookingSteps(dish);
    const description = `${dish.name_vi} thuộc nhóm ${label.toLowerCase()}${importantNames.length ? `, sử dụng ${importantNames.join(', ')}` : ''}.`;

    await prisma.recipe.upsert({
      where: { sourceId: dish.id },
      update: {
        name: dish.name_vi,
        normalizedName: dish.name_normalized,
        category,
        description,
        tags: [label],
        timeMin: estimatedTime[category] ?? 35,
        servings: 4,
        priceAmount,
        currency: 'VND',
        ingredients,
        steps,
      },
      create: {
        sourceId: dish.id,
        name: dish.name_vi,
        normalizedName: dish.name_normalized,
        category,
        description,
        tags: [label],
        timeMin: estimatedTime[category] ?? 35,
        servings: 4,
        priceAmount,
        currency: 'VND',
        ingredients,
        steps,
      },
    });
  }

  process.stdout.write(`Seeded ${dishes.length} dishes and ${ingredientByName.size} ingredient catalog entries\n`);
};

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
