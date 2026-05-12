# Deploy public backend

Tài liệu này mô tả cách đưa backend SmartBite lên server public ở mức demo/public API cơ bản.

## Trạng thái sau khi harden

Backend hiện đã có thêm:

- Build TypeScript pass bằng `npm run build`.
- Security headers cơ bản.
- In-memory rate limit: 120 request/phút/IP.
- Tắt header `X-Powered-By`.
- `trust proxy` khi chạy production.
- `GET /health/ready` kiểm tra kết nối database.
- Production env chặn `JWT_SECRET=change-me`.
- Production env chặn `CORS_ORIGIN=*`.
- Dockerfile dùng `prisma migrate deploy` thay vì `prisma db push`.
- Prisma initial migration tại `backend/prisma/migrations/000001_init/migration.sql`.

## Biến môi trường bắt buộc

Trên server public, đặt ít nhất:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1h
CORS_ORIGIN=https://your-frontend-domain.example
```

Lưu ý:

- `JWT_SECRET` chưa được auth thật sử dụng nhiều, nhưng vẫn bắt buộc đổi để tránh cấu hình yếu.
- `CORS_ORIGIN` phải là origin frontend thật. Không dùng `*` cho public.
- Nếu deploy mobile app native, CORS không phải lớp bảo mật chính, nhưng vẫn nên giới hạn origin web/admin.

## Cách deploy bằng Docker

Build image:

```sh
docker build -t smartbite-backend ./backend
```

Run container:

```sh
docker run -p 4000:4000 ^
  -e NODE_ENV=production ^
  -e PORT=4000 ^
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public" ^
  -e JWT_SECRET="long-random-secret" ^
  -e CORS_ORIGIN="https://your-frontend-domain.example" ^
  smartbite-backend
```

Container sẽ chạy:

```sh
npx prisma migrate deploy && node dist/index.js
```

Nghĩa là migration được apply trước khi server start.

## Cách deploy trên PaaS

Với các nền tảng như Render, Railway, Fly.io hoặc VPS có Docker:

1. Tạo PostgreSQL database.
2. Lấy `DATABASE_URL`.
3. Deploy service từ thư mục `backend/` hoặc dùng Dockerfile `backend/Dockerfile`.
4. Set environment variables ở phần trên.
5. Expose port theo biến `PORT`.
6. Sau deploy, kiểm tra:

```sh
curl https://your-backend-domain.example/health
curl https://your-backend-domain.example/health/ready
```

Kết quả readiness mong muốn:

```json
{
  "ok": true,
  "database": "up"
}
```

## Deploy bằng Node không Docker

Trong thư mục `backend/`:

```sh
npm ci
npm run build
npm run db:migrate
npm start
```

Server cần có Node.js 20+ và biến môi trường production.

## Database mới và database cũ

Database mới:

- Dùng `prisma migrate deploy` bình thường.
- Migration `000001_init` sẽ tạo toàn bộ table.

Database cũ đã tạo bằng `prisma db push`:

- Có thể lỗi khi chạy migration vì table đã tồn tại.
- Với database dev/demo: reset database rồi chạy lại migration.
- Với database có dữ liệu cần giữ: baseline migration trước khi deploy public.

## Kiểm tra sau deploy

Health:

```sh
curl https://your-backend-domain.example/health
```

Readiness:

```sh
curl https://your-backend-domain.example/health/ready
```

Tạo user thử:

```sh
curl -X POST https://your-backend-domain.example/api/users ^
  -H "Content-Type: application/json" ^
  -d "{\"fullName\":\"Demo User\",\"email\":\"demo@example.com\"}"
```

Lấy users:

```sh
curl https://your-backend-domain.example/api/users
```

## Việc vẫn chưa nên bỏ qua nếu public thật

Backend vẫn chưa có auth/authorization thật. Nếu public API dùng cho dữ liệu người dùng thật, cần làm tiếp:

- Password hashing.
- Login/register thật.
- JWT middleware.
- Không nhận `userId` trực tiếp từ query/body cho dữ liệu riêng tư.
- Bảo vệ route fridge/order theo user trong token.
- Logging request/error.
- Monitoring và backup database.
- Rate limit bằng Redis hoặc service ngoài nếu chạy nhiều instance.

