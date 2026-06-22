import fs from 'fs';
import path from 'path';

type SourceDish = {
  id: string;
  name_vi: string;
  name_normalized?: string;
  category?: string;
  ingredients?: unknown[];
  type?: string;
};

type MenuTarget = {
  name: string;
  query: string;
  category: string;
};

const targets: MenuTarget[] = [
  { name: 'Cơm chiên Dương Châu', query: 'com chien duong chau', category: 'mon chien' },
  { name: 'Cơm gà xối mỡ', query: 'com ga chien xoi mo', category: 'mon chien' },
  { name: 'Mề gà chiên nước mắm', query: 'me ga chien nuoc mam', category: 'mon chien' },
  { name: 'Cánh gà chiên bơ tỏi', query: 'canh ga chien bo toi', category: 'mon chien' },
  { name: 'Gà chiên giòn', query: 'ga chien gion', category: 'mon chien' },
  { name: 'Sườn chiên nước mắm', query: 'suon chien nuoc mam', category: 'mon chien' },
  { name: 'Tôm chiên xù', query: 'tom chien xu', category: 'mon chien' },
  { name: 'Tôm chiên bơ tỏi', query: 'tom chien bo toi', category: 'mon chien' },
  { name: 'Mực chiên nước mắm', query: 'muc chien nuoc mam', category: 'mon chien' },
  { name: 'Cá hồi chiên sốt xoài', query: 'ca hoi chien sot xoai', category: 'mon chien' },
  { name: 'Đậu hũ chiên sả ớt', query: 'dau hu chien sa ot', category: 'mon chien' },
  { name: 'Chả giò hải sản', query: 'cha gio hai san', category: 'mon chien' },

  { name: 'Bò lúc lắc', query: 'bo luc lac', category: 'mon xao' },
  { name: 'Rau củ xào bơ tỏi', query: 'rau cu xao thap cam bo toi', category: 'mon xao' },
  { name: 'Bò xào bông thiên lý', query: 'bo xao bong thien ly', category: 'mon xao' },
  { name: 'Gà xào sả ớt', query: 'ga xao sa ot', category: 'mon xao' },
  { name: 'Ức gà xào cần tây hạt điều', query: 'uc ga xao can tay hat dieu', category: 'mon xao' },
  { name: 'Sườn xào chua ngọt', query: 'suon xao chua ngot', category: 'mon xao' },
  { name: 'Mực khô xào chua ngọt', query: 'muc kho xao chua ngot', category: 'mon xao' },
  { name: 'Mực xào cần tỏi', query: 'muc xao can toi', category: 'mon xao' },
  { name: 'Tôm xào rau củ', query: 'tom xao rau cu', category: 'mon xao' },
  { name: 'Rau muống xào tỏi', query: 'rau muong xao toi', category: 'mon xao' },
  { name: 'Mì xào hải sản', query: 'mi xao hai san', category: 'mon xao' },
  { name: 'Cải thìa xào nấm', query: 'cai thia xao nam', category: 'mon xao' },

  { name: 'Canh chua cá', query: 'canh chua ca', category: 'mon canh' },
  { name: 'Canh chua tôm', query: 'canh chua tom', category: 'mon canh' },
  { name: 'Canh gà lá giang', query: 'canh ga la giang', category: 'mon canh' },
  { name: 'Canh khổ qua nhồi thịt', query: 'canh kho qua nhoi thit', category: 'mon canh' },
  { name: 'Canh bí đỏ thịt bằm', query: 'canh bi do thit bam', category: 'mon canh' },
  { name: 'Canh rau ngót thịt bằm', query: 'canh rau ngot thit bam', category: 'mon canh' },
  { name: 'Canh bắp cải thịt bằm', query: 'canh bap cai thit bam', category: 'mon canh' },
  { name: 'Canh cua rau đay', query: 'canh cua rau day', category: 'mon canh' },
  { name: 'Canh sườn non rau củ', query: 'canh suon non ham rau cu', category: 'mon canh' },
  { name: 'Canh kim chi', query: 'canh kim chi', category: 'mon canh' },

  { name: 'Thịt kho trứng cút', query: 'thit kho trung cut', category: 'mon kho' },
  { name: 'Gà kho gừng', query: 'ga kho gung', category: 'mon kho' },
  { name: 'Gà kho sả', query: 'ga kho sa', category: 'mon kho' },
  { name: 'Cá kho tộ', query: 'ca kho to', category: 'mon kho' },
  { name: 'Cá lóc kho tiêu', query: 'ca loc kho tieu', category: 'mon kho' },
  { name: 'Cá thu kho thơm', query: 'ca thu kho thom', category: 'mon kho' },
  { name: 'Sườn non kho tiêu', query: 'suon non kho tieu', category: 'mon kho' },
  { name: 'Bò kho', query: 'bo kho', category: 'mon kho' },
  { name: 'Tôm kho tàu', query: 'tom kho tau', category: 'mon kho' },
  { name: 'Đậu hũ kho nấm', query: 'dau hu kho nam', category: 'mon kho' },

  { name: 'Gà nướng muối ớt', query: 'ga nuong muoi ot', category: 'mon nuong' },
  { name: 'Gà nướng mật ong', query: 'ga nuong mat ong', category: 'mon nuong' },
  { name: 'Gà nướng sa tế', query: 'ga nuong sa te', category: 'mon nuong' },
  { name: 'Sườn nướng', query: 'suon nuong', category: 'mon nuong' },
  { name: 'Ba chỉ nướng chao', query: 'thit ba chi nuong chao', category: 'mon nuong' },
  { name: 'Bò nướng lá lốt', query: 'bo nuong la lot', category: 'mon nuong' },
  { name: 'Bò nướng sa tế', query: 'bo nuong sa te', category: 'mon nuong' },
  { name: 'Tôm nướng muối ớt', query: 'tom nuong muoi ot', category: 'mon nuong' },
  { name: 'Mực nướng sa tế', query: 'muc nuong sa te', category: 'mon nuong' },
  { name: 'Cá ồ nướng muối ớt', query: 'ca o nuong muoi ot', category: 'mon nuong' },
  { name: 'Cá hồi nướng', query: 'ca hoi nuong', category: 'mon nuong' },
  { name: 'Hàu nướng mỡ hành', query: 'hau nuong mo hanh', category: 'mon nuong' },

  { name: 'Gỏi gà bắp cải', query: 'goi ga bap cai', category: 'mon goi - salad' },
  { name: 'Gỏi bò tái me', query: 'goi bo tai me', category: 'mon goi - salad' },
  { name: 'Gỏi ổi tôm thịt', query: 'goi oi tom thit', category: 'mon goi - salad' },
  { name: 'Gỏi ngó sen chay', query: 'goi ngo sen chay', category: 'mon goi - salad' },
  { name: 'Gỏi xoài tôm khô', query: 'goi xoai tom kho', category: 'mon goi - salad' },
  { name: 'Salad cá ngừ', query: 'salad ca ngu', category: 'mon goi - salad' },
  { name: 'Salad ức gà', query: 'salad uc ga', category: 'mon goi - salad' },
  { name: 'Salad rau củ', query: 'salad rau cu', category: 'mon goi - salad' },

  { name: 'Phở bò Hà Nội', query: 'pho bo ha noi', category: 'mon nuoc' },
  { name: 'Phở gà', query: 'pho ga', category: 'mon nuoc' },
  { name: 'Bún bò Huế', query: 'bun bo hue', category: 'mon nuoc' },
  { name: 'Bún riêu giò heo', query: 'bun rieu gio heo', category: 'mon nuoc' },
  { name: 'Bún chả sứa', query: 'bun cha sua', category: 'mon nuoc' },
  { name: 'Bún thịt nướng', query: 'bun thit nuong', category: 'mon nuoc' },
  { name: 'Mì Quảng gà', query: 'mi quang ga', category: 'mon nuoc' },
  { name: 'Hủ tiếu Nam Vang', query: 'hu tieu nam vang', category: 'mon nuoc' },
  { name: 'Bánh canh cua', query: 'banh canh cua', category: 'mon nuoc' },
  { name: 'Bún cá cờ', query: 'bun ca co', category: 'mon nuoc' },

  { name: 'Lẩu Thái', query: 'lau thai', category: 'mon lau' },
  { name: 'Lẩu hải sản', query: 'lau hai san', category: 'mon lau' },
  { name: 'Lẩu bò', query: 'lau bo', category: 'mon lau' },
  { name: 'Lẩu gà lá giang', query: 'lau ga la giang', category: 'mon lau' },
  { name: 'Lẩu cá kèo', query: 'lau ca keo', category: 'mon lau' },
  { name: 'Lẩu nấm chay', query: 'lau nam chay', category: 'mon lau' },
  { name: 'Lẩu kim chi chay', query: 'lau kim chi chay', category: 'mon lau' },
  { name: 'Lẩu mực chua cay', query: 'lau muc chua cay', category: 'mon lau' },

  { name: 'Gà hấp hành', query: 'ga hap hanh', category: 'mon hap' },
  { name: 'Gà hấp lá é', query: 'ga hap la e', category: 'mon hap' },
  { name: 'Cá sủ hấp xì dầu', query: 'ca su hap xi dau', category: 'mon hap' },
  { name: 'Cá chép hấp gừng', query: 'ca chep hap gung', category: 'mon hap' },
  { name: 'Tôm càng xanh hấp bia', query: 'cach hap tom cang xanh voi bia', category: 'mon hap' },
  { name: 'Mực trứng hấp gừng', query: 'muc trung hap gung', category: 'mon hap' },
  { name: 'Ghẹ hấp sả', query: 'ghe hap sa', category: 'mon hap' },
  { name: 'Sườn hấp bí đao', query: 'suon hap bi dao', category: 'mon hap' },

  { name: 'Cháo gà đậu đen', query: 'chao ga dau den', category: 'mon chao' },
  { name: 'Cháo dựng bò', query: 'chao dung bo', category: 'mon chao' },
  { name: 'Cháo lòng', query: 'chao long', category: 'mon chao' },
  { name: 'Cháo tôm', query: 'chao tom', category: 'mon chao' },

  { name: 'Bánh đa xào chay', query: 'banh da xao chay', category: 'mon chay' },
  { name: 'Miến trộn chay', query: 'mien tron chay', category: 'mon chay' },
  { name: 'Nem nấm chay', query: 'nem chay nam', category: 'mon chay' },
  { name: 'Đậu hũ sốt cà chua', query: 'dau hu sot ca chua', category: 'mon chay' },
  { name: 'Bánh xèo', query: 'banh xeo', category: 'mon banh' },
  { name: 'Chè khúc bạch sầu riêng', query: 'che khuc bach sau rieng', category: 'mon trang mieng' },
];

