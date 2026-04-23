import { Router } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User';

export const usersRouter = Router();

usersRouter.post(
  '/',
  async (req, res) => {
    const body = z
      .object({
        fullName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(6).optional(),
      })
      .parse(req.body);

    const doc = await UserModel.create({
      profile: {
        fullName: body.fullName,
        email: body.email,
        phone: body.phone,
      },
      preferences: {
        tasteProfile: [],
        allergies: [],
      },
    });

    res.status(201).json({ id: doc._id.toString() });
  }
);

usersRouter.get('/', async (_req, res) => {
  const users = await UserModel.find().sort({ createdAt: -1 }).limit(50).lean();
  res.json(
    users.map((u) => ({
      id: u._id.toString(),
      profile: u.profile,
      preferences: u.preferences,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }))
  );
});
