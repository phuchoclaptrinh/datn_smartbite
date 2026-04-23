import { buildApp } from './app';
import { connectDb, disconnectDb } from './db';
import { env } from './env';

const start = async () => {
  await connectDb();
  const app = buildApp();
  const server = app.listen(env.PORT, () => {
    process.stdout.write(`API listening on http://localhost:${env.PORT}\n`);
  });

  const shutdown = async () => {
    server.close(() => undefined);
    await disconnectDb();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
};

start().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exit(1);
});
