import { Schema, model } from 'mongoose';

export type UserPreferences = {
  tasteProfile: string[];
  allergies: string[];
};

export type UserProfile = {
  fullName: string;
  email: string;
  phone?: string;
};

export type UserDocument = {
  profile: UserProfile;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
};

const UserSchema = new Schema<UserDocument>(
  {
    profile: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true, index: true, unique: true },
      phone: { type: String, required: false, trim: true },
    },
    preferences: {
      tasteProfile: { type: [String], required: true, default: [] },
      allergies: { type: [String], required: true, default: [] },
    },
  },
  { timestamps: true }
);

export const UserModel = model<UserDocument>('User', UserSchema);
