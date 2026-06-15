export type MenuDish = {
  id: string;
  name: string;
  description: string;
  priceAmount: number;
  tags: string[];
  portionLabel: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const menuDishes: MenuDish[] = [
  {
    id: 'd1',
    name: 'Phở gà',
    description: 'Phở gà nóng với bánh phở mềm, thịt gà xé, rau thơm và chanh.',
    priceAmount: 55000,
    tags: ['Món Việt', 'Dễ ăn'],
    portionLabel: '1 tô',
    grams: 450,
    kcal: 520,
    proteinG: 35,
    carbsG: 58,
    fatG: 14,
  },
  {
    id: 'd2',
    name: 'Cơm cá hồi áp chảo',
    description: 'Cá hồi áp chảo dùng cùng rau xanh, bơ và sốt mè nhẹ.',
    priceAmount: 89000,
    tags: ['Ít tinh bột', 'Giàu đạm'],
    portionLabel: '1 phần',
    grams: 380,
    kcal: 610,
    proteinG: 42,
    carbsG: 14,
    fatG: 42,
  },
  {
    id: 'd3',
    name: 'Bò áp chảo rau củ',
    description: 'Thịt bò áp chảo ăn kèm rau củ nướng và sốt bơ tỏi.',
    priceAmount: 99000,
    tags: ['Giàu đạm', 'Ít tinh bột'],
    portionLabel: '1 đĩa',
    grams: 420,
    kcal: 740,
    proteinG: 55,
    carbsG: 18,
    fatG: 48,
  },
  {
    id: 'd4',
    name: 'Mì ramen cay',
    description: 'Mì ramen với nước dùng đậm vị, sợi mì dai và dầu ớt cay.',
    priceAmount: 79000,
    tags: ['Cay', 'Món Á'],
    portionLabel: '1 tô',
    grams: 520,
    kcal: 860,
    proteinG: 32,
    carbsG: 96,
    fatG: 34,
  },
];
