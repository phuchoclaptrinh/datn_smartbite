import type { FridgeUnit, InventoryGroup } from '@prisma/client';
import { prisma } from '../prisma';

type InventorySeed = {
  name: string;
  aliases: string[];
  stockQuantity: number;
  unit: FridgeUnit;
  minStock: number;
  dailyUsage: number;
  inventoryGroup: InventoryGroup;
};

const inventory: InventorySeed[] = [
  { name: 'Ức gà', aliases: ['thịt gà', 'gà phi lê'], stockQuantity: 6500, unit: 'g', minStock: 2500, dailyUsage: 900, inventoryGroup: 'Main' },
  { name: 'Bánh phở', aliases: ['sợi phở'], stockQuantity: 8000, unit: 'g', minStock: 3000, dailyUsage: 1200, inventoryGroup: 'Staple' },
  { name: 'Nước dùng gà', aliases: ['nước lèo phở'], stockQuantity: 12000, unit: 'ml', minStock: 4000, dailyUsage: 1800, inventoryGroup: 'Sauce' },
  { name: 'Hành lá', aliases: ['hành xanh'], stockQuantity: 800, unit: 'g', minStock: 300, dailyUsage: 90, inventoryGroup: 'Auxiliary' },
  { name: 'Ngò gai', aliases: ['mùi tàu'], stockQuantity: 200, unit: 'g', minStock: 300, dailyUsage: 45, inventoryGroup: 'Auxiliary' },
  { name: 'Chanh tươi', aliases: ['chanh'], stockQuantity: 45, unit: 'pcs', minStock: 20, dailyUsage: 7, inventoryGroup: 'Fruit' },
  { name: 'Cá hồi phi lê', aliases: ['cá hồi'], stockQuantity: 1200, unit: 'g', minStock: 1500, dailyUsage: 700, inventoryGroup: 'Main' },
  { name: 'Gạo thơm', aliases: ['gạo', 'gạo jasmine'], stockQuantity: 12000, unit: 'g', minStock: 5000, dailyUsage: 1400, inventoryGroup: 'Staple' },
  { name: 'Xà lách', aliases: ['rau xà lách', 'rau xanh'], stockQuantity: 2500, unit: 'g', minStock: 1000, dailyUsage: 350, inventoryGroup: 'Vegetable' },
  { name: 'Bơ quả', aliases: ['trái bơ'], stockQuantity: 0, unit: 'pcs', minStock: 10, dailyUsage: 4, inventoryGroup: 'Fruit' },
  { name: 'Sốt mè rang', aliases: ['sốt mè'], stockQuantity: 3000, unit: 'ml', minStock: 1000, dailyUsage: 260, inventoryGroup: 'Sauce' },
  { name: 'Thịt bò thăn', aliases: ['thăn bò', 'bò phi lê'], stockQuantity: 5500, unit: 'g', minStock: 2200, dailyUsage: 850, inventoryGroup: 'Main' },
  { name: 'Bông cải xanh', aliases: ['súp lơ xanh'], stockQuantity: 3200, unit: 'g', minStock: 1200, dailyUsage: 400, inventoryGroup: 'Vegetable' },
  { name: 'Ớt chuông', aliases: ['ớt Đà Lạt'], stockQuantity: 1800, unit: 'g', minStock: 800, dailyUsage: 230, inventoryGroup: 'Vegetable' },
  { name: 'Cà rốt', aliases: [], stockQuantity: 2500, unit: 'g', minStock: 1000, dailyUsage: 260, inventoryGroup: 'Vegetable' },
  { name: 'Bơ lạt', aliases: ['bơ nhạt'], stockQuantity: 1500, unit: 'g', minStock: 600, dailyUsage: 140, inventoryGroup: 'Auxiliary' },
  { name: 'Tỏi', aliases: ['tỏi củ'], stockQuantity: 900, unit: 'g', minStock: 400, dailyUsage: 80, inventoryGroup: 'Auxiliary' },
  { name: 'Mì ramen', aliases: ['mì Nhật'], stockQuantity: 45, unit: 'pcs', minStock: 20, dailyUsage: 8, inventoryGroup: 'Staple' },
  { name: 'Trứng gà', aliases: ['trứng'], stockQuantity: 90, unit: 'pcs', minStock: 36, dailyUsage: 12, inventoryGroup: 'Main' },
  { name: 'Nấm kim châm', aliases: ['nấm'], stockQuantity: 3000, unit: 'g', minStock: 1000, dailyUsage: 320, inventoryGroup: 'Vegetable' },
  { name: 'Hành tây', aliases: [], stockQuantity: 4000, unit: 'g', minStock: 1500, dailyUsage: 420, inventoryGroup: 'Vegetable' },
  { name: 'Nước tương', aliases: ['xì dầu'], stockQuantity: 5000, unit: 'ml', minStock: 1500, dailyUsage: 360, inventoryGroup: 'Sauce' },
  { name: 'Dầu ăn', aliases: ['dầu thực vật'], stockQuantity: 8000, unit: 'ml', minStock: 2500, dailyUsage: 550, inventoryGroup: 'Sauce' },
  { name: 'Dầu ớt', aliases: ['sa tế'], stockQuantity: 2500, unit: 'ml', minStock: 700, dailyUsage: 180, inventoryGroup: 'Sauce' },
];

const marker = 'Dữ liệu mẫu kho -';

const main = async () => {
  const seeded: Array<{ id: string; name: string; dailyUsage: number }> = [];

  for (const item of inventory) {
    const ingredient = await prisma.ingredient.upsert({
      where: { name: item.name },
      update: {
        aliases: item.aliases,
        stockQuantity: item.stockQuantity,
        unit: item.unit,
        minStock: item.minStock,
        inventoryGroup: item.inventoryGroup,
      },
      create: {
        name: item.name,
        aliases: item.aliases,
        stockQuantity: item.stockQuantity,
        unit: item.unit,
        minStock: item.minStock,
        inventoryGroup: item.inventoryGroup,
      },
      select: { id: true, name: true },
    });
    seeded.push({ ...ingredient, dailyUsage: item.dailyUsage });
  }

  await prisma.inventoryMovement.deleteMany({ where: { note: { startsWith: marker } } });

  const movements = seeded.flatMap((item) =>
    Array.from({ length: 7 }, (_, index) => {
      const createdAt = new Date();
      createdAt.setUTCDate(createdAt.getUTCDate() - (index + 1));
      createdAt.setUTCHours(12, 0, 0, 0);
      const variation = [0.9, 1.05, 1, 1.15, 0.85, 1.1, 0.95][index];
      return {
        ingredientId: item.id,
        type: 'Export' as const,
        quantityDelta: -Math.max(1, Math.round(item.dailyUsage * variation)),
        note: `${marker}xuất sử dụng ngày ${createdAt.toISOString().slice(0, 10)}`,
        createdAt,
      };
    })
  );

  await prisma.inventoryMovement.createMany({ data: movements });

  const lowCount = inventory.filter((item) => item.stockQuantity > 0 && item.stockQuantity <= item.minStock).length;
  const outCount = inventory.filter((item) => item.stockQuantity === 0).length;
  process.stdout.write(`Seeded ${inventory.length} inventory ingredients\n`);
  process.stdout.write(`Low stock: ${lowCount}; out of stock: ${outCount}; movement rows: ${movements.length}\n`);
};

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
