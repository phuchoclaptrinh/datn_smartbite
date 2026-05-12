# Cách chạy project

## Yêu cầu môi trường

Nên có:

- Node.js 20 hoặc mới tương thích.
- npm.
- Docker Desktop nếu chạy PostgreSQL/backend bằng Docker.
- Expo tooling cho frontend.
- Android emulator, thiết bị Android, hoặc Expo Go/dev client.

## Chạy bằng Docker Compose

Ở root repo:

```sh
docker compose up --build
```

Compose sẽ chạy:

- PostgreSQL tại host port `5433`, container port `5432`.
- Backend tại `http://localhost:4000`.

Health check:

```sh
curl http://localhost:4000/health
```

Kết quả mong muốn:

```json
{"ok":true}
```

Readiness check có kiểm tra database:

```sh
curl http://localhost:4000/health/ready
```

## Chạy backend local

Đi tới thư mục backend:

```sh
cd backend
```

Cài dependency:

```sh
npm install
```

Tạo file `.env` từ `.env.example` nếu chưa có.

Nếu dùng PostgreSQL từ Docker Compose, database local là:

```env
DATABASE_URL=postgresql://smartbite:smartbite@127.0.0.1:5433/smartbite?schema=public
```

Đẩy schema vào database:

```sh
npx prisma db push
```

Với môi trường server/public, dùng migration thay vì `db push`:

```sh
npm run db:migrate
```

Chạy dev:

```sh
npm run dev
```

Build:

```sh
npm run build
```

Chạy bản build:

```sh
npm start
```

## Chạy frontend

Đi tới thư mục frontend:

```sh
cd frontend
```

Cài dependency:

```sh
npm install
```

Chạy Expo:

```sh
npm start
```

Chạy Android:

```sh
npm run android
```

Chạy web:

```sh
npm run web
```

Lưu ý: script trong `frontend/package.json` đang set:

```text
USERPROFILE=D:\DATN\frontend\.expo
HOME=D:\DATN\frontend\.expo
```

Điều này giúp Expo ghi cache/config vào thư mục local của project.

## OCR hóa đơn

Để dùng chức năng OCR trong `FridgeScreen`, frontend cần biến:

```env
EXPO_PUBLIC_GEMINI_API_KEY=your_api_key
```

Vì đây là biến public trong client app, không nên dùng key nhạy cảm cho production. Nên chuyển qua backend proxy nếu triển khai thật.

## Kiểm tra nhanh API

Tạo user:

```sh
curl -X POST http://localhost:4000/api/users ^
  -H "Content-Type: application/json" ^
  -d "{\"fullName\":\"Nguyen Van A\",\"email\":\"a@example.com\"}"
```

Lấy users:

```sh
curl http://localhost:4000/api/users
```

Tạo ingredient:

```sh
curl -X POST http://localhost:4000/api/ingredients ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"trung\",\"aliases\":[\"egg\"]}"
```

## Kiểm tra TypeScript

Backend:

```sh
cd backend
npm run build
```

Frontend hiện chưa có script typecheck riêng. Có thể thêm script sau:

```json
{
  "typecheck": "tsc --noEmit"
}
```

Sau đó chạy:

```sh
npm run typecheck
```

## Reset database dev

Nếu cần xóa dữ liệu Docker volume PostgreSQL, phải cẩn thận vì thao tác này mất dữ liệu.

Command thường dùng:

```sh
docker compose down -v
docker compose up --build
```

Chỉ dùng khi chắc chắn muốn xóa database dev.

## Lưu ý khi đổi sang migration

Backend Dockerfile hiện dùng:

```sh
npx prisma migrate deploy
```

Nếu database cũ đã từng được tạo bằng `prisma db push` nhưng chưa có bảng `_prisma_migrations`, migration đầu tiên có thể lỗi vì table đã tồn tại. Với database dev có thể reset volume. Với database production đã có dữ liệu, cần baseline migration trước khi deploy.
