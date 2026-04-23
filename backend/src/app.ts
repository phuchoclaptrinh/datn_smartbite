import cors from 'cors';
import express from 'express';
import { env } from './env';
import { healthRouter } from './routes/health';
import { usersRouter } from './routes/users';
import { ingredientsRouter } from './routes/ingredients';
import { fridgeRouter } from './routes/fridge';
import { recipesRouter } from './routes/recipes';
import { ordersRouter } from './routes/orders';

export const buildApp = () => {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN }));
  app.use(express.json({ limit: '2mb' }));

  app.use('/health', healthRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/ingredients', ingredientsRouter);
  app.use('/api/fridge', fridgeRouter);
  app.use('/api/recipes', recipesRouter);
  app.use('/api/orders', ordersRouter);

  return app;
};
