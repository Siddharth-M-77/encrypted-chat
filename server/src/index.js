import http from 'node:http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDb } from './config/db.js';
import { redis } from './config/redis.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';

async function main() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  initSockets(server);

  server.listen(env.PORT, () => logger.info(`M Talk API listening on :${env.PORT} (${env.NODE_ENV})`));

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await mongoose.disconnect();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Last-resort handlers: log, then exit so PM2 restarts a clean process instead of serving in a broken state.
process.on('unhandledRejection', (err) => { logger.fatal({ err }, 'Unhandled rejection'); process.exit(1); });
process.on('uncaughtException', (err) => { logger.fatal({ err }, 'Uncaught exception'); process.exit(1); });

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
