import cors from 'cors';
import express from 'express';
import { ZodError } from 'zod';
import { env } from './env';
import { healthRouter } from './routes/health';
import { usersRouter } from './routes/users';
import { ingredientsRouter } from './routes/ingredients';
import { fridgeRouter } from './routes/fridge';
import { recipesRouter } from './routes/recipes';
import { ordersRouter } from './routes/orders';
import { rateLimit, securityHeaders } from './middleware/security';

export const buildApp = () => {
  const app = express();

  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(rateLimit);
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN }));
  app.use(express.json({ limit: '2mb' }));

  app.use('/health', healthRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/ingredients', ingredientsRouter);
  app.use('/api/fridge', fridgeRouter);
  app.use('/api/recipes', recipesRouter);
  app.use('/api/orders', ordersRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ message: 'Invalid request', issues: err.issues });
      return;
    }

    res.status(500).json({ message: 'Internal Server Error' });
  });

  return app;
};
