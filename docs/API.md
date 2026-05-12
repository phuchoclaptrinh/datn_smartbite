# API

Base URL local mặc định:

```text
http://localhost:4000
```

Response JSON. Request body JSON.

## Health

### GET /health

Kiểm tra server sống.

Response:

```json
{
  "ok": true
}
```

### GET /health/ready

Kiểm tra server sẵn sàng phục vụ, bao gồm kết nối database.

Response khi database kết nối được:

```json
{
  "ok": true,
  "database": "up"
}
```

Response khi database lỗi:

```json
{
  "ok": false,
  "database": "down"
}
```

## Users

### POST /api/users

Tạo user.

Request:

```json
{
  "fullName": "Nguyen Van A",
  "email": "a@example.com",
  "phone": "0900000000"
}
```

`phone` optional.

Response `201`:

```json
{
  "id": "clx..."
}
```

Validation:

- `fullName`: bắt buộc.
- `email`: email hợp lệ.
- `phone`: optional, tối thiểu 6 ký tự.

### GET /api/users

Lấy tối đa 50 user mới nhất.

Response:

```json
[
  {
    "id": "clx...",
    "profile": {
      "fullName": "Nguyen Van A",
      "email": "a@example.com",
      "phone": "0900000000"
    },
    "preferences": {
      "tasteProfile": [],
      "allergies": []
    },
    "createdAt": "2026-05-12T00:00:00.000Z",
    "updatedAt": "2026-05-12T00:00:00.000Z"
  }
]
```

## Ingredients

### GET /api/ingredients

Lấy tối đa 200 nguyên liệu, sort theo `name`.

Response:

```json
[
  {
    "id": "clx...",
    "name": "trung",
    "aliases": ["egg"]
  }
]
```

### POST /api/ingredients

Tạo ingredient.

Request:

```json
{
  "name": "trung",
  "aliases": ["egg", "trung ga"]
}
```

Response `201`:

```json
{
  "id": "clx..."
}
```

## Fridge

### GET /api/fridge?userId=:userId

Lấy danh sách item trong tủ lạnh của user.

Response:

```json
[
  {
    "id": "clx...",
    "userId": "user-id",
    "name": "trung",
    "quantity": 12,
    "unit": "pcs",
    "expiryDate": "2026-05-20",
    "createdAt": "2026-05-12T00:00:00.000Z",
    "updatedAt": "2026-05-12T00:00:00.000Z"
  }
]
```

### POST /api/fridge

Thêm item vào tủ lạnh.

Request:

```json
{
  "userId": "user-id",
  "name": "sua tuoi",
  "quantity": 1000,
  "unit": "ml",
  "expiryDate": "2026-05-20"
}
```

`expiryDate` optional.

Response `201`:

```json
{
  "id": "clx..."
}
```

### PATCH /api/fridge/:id

Cập nhật item.

Request:

```json
{
  "name": "sua tuoi",
  "quantity": 500,
  "unit": "ml",
  "expiryDate": "2026-05-18"
}
```

Tất cả field đều optional. `expiryDate` có thể là `null` để xóa hạn sử dụng.

Response:

```json
{
  "ok": true
}
```

Nếu không tìm thấy:

```json
{
  "message": "Not found"
}
```

### DELETE /api/fridge/:id

Xóa item.

Response:

```json
{
  "ok": true
}
```

## Recipes

### GET /api/recipes

Lấy tối đa 100 recipe.

Response:

```json
[
  {
    "id": "clx...",
    "name": "Trung chien hanh",
    "description": "Mon nhanh gon",
    "tags": ["Nhanh"],
    "timeMin": 10,
    "servings": 1,
    "imageUrl": "https://example.com/image.jpg",
    "ingredients": [
      { "name": "trung", "quantity": 2, "unit": "pcs" }
    ],
    "steps": ["Dap trung", "Chien vang"],
    "createdAt": "2026-05-12T00:00:00.000Z",
    "updatedAt": "2026-05-12T00:00:00.000Z"
  }
]
```

### POST /api/recipes

Tạo recipe.

Request:

```json
{
  "name": "Trung chien hanh",
  "description": "Mon nhanh gon",
  "tags": ["Nhanh", "Don gian"],
  "timeMin": 10,
  "servings": 1,
  "imageUrl": "https://example.com/image.jpg",
  "ingredients": [
    {
      "name": "trung",
      "quantity": 2,
      "unit": "pcs"
    },
    {
      "name": "hanh la",
      "optional": true
    }
  ],
  "steps": ["Dap trung", "Chien vang"]
}
```

Response `201`:

```json
{
  "id": "clx..."
}
```

## Orders

### GET /api/orders?userId=:userId

Lấy tối đa 100 order của user.

Response:

```json
[
  {
    "id": "clx...",
    "userId": "user-id",
    "items": [
      {
        "dishId": "d1",
        "name": "Chicken Pho",
        "quantity": 2,
        "price": { "amount": 55000, "currency": "VND" }
      }
    ],
    "subtotal": { "amount": 110000, "currency": "VND" },
    "deliveryFee": { "amount": 15000, "currency": "VND" },
    "total": { "amount": 125000, "currency": "VND" },
    "status": "Pending",
    "note": "Khong hanh",
    "createdAt": "2026-05-12T00:00:00.000Z",
    "updatedAt": "2026-05-12T00:00:00.000Z"
  }
]
```

### POST /api/orders

Tạo order.

Request:

```json
{
  "userId": "user-id",
  "items": [
    {
      "dishId": "d1",
      "name": "Chicken Pho",
      "quantity": 2,
      "price": {
        "amount": 55000,
        "currency": "VND"
      }
    }
  ],
  "deliveryFee": {
    "amount": 15000,
    "currency": "VND"
  },
  "note": "Khong hanh"
}
```

Backend tự tính:

- `subtotalAmount`
- `totalAmount`
- `currency = VND`
- `status = Pending`

Response `201`:

```json
{
  "id": "clx..."
}
```

### PATCH /api/orders/:id/status

Cập nhật trạng thái order.

Request:

```json
{
  "status": "Preparing"
}
```

Status hợp lệ:

- `Pending`
- `Preparing`
- `Delivering`
- `Completed`
- `Cancelled`

Response:

```json
{
  "ok": true
}
```

## Error format

Request sai validation trả `400`:

```json
{
  "message": "Invalid request",
  "issues": []
}
```

Lỗi server chưa xử lý trả `500`:

```json
{
  "message": "Internal Server Error"
}
```
