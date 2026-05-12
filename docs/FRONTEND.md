# Frontend

## Công nghệ

Frontend dùng:

- Expo SDK 54.
- React 19.
- React Native 0.81.
- React Navigation.
- Zustand để quản lý state.
- Expo Image Picker để chụp/chọn ảnh hóa đơn.
- Expo File System để đọc ảnh base64 phục vụ OCR.
- Ionicons từ `@expo/vector-icons`.

## Cấu trúc thư mục

```text
frontend/
  App.tsx
  index.ts
  app.json
  eas.json
  src/
    components/
    data/
    navigation/
    screens/
    services/
    store/
    theme/
    types/
    utils/
```

## Entry point

`App.tsx`:

- Bọc app trong `SafeAreaProvider`.
- Bọc navigation trong `NavigationContainer`.
- Render `RootNavigator`.
- Render `StatusBar`.

`index.ts` là entry Expo.

## Navigation

### RootNavigator

File: `src/navigation/RootNavigator.tsx`.

Vai trò:

- Nếu `user` trong `useAppStore` tồn tại, render `Main`.
- Nếu chưa có `user`, render `Auth`.
- Khai báo thêm màn hình `DishDetail` và `Cart`.
- Render global `CartAddedPopup` và `CartFloatingButton`.

Stack params:

- `Main`
- `Auth`
- `DishDetail: { dishId: string }`
- `Cart`

### AuthNavigator

File: `src/navigation/AuthNavigator.tsx`.

Vai trò:

- Điều hướng giữa login và register.

### TabNavigator

File: `src/navigation/TabNavigator.tsx`.

Các tab:

- `Home`
- `CookSuggestion`
- `Fridge`
- `Orders`
- `Profile`

Tab bar dùng blur background và Ionicons.

## State management

Frontend dùng Zustand trong `src/store/`.

### useAppStore

File: `src/store/useAppStore.ts`.

State:

- `user`

Actions:

- `setUser`
- `updateUserProfile`
- `logout`

Hiện auth chỉ là local state, chưa gọi backend.

### useCartStore

File: `src/store/useCartStore.ts`.

State:

- `items`

Actions:

- `addDish`
- `removeDish`
- `setQuantity`
- `clear`
- `subtotal`
- `count`

Khi thêm món, store cũng gọi `useUIStore.getState().openCartPopup(dish)` để hiện popup.

### useOrderStore

File: `src/store/useOrderStore.ts`.

State:

- `orders`

Actions:

- `createOrder`
- `updateStatus`
- `clear`

Hiện đơn hàng được tạo local từ giỏ hàng, chưa gọi `POST /api/orders`.

### useFridgeStore

File: `src/store/useFridgeStore.ts`.

State:

- `items`

Actions:

- `addItem`
- `updateItem`
- `removeItem`
- `setQuantity`
- `clearExpired`

Hiện dữ liệu tủ lạnh chỉ nằm trong memory của app. Khi reload app, dữ liệu mất nếu chưa có persistence.

### useUIStore

File: `src/store/useUIStore.ts`.

Quản lý UI state như popup sau khi thêm món vào giỏ.

## Mock data

### mockFood

File: `src/data/mockFood.ts`.

Chứa:

- `store`: thông tin cửa hàng, phí giao hàng, ETA.
- `dishes`: danh sách món ăn để đặt.
- `getDishById`: helper tìm món theo id.

Mỗi `Dish` có:

- `id`
- `name`
- `description`
- `price`
- `tags`
- `portion`
- `nutritionPerPortion`
- `imageUrl`

### mockRecipes

File: `src/data/mockRecipes.ts`.

Chứa danh sách công thức nấu ăn để màn hình gợi ý sử dụng.

Mỗi `Recipe` có:

- `id`
- `name`
- `description`
- `tags`
- `timeMin`
- `servings`
- `imageUrl`
- `ingredients`
- `steps`

## Các màn hình

### LoginScreen

File: `src/screens/LoginScreen/LoginScreen.tsx`.

Chức năng hiện tại:

- Nhập email/password.
- Nếu có cả hai giá trị, tạo user local trong Zustand.
- Không gọi API login thật.
- Không validate password với backend.

### RegisterScreen

File: `src/screens/RegisterScreen/RegisterScreen.tsx`.

Chức năng hiện tại:

- Nhập name/email/password/confirm password.
- Nếu hợp lệ, tạo user local trong Zustand.
- Không gọi `POST /api/users`.

