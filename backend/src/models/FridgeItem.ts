import { Schema, model, Types } from 'mongoose';

export type FridgeUnit = 'g' | 'ml' | 'pcs';

export type FridgeItemDocument = {
  userId: Types.ObjectId;
  name: string;
  quantity: number;
  unit: FridgeUnit;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const FridgeItemSchema = new Schema<FridgeItemDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, enum: ['g', 'ml', 'pcs'] },
    expiryDate: { type: Date, required: false },
  },
  { timestamps: true }
);

FridgeItemSchema.index({ userId: 1, name: 1 });

export const FridgeItemModel = model<FridgeItemDocument>('FridgeItem', FridgeItemSchema);
