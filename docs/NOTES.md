# Ghi chú kỹ thuật và việc cần làm

## Trạng thái tích hợp frontend/backend

Backend đã có API và database. Frontend hiện vẫn chủ yếu chạy local bằng:

- mock data trong `src/data/`.
- Zustand in-memory store trong `src/store/`.

Do đó, nếu reload app hoặc restart app, các dữ liệu local như user, cart, fridge item và order có thể mất.

Việc cần làm để tích hợp thật:

- Tạo API client trong frontend, ví dụ `src/services/api.ts`.
- Thêm config base URL cho Expo.
- Login/Register gọi backend.
- FridgeScreen gọi `/api/fridge`.
- OrderScreen/CartScreen gọi `/api/orders`.
- Recipes lấy từ `/api/recipes` hoặc seed database từ mock recipes.

## Encoding tiếng Việt

Nhiều chuỗi trong source đang bị lỗi encoding/mojibake, ví dụ:

```text
Gá»£i Ã½
Tá»§ láº¡nh
Äáº·t Ä‘á»“ Äƒn
```

Nguyên nhân thường gặp:

- File UTF-8 bị đọc/ghi nhầm theo Windows-1252 hoặc encoding khác.
- Copy text qua công cụ không giữ UTF-8.

Ảnh hưởng:

- UI hiển thị tiếng Việt sai.
- Prompt OCR cũng có thể sai.
- Search/match theo tiếng Việt có thể kém chính xác.

Nên sửa:

- Đảm bảo toàn bộ file `.ts`, `.tsx`, `.md` lưu UTF-8.
- Sửa lại các string hiển thị trong frontend.
- Sửa lại message trong backend `env.ts`.
- Kiểm tra font/render trên thiết bị.

## Auth

Hiện chưa có auth thật.

Backend có biến:

- `JWT_SECRET`
- `JWT_EXPIRES_IN`

Nhưng chưa thấy route:

- `POST /auth/login`
- `POST /auth/register`
- middleware verify JWT
- password hashing

Nếu làm auth production:

- Thêm model password hash hoặc bảng credential riêng.
- Hash password bằng bcrypt/argon2.
- Trả access token.
- Bảo vệ route cần user bằng middleware.
- Không tin `userId` từ query/body nếu đã có token.

## Data persistence frontend

Zustand hiện chưa persist. Nếu muốn giữ dữ liệu local khi app restart:

- Dùng `zustand/middleware` persist.
- Dùng AsyncStorage làm storage.
- Chọn store cần persist: app user, fridge, cart, orders.

Khi đã nối backend, nên hạn chế persist dữ liệu server quá lâu để tránh lệch state.

## OCR security

`EXPO_PUBLIC_GEMINI_API_KEY` nằm ở client nên có thể bị trích xuất.

Hướng tốt hơn:

```text
Frontend upload ảnh -> Backend OCR endpoint -> Gemini API -> Backend trả text/items
```

Ưu điểm:

- Giấu API key.
- Có thể rate limit.
- Có thể validate user.
- Có thể log lỗi OCR tập trung.

## Recipe matching

Hiện `recipeMatch.ts` so khớp bằng normalize text:

- lowercase.
- bỏ dấu.
- bỏ ký tự đặc biệt.
- so sánh contains hai chiều.

Ưu điểm:

- Đơn giản.
- Chạy nhanh.
- Không cần database.

Hạn chế:

- Không dùng `Ingredient.aliases` từ backend.
- Không xét quantity đủ hay thiếu.
- Dễ match nhầm với tên nguyên liệu ngắn.

Cải tiến:

- Dùng dictionary ingredient + aliases.
- Match theo ingredient id thay vì text.
- Xét quantity và unit conversion.
- Chấm điểm theo nguyên liệu bắt buộc/tùy chọn.

## Orders

Frontend `OrderStatus` hiện chỉ có:

```ts
'Pending' | 'Preparing' | 'Delivering' | 'Completed'
```

Backend có thêm:

```ts
'Cancelled'
```

Nên đồng bộ type giữa frontend và backend.

## Database migrations

Dockerfile đang dùng:

```sh
npx prisma migrate deploy
```

Đây là cách phù hợp hơn cho deploy public. Khi thay đổi schema, tạo migration mới trong dev rồi deploy bằng:

```sh
npx prisma migrate dev
npx prisma migrate deploy
```

Lý do:

- Có lịch sử thay đổi schema.
- Dễ rollback/kiểm soát deploy.
- Phù hợp làm việc nhóm.

## Testing

Hiện chưa thấy setup test.

Nên bổ sung:

- Backend unit/integration tests cho route validation và Prisma behavior.
- Frontend tests cho util `nutrition`, `recipeMatch`.
- Manual test checklist cho các màn hình chính.

Các case nên test trước:

- Tạo user trùng email.
- Thêm fridge item với quantity/date sai.
- Xóa fridge item không tồn tại.
- Tạo order với item rỗng.
- Recipe matching với tiếng Việt có dấu/không dấu.
- OCR parse receipt text có giá tiền và đơn vị kg/l.