### HomeScreen

File: `src/screens/HomeScreen/HomeScreen.tsx`.

Chức năng:

- Hiển thị danh sách món từ `mockFood`.
- Tìm kiếm theo tên món hoặc tags.
- Hiển thị nhóm gợi ý.
- Mở chi tiết món.
- Thêm món vào giỏ.

### DishDetailScreen

File: `src/screens/DishDetailScreen/DishDetailScreen.tsx`.

Chức năng:

- Lấy `dishId` từ navigation params.
- Tìm món trong mock data.
- Hiển thị chi tiết món, giá, dinh dưỡng.
- Cho phép thêm vào giỏ.

### CartScreen

File: `src/screens/CartScreen/CartScreen.tsx`.

Chức năng:

- Hiển thị các món trong giỏ.
- Tăng/giảm số lượng.
- Xóa món.
- Tính subtotal, phí giao hàng, total.
- Tính tổng dinh dưỡng bằng `src/utils/nutrition.ts`.
- Khi checkout, tạo order local trong `useOrderStore`, clear giỏ và chuyển sang Orders.

### OrderScreen

File: `src/screens/OrderScreen/OrderScreen.tsx`.

Chức năng:

- Hiển thị danh sách order local.
- Hiển thị mã đơn, trạng thái, số lượng item, thời gian và total.

### FridgeScreen

File: `src/screens/FridgeScreen/FridgeScreen.tsx`.

Chức năng:

- Hiển thị nguyên liệu trong tủ lạnh.
- Tìm kiếm nguyên liệu.
- Thêm/sửa/xóa nguyên liệu.
- Tăng/giảm quantity.
- Theo dõi hạn sử dụng.
- Xóa các item đã hết hạn.
- Scan hoặc nhập text hóa đơn để parse item.

Quy tắc hạn sử dụng:

- Không có `expiryDate`: hiển thị không hạn.
- Ngày quá khứ: hết hạn.
- Hôm nay: hết hạn hôm nay.
- Trong 3 ngày: sắp hết hạn.
- Sau 3 ngày: còn hạn.

### CookSuggestionScreen

File: `src/screens/CookSuggestionScreen/CookSuggestionScreen.tsx`.

Chức năng:

- Lấy nguyên liệu từ `useFridgeStore`.
- Lấy công thức từ `mockRecipes`.
- Tính phần trăm match bằng `src/utils/recipeMatch.ts`.
- Sort recipe theo mức độ phù hợp.
- Hiển thị thiếu bao nhiêu nguyên liệu.
- Mở modal chi tiết recipe.

### ProfileScreen

File: `src/screens/ProfileScreen/ProfileScreen.tsx`.

Chức năng:

- Hiển thị thông tin user local.
- Sửa full name, phone, address.
- Hiển thị taste profile và allergies.
- Logout bằng cách clear user local.

## OCR hóa đơn

File: `src/services/receiptOcr.ts`.

Luồng:

1. Người dùng chụp/chọn ảnh trong `FridgeScreen`.
2. Ảnh được đọc base64 bằng Expo File System.
3. Gọi Gemini API:
   `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
4. Prompt yêu cầu trả về mỗi món một dòng.
5. Text trả về được parse thành item tủ lạnh.

Biến môi trường cần có:

```env
EXPO_PUBLIC_GEMINI_API_KEY=...
```

Lưu ý bảo mật: key public trong Expo client có thể bị lộ. Với production, nên proxy OCR qua backend.

## Types

Thư mục `src/types/` định nghĩa type chính:

- `food.ts`: Money, Portion, Nutrition, Dish, Store.
- `recipe.ts`: RecipeIngredient, Recipe.
- `fridge.ts`: FridgeUnit, FridgeItem.
- `order.ts`: CartItem, OrderStatus, Order.
- `user.ts`: DietaryTag, UserProfile, UserPreferences, AppUser.

## Utils

### nutrition

File: `src/utils/nutrition.ts`.

Vai trò:

- Tính tổng dinh dưỡng theo số lượng món.
- Tính tổng giỏ hàng.

### recipeMatch

File: `src/utils/recipeMatch.ts`.

Vai trò:

- Chuẩn hóa tên nguyên liệu: lowercase, bỏ dấu, bỏ ký tự đặc biệt.
- So khớp nguyên liệu recipe với fridge item.
- Tính percent match dựa trên nguyên liệu bắt buộc.
- Trả danh sách matched và missing.

