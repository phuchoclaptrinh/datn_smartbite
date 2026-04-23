import mongoose from 'mongoose';
import { env } from './env';

export const connectDb = async () => {
  mongoose.connection.on('connected', () => {
    process.stdout.write('MongoDB connected\n');
  });
  mongoose.connection.on('error', (err) => {
    process.stderr.write(`MongoDB error: ${err instanceof Error ? err.message : String(err)}\n`);
  });

  const maxAttempts = 10;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      return;
    } catch (e) {
      if (attempt === maxAttempts) throw e;
      process.stderr.write(
        `MongoDB connect failed (attempt ${attempt}/${maxAttempts}): ${e instanceof Error ? e.message : String(e)}\n`
      );
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), delayMs);
      });
    }
  }
};

export const disconnectDb = async () => {
  await mongoose.disconnect();
};
