import { Schema, model } from 'mongoose';

export type IngredientDocument = {
  name: string;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
};

const IngredientSchema = new Schema<IngredientDocument>(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    aliases: { type: [String], required: true, default: [] },
  },
  { timestamps: true }
);

export const IngredientModel = model<IngredientDocument>('Ingredient', IngredientSchema);
