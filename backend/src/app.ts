import cors from 'cors';
import express from 'express';
import { ZodError } from 'zod';
import { env } from './env';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { ingredientsRouter } from './routes/ingredients';
import { fridgeRouter } from './routes/fridge';
import { recipesRouter } from './routes/recipes';
import { ordersRouter } from './routes/orders';
import { chatRouter } from './routes/chat';
import { managerRouter } from './routes/manager';
import { paymentWebhooksRouter } from './routes/paymentWebhooks';
import { rateLimit, securityHeaders } from './middleware/security';

const corsOrigin = env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

export const buildApp = () => {
  const app = express();

  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(rateLimit);
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '2mb' }));

  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/ingredients', ingredientsRouter);
  app.use('/api/fridge', fridgeRouter);
  app.use('/api/recipes', recipesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/manager', managerRouter);
  app.use('/api/payments', paymentWebhooksRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ message: 'Invalid request', issues: err.issues });
      return;
    }

    res.status(500).json({ message: 'Internal Server Error' });
  });

  return app;
};
