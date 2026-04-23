import { buildApp } from './app';
import { connectDb } from './db';
import { env } from './env';

const start = async () => {
  await connectDb();
  const app = buildApp();
  app.listen(env.PORT, () => {
    process.stdout.write(`API listening on http://localhost:${env.PORT}\n`);
  });
};

start().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exit(1);
});
