import { Schema, model, Types } from 'mongoose';

export type OrderStatus = 'Pending' | 'Preparing' | 'Delivering' | 'Completed' | 'Cancelled';

export type Money = {
  amount: number;
  currency: 'VND';
};

export type OrderItem = {
  dishId: string;
  name: string;
  quantity: number;
  price: Money;
};

export type OrderDocument = {
  userId: Types.ObjectId;
  items: OrderItem[];
  subtotal: Money;
  deliveryFee: Money;
  total: Money;
  status: OrderStatus;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
};

const MoneySchema = new Schema<Money>(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: ['VND'], default: 'VND' },
  },
  { _id: false }
);

const OrderItemSchema = new Schema<OrderItem>(
  {
    dishId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: MoneySchema, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<OrderDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [OrderItemSchema], required: true, default: [] },
    subtotal: { type: MoneySchema, required: true },
    deliveryFee: { type: MoneySchema, required: true },
    total: { type: MoneySchema, required: true },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Preparing', 'Delivering', 'Completed', 'Cancelled'],
      default: 'Pending',
    },
    note: { type: String, required: false, trim: true },
  },
  { timestamps: true }
);

export const OrderModel = model<OrderDocument>('Order', OrderSchema);
