# Backend

## Công nghệ

Backend dùng:

- Node.js 20 trong Dockerfile.
- Express 5.
- TypeScript.
- Prisma Client.
- PostgreSQL.
- Zod để validate request body/query/params.
- dotenv để đọc biến môi trường.

## Cấu trúc thư mục

```text
backend/
  prisma/
    schema.prisma       Schema database
  src/
    app.ts              Khai báo Express app và routes
    index.ts            Entry point server
    db.ts               Hàm connect/disconnect Prisma
    prisma.ts           Khởi tạo PrismaClient
    env.ts              Validate và build env
    routes/
      health.ts
      users.ts
      ingredients.ts
      fridge.ts
      recipes.ts
      orders.ts
  Dockerfile
  package.json
  tsconfig.json
  nodemon.json
```

## Scripts

Trong `backend/package.json`:

```json
{
  "dev": "nodemon",
  "build": "npx prisma generate && tsc -p tsconfig.json",
  "start": "node dist/index.js",
  "postinstall": "npx prisma generate"
}
```

Ý nghĩa:

- `npm run dev`: chạy backend bằng nodemon/ts-node theo `nodemon.json`.
- `npm run build`: generate Prisma Client và compile TypeScript sang `dist/`.
- `npm start`: chạy bản đã build trong `dist/index.js`.
- `postinstall`: tự generate Prisma Client sau khi cài dependency.

## Biến môi trường

File mẫu: `backend/.env.example`.

Các biến chính:

```env
PORT=4000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=5433
DB_USER=smartbite
DB_PASS=smartbite
DB_NAME=smartbite

DATABASE_URL=postgresql://smartbite:smartbite@127.0.0.1:5433/smartbite?schema=public

JWT_SECRET=your_jwt_secret_key-change-in-production
JWT_EXPIRES_IN=1h

CORS_ORIGIN=http://localhost:8081
```

Backend hỗ trợ 2 cách cấu hình database:

- Dùng trực tiếp `DATABASE_URL`.
- Hoặc dùng bộ biến `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`; code sẽ build `DATABASE_URL` nếu chưa có.

Lưu ý: `JWT_SECRET` và `JWT_EXPIRES_IN` đã có trong env nhưng hiện chưa thấy route auth/JWT thật.

## Khởi động server

File `src/index.ts`:

1. Gọi `connectDb()`.
2. Tạo Express app bằng `buildApp()`.
3. Listen trên `env.PORT`.
4. Bắt `SIGINT` và `SIGTERM` để đóng server, disconnect database rồi exit.

Nếu có lỗi khi start, lỗi được ghi ra stderr và process exit code 1.

## Express app

File `src/app.ts`:

Middleware:

- `cors(...)`: cho phép origin theo `CORS_ORIGIN`.
- `express.json({ limit: '2mb' })`: parse JSON body.

Routes:

- `/health`
- `/api/users`
- `/api/ingredients`
- `/api/fridge`
- `/api/recipes`
- `/api/orders`

Error handler:

- Nếu lỗi là `ZodError`, trả `400` với `{ message, issues }`.
- Các lỗi còn lại trả `500 Internal Server Error`.

## Prisma client

File `src/prisma.ts`:

- Đọc env bằng dotenv.
- Nếu chưa có `DATABASE_URL`, build URL từ các biến `DB_*`.
- Export singleton `prisma = new PrismaClient()`.

File `src/db.ts`:

- `connectDb()`: gọi `prisma.$connect()`.
- `disconnectDb()`: gọi `prisma.$disconnect()`.

## Route users

File `src/routes/users.ts`.

Chức năng:

- `POST /api/users`: tạo user mới.
- `GET /api/users`: lấy tối đa 50 user mới nhất.

Validation tạo user:

- `fullName`: string không rỗng.
- `email`: email hợp lệ.
- `phone`: optional, tối thiểu 6 ký tự.

Khi tạo user, `tasteProfile` và `allergies` mặc định là mảng rỗng.

## Route ingredients

File `src/routes/ingredients.ts`.

Chức năng:

- `GET /api/ingredients`: lấy tối đa 200 nguyên liệu, sort theo tên.
- `POST /api/ingredients`: tạo ingredient.

Ingredient gồm:

- `name`: tên duy nhất.
- `aliases`: các tên gọi khác.

## Route fridge

File `src/routes/fridge.ts`.

Chức năng:

- `GET /api/fridge?userId=...`: lấy danh sách nguyên liệu trong tủ lạnh của user.
- `POST /api/fridge`: thêm nguyên liệu vào tủ lạnh.
- `PATCH /api/fridge/:id`: sửa nguyên liệu.
- `DELETE /api/fridge/:id`: xóa nguyên liệu.

Đơn vị hợp lệ:

- `g`
- `ml`
- `pcs`

Ngày hết hạn dùng format `YYYY-MM-DD`.

Khi lưu `quantity`, backend dùng `Math.floor()` để đưa về số nguyên.

## Route recipes

File `src/routes/recipes.ts`.

Chức năng:

- `GET /api/recipes`: lấy tối đa 100 recipe.
- `POST /api/recipes`: tạo recipe.

Recipe gồm:

- `name`
- `description`
- `tags`
- `timeMin`
- `servings`
- `imageUrl`
- `ingredients`
- `steps`

`ingredients` được lưu dạng JSON trong database.

## Route orders

File `src/routes/orders.ts`.

Chức năng:

- `GET /api/orders?userId=...`: lấy tối đa 100 đơn của user.
- `POST /api/orders`: tạo order.
- `PATCH /api/orders/:id/status`: cập nhật trạng thái đơn.

Khi tạo order:

- Client gửi danh sách item, quantity, price.
- Backend tự tính `subtotalAmount`.
- `totalAmount = subtotalAmount + deliveryFeeAmount`.
- Currency cố định là `VND`.
- Status mặc định là `Pending`.

Trạng thái hợp lệ:

- `Pending`
- `Preparing`
- `Delivering`
- `Completed`
- `Cancelled`

## Docker backend

`backend/Dockerfile` có 3 stage:

- `deps`: cài dependency và generate Prisma.
- `build`: compile TypeScript.
- `runner`: cài production dependency, generate Prisma, copy `dist`.

Command container:

```sh
until npx prisma db push; do sleep 2; done; node dist/index.js
```

Nghĩa là container sẽ cố `prisma db push` tới khi database sẵn sàng, sau đó chạy server.

