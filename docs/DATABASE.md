# Database

Database dùng PostgreSQL, schema được quản lý bằng Prisma tại `backend/prisma/schema.prisma`.

## Datasource và generator

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Backend cần `DATABASE_URL` hợp lệ trước khi Prisma Client hoạt động.

## Enum

### FridgeUnit

```prisma
enum FridgeUnit {
  g
  ml
  pcs
}
```

Dùng cho đơn vị nguyên liệu trong tủ lạnh và recipe.

Ý nghĩa:

- `g`: gram.
- `ml`: milliliter.
- `pcs`: đơn vị/cái/phần.

### OrderStatus

```prisma
enum OrderStatus {
  Pending
  Preparing
  Delivering
  Completed
  Cancelled
}
```

Dùng để quản lý trạng thái đơn hàng.

## Model User

```prisma
model User {
  id           String       @id @default(cuid())
  fullName     String
  email        String       @unique
  phone        String?
  tasteProfile String[]
  allergies    String[]
  fridgeItems  FridgeItem[]
  orders       Order[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
}
```

Vai trò:

- Lưu thông tin người dùng.
- Liên kết với nguyên liệu trong tủ lạnh.
- Liên kết với đơn hàng.

Ràng buộc:

- `email` là duy nhất.
- Khi user bị xóa, fridge item bị xóa cascade.
- Order dùng `onDelete: Restrict`, nên không thể xóa user nếu còn order phụ thuộc.

## Model Ingredient

```prisma
model Ingredient {
  id        String   @id @default(cuid())
  name      String   @unique
  aliases   String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Vai trò:

- Lưu danh mục nguyên liệu chuẩn.
- `aliases` dùng để lưu tên thay thế, ví dụ một nguyên liệu có nhiều cách gọi.

Hiện route ingredient đã có API tạo và lấy danh sách, nhưng frontend chưa dùng trực tiếp.

## Model FridgeItem

```prisma
model FridgeItem {
  id         String     @id @default(cuid())
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  name       String
  quantity   Int
  unit       FridgeUnit
  expiryDate DateTime?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  @@index([userId, name])
}
```

Vai trò:

- Lưu từng nguyên liệu người dùng đang có trong tủ lạnh.

Các trường quan trọng:

- `userId`: chủ sở hữu item.
- `name`: tên nguyên liệu.
- `quantity`: số lượng.
- `unit`: đơn vị.
- `expiryDate`: hạn sử dụng, optional.

Index:

- `@@index([userId, name])` hỗ trợ query theo user và tên nguyên liệu.

## Model Recipe

```prisma
model Recipe {
  id          String   @id @default(cuid())
  name        String
  description String
  tags        String[]
  timeMin     Int
  servings    Int
  imageUrl    String?
  ingredients Json
  steps       String[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Vai trò:

- Lưu công thức nấu ăn.

Lưu ý:

- `ingredients` đang là `Json`, linh hoạt nhưng ít ràng buộc database hơn model quan hệ.
- `steps` là mảng string.

Ví dụ `ingredients`:

```json
[
  { "name": "trứng", "quantity": 2, "unit": "pcs" },
  { "name": "hành lá", "optional": true }
]
```

## Model Order

```prisma
model Order {
  id                String      @id @default(cuid())
  userId            String
  user              User        @relation(fields: [userId], references: [id], onDelete: Restrict)
  items             Json
  subtotalAmount    Int
  deliveryFeeAmount Int
  totalAmount       Int
  currency          String      @default("VND")
  status            OrderStatus @default(Pending)
  note              String?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([userId, createdAt])
}
```

Vai trò:

- Lưu đơn hàng của user.

Các trường tiền:

- `subtotalAmount`: tổng tiền món.
- `deliveryFeeAmount`: phí giao hàng.
- `totalAmount`: tổng cuối cùng.
- `currency`: mặc định `VND`.

`items` đang là JSON để lưu snapshot món tại thời điểm đặt hàng.

Ví dụ `items`:

```json
[
  {
    "dishId": "d1",
    "name": "Chicken Pho",
    "quantity": 2,
    "price": { "amount": 55000, "currency": "VND" }
  }
]
```

## Cách đồng bộ schema

Trong môi trường dev có thể dùng:

```sh
npx prisma db push
```

Dockerfile backend cũng đang chạy `npx prisma db push` trước khi start server.

Nếu cần migration lịch sử rõ ràng hơn cho production, nên dùng:

```sh
npx prisma migrate dev
npx prisma migrate deploy
```

