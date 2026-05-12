# SmartBite DATN

SmartBite là project đồ án gồm ứng dụng di động Expo React Native và backend Express/Prisma/PostgreSQL. Ứng dụng tập trung vào các luồng: đăng nhập/đăng ký, đặt món, giỏ hàng, quản lý tủ lạnh, gợi ý nấu ăn theo nguyên liệu có sẵn, OCR hóa đơn và theo dõi đơn hàng.

## Cấu trúc repo

```text
DATN/
  backend/              API server Express + Prisma
  frontend/             Ứng dụng Expo React Native
  docker-compose.yml    PostgreSQL + backend container
  vercel.json           Cấu hình deploy hiện có
```

## Tài liệu chi tiết

- [Tổng quan kiến trúc](docs/ARCHITECTURE.md)
- [Backend](docs/BACKEND.md)
- [Frontend](docs/FRONTEND.md)
- [Database](docs/DATABASE.md)
- [API](docs/API.md)
- [Cách chạy project](docs/RUNBOOK.md)
- [Deploy public backend](docs/DEPLOY_PUBLIC.md)
- [Ghi chú kỹ thuật và việc cần làm](docs/NOTES.md)

## Trạng thái hiện tại

- Backend đã có API cho user, ingredient, fridge, recipe và order.
- Frontend hiện chủ yếu dùng mock data và Zustand local state, chưa nối trực tiếp vào API backend.
- Database schema đã định nghĩa bằng Prisma trong `backend/prisma/schema.prisma`.
- OCR hóa đơn ở frontend gọi Gemini API qua biến môi trường `EXPO_PUBLIC_GEMINI_API_KEY`.
- Một số chuỗi tiếng Việt trong source đang bị lỗi encoding/mojibake, cần sửa trước khi demo UI tiếng Việt.
