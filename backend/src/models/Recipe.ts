import { Schema, model } from 'mongoose';

export type RecipeIngredient = {
  name: string;
  quantity?: number;
  unit?: 'g' | 'ml' | 'pcs';
  optional?: boolean;
};

export type RecipeDocument = {
  name: string;
  description: string;
  tags: string[];
  timeMin: number;
  servings: number;
  imageUrl?: string;
  ingredients: RecipeIngredient[];
  steps: string[];
  createdAt: Date;
  updatedAt: Date;
};

const RecipeIngredientSchema = new Schema<RecipeIngredient>(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: false },
    unit: { type: String, required: false, enum: ['g', 'ml', 'pcs'] },
    optional: { type: Boolean, required: false, default: false },
  },
  { _id: false }
);

const RecipeSchema = new Schema<RecipeDocument>(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    tags: { type: [String], required: true, default: [] },
    timeMin: { type: Number, required: true, min: 1 },
    servings: { type: Number, required: true, min: 1 },
    imageUrl: { type: String, required: false },
    ingredients: { type: [RecipeIngredientSchema], required: true, default: [] },
    steps: { type: [String], required: true, default: [] },
  },
  { timestamps: true }
);

export const RecipeModel = model<RecipeDocument>('Recipe', RecipeSchema);