const rankCandidate = (dish: SourceDish, target: MenuTarget) => {
  const value = dish.name_normalized ?? '';
  const categoryPenalty = dish.category === target.category ? 0 : 250;
  if (value === target.query) return categoryPenalty;
  if (value.startsWith(`${target.query} `)) return 10 + categoryPenalty + value.length;
  if (value.includes(target.query)) return 100 + categoryPenalty + value.length;

  const queryTokens = new Set(target.query.split(' '));
  const valueTokens = new Set(value.split(' '));
  const matchingTokens = [...queryTokens].filter((token) => valueTokens.has(token)).length;
  const requiredMatches = queryTokens.size <= 2 ? queryTokens.size : Math.max(2, queryTokens.size - 1);
  if (matchingTokens < requiredMatches) return Number.POSITIVE_INFINITY;

  const missingTokens = queryTokens.size - matchingTokens;
  const extraTokens = Math.max(0, valueTokens.size - matchingTokens);
  return 1000 + missingTokens * 1000 + categoryPenalty + extraTokens * 20 + value.length;
};

const main = () => {
  const sourcePath = process.argv[2];
  if (!sourcePath) throw new Error('Usage: npm run select:dishes -- <dish_knowledge_base.json>');

  const source = JSON.parse(fs.readFileSync(path.resolve(sourcePath), 'utf8')) as SourceDish[];
  const selected: SourceDish[] = [];
  const usedIds = new Set<string>();
  const missing: MenuTarget[] = [];

  for (const target of targets) {
    const match = source
      .filter((dish) => !usedIds.has(dish.id))
      .map((dish) => ({ dish, rank: rankCandidate(dish, target) }))
      .filter((item) => Number.isFinite(item.rank))
      .sort((left, right) => left.rank - right.rank)[0]?.dish;

    if (!match) {
      missing.push(target);
      continue;
    }

    usedIds.add(match.id);
    selected.push({ ...match, name_vi: target.name, name_normalized: target.query, category: target.category });
    process.stdout.write(`${target.name} <- ${match.name_vi}\n`);
  }

  if (missing.length) {
    throw new Error(`Missing ${missing.length} dishes:\n${missing.map((item) => `${item.category}: ${item.name} (${item.query})`).join('\n')}`);
  }
  if (selected.length !== 100) throw new Error(`Expected 100 selected dishes, found ${selected.length}`);

  const outputPath = path.resolve(process.cwd(), 'prisma', 'data', 'dish_knowledge_sample.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(selected, null, 2)}\n`, 'utf8');
  process.stdout.write(`Selected ${selected.length} commercial dishes into ${outputPath}\n`);
};

main();
