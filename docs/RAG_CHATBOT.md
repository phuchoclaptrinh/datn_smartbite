# Thiết kế AI Chatbot theo kiến trúc RAG

## Mục tiêu

Chatbot SmartBite hỗ trợ khách hàng:

- Tư vấn món ăn theo nhu cầu như ít tinh bột, giàu đạm, món cay, món dễ ăn.
- Gợi ý món dựa trên thực đơn hiện có.
- Kết hợp thêm ngữ cảnh cá nhân như tủ lạnh, công thức và đơn gần đây nếu có `userId`.
- Trả action để frontend có thể thêm món vào giỏ hàng.

## Kiến trúc

```text
ChatbotScreen
   |
   | POST /api/chat
   v
Backend Chat Route
   |
   | Retrieve context
   | - Menu dishes
   | - Fridge items by userId
   | - Recipes
   | - Recent orders
   v
Prompt Builder
   |
   | Gemini API
   v
Structured JSON Response
   |
   v
Frontend render message + suggested dishes + actions
```

## RAG pipeline

### 1. Retrieve

Backend lấy ngữ cảnh từ các nguồn:

- `menuDishes`: danh sách món ăn của quán.
- `FridgeItem`: nguyên liệu trong tủ lạnh cá nhân.
- `Recipe`: công thức nấu ăn.
- `Order`: đơn hàng gần đây của người dùng.

Hiện tại retrieval của menu dùng lexical scoring theo từ khóa tiếng Việt không dấu. Đây là RAG nhẹ, chưa dùng vector database.

### 2. Augment

Backend gom context thành prompt:

- Menu phù hợp nhất với câu hỏi.
- Tủ lạnh của user.
- Công thức liên quan.
- Đơn gần đây.
- Lịch sử chat ngắn.

### 3. Generate

Backend gọi Gemini:

```text
POST https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent
```

Output được ép là JSON:

```json
{
  "message": "Mình gợi ý Cơm cá hồi áp chảo vì ít tinh bột và giàu đạm.",
  "suggestedDishIds": ["d2"],
  "actions": [
    {
      "type": "ADD_TO_CART",
      "dishId": "d2",
      "quantity": 1
    }
  ],
  "sources": ["menu", "fridge"]
}
```

## Fallback

Nếu backend chưa có `GEMINI_API_KEY` hoặc Gemini lỗi:

- Backend trả lời bằng local RAG rule-based.
- Frontend vẫn hoạt động.
- Chatbot vẫn gợi ý món và thêm món vào giỏ.

## Biến môi trường

Backend cần:

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

Không nên đặt Gemini key trong frontend production.

## Endpoint

```http
POST /api/chat
Content-Type: application/json
```

Request:

```json
{
  "userId": "user_id",
  "message": "Tôi muốn món giàu đạm",
  "history": [
    {
      "role": "user",
      "text": "Tôi muốn ăn nhẹ"
    }
  ]
}
```

Response:

```json
{
  "message": "Mình gợi ý Bò áp chảo rau củ vì giàu đạm và ít tinh bột.",
  "suggestedDishIds": ["d3"],
  "actions": [],
  "sources": ["menu"],
  "mode": "gemini-rag"
}
```
