# Tổng quan kiến trúc

## Mục tiêu hệ thống

SmartBite hỗ trợ người dùng quản lý nhu cầu ăn uống cá nhân:

- Đặt món ăn từ danh sách món có sẵn.
- Xem dinh dưỡng theo món và theo giỏ hàng.
- Quản lý nguyên liệu trong tủ lạnh, số lượng và hạn sử dụng.
- Gợi ý món có thể nấu dựa trên nguyên liệu trong tủ lạnh.
- Quét hóa đơn để thêm nhanh nguyên liệu vào tủ lạnh.
- Theo dõi đơn hàng sau khi đặt.

## Các khối chính

```text
Mobile App (Expo React Native)
  |
  | dự kiến gọi HTTP API
  v
Backend API (Express + TypeScript)
  |
  | Prisma Client
  v
PostgreSQL
```

Hiện tại frontend chưa được nối đầy đủ vào backend. Các màn hình đang dùng mock data và Zustand local state là chính. Backend đã có API và database schema để làm nguồn dữ liệu thật trong bước tích hợp tiếp theo.

## Backend

Backend nằm trong `backend/`.

Vai trò:

- Nhận request HTTP từ client.
- Validate input bằng Zod.
- Truy cập PostgreSQL qua Prisma Client.
- Trả response JSON cho frontend.

Entry point:

- `backend/src/index.ts`: khởi động server, connect database, xử lý shutdown.
- `backend/src/app.ts`: tạo Express app, khai báo middleware và route.

## Frontend

Frontend nằm trong `frontend/`.

Vai trò:

- Hiển thị UI mobile.
- Điều hướng bằng React Navigation.
- Quản lý state bằng Zustand.
- Hiển thị dữ liệu món ăn, tủ lạnh, giỏ hàng, đơn hàng.
- OCR ảnh hóa đơn bằng Gemini API.

Entry point:

- `frontend/App.tsx`: bọc app bằng navigation và safe area.
- `frontend/src/navigation/RootNavigator.tsx`: chọn luồng auth hoặc main app.
- `frontend/src/navigation/TabNavigator.tsx`: các tab chính sau khi đăng nhập.

## Dữ liệu hiện tại

Nguồn dữ liệu trong frontend:

- Món ăn đặt hàng: `frontend/src/data/mockFood.ts`.
- Công thức nấu ăn: `frontend/src/data/mockRecipes.ts`.
- Tủ lạnh: Zustand local state trong `useFridgeStore`.
- Giỏ hàng: Zustand local state trong `useCartStore`.
- Đơn hàng: Zustand local state trong `useOrderStore`.
- User: Zustand local state trong `useAppStore`.

Nguồn dữ liệu backend:

- PostgreSQL.
- Prisma schema: `backend/prisma/schema.prisma`.

## Luồng dữ liệu dự kiến

Luồng đăng ký:

```text
RegisterScreen -> POST /api/users -> User trong database -> set user ở frontend
```

Luồng tủ lạnh:

```text
FridgeScreen -> GET/POST/PATCH/DELETE /api/fridge -> FridgeItem trong database
```

Luồng món ăn/công thức:

```text
HomeScreen/CookSuggestionScreen -> GET /api/recipes hoặc API món ăn riêng -> render danh sách
```

Luồng đặt hàng:

```text
CartScreen -> POST /api/orders -> Order trong database -> OrderScreen đọc GET /api/orders
```

## Deployment

Repo có:

- `docker-compose.yml`: chạy PostgreSQL và backend.
- `backend/Dockerfile`: build backend production image.
- `.vercel/`, `.vercelignore`, `vercel.json`: có dấu hiệu từng cấu hình deploy qua Vercel.

Frontend Expo thường chạy qua Expo CLI, Expo Go, dev client hoặc EAS build.

