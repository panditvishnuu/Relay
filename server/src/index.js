import http from 'node:http';
import { assertEnv, env } from './config/env.js';
import { connectDB, disconnectDB } from './lib/db.js';
import { createApp } from './app.js';
import { initSocket } from './socket/index.js';

const server = http.createServer(createApp());

async function start() {
  try {
    assertEnv();
  } catch (err) {
    console.error(`[config] ${err.message}`);
    process.exit(1);
  }

  try {
    await connectDB();
  } catch (err) {
    console.error('[db] initial connection failed:', err.message);
    console.error('[db] start MongoDB with `npm run db:up` (Docker) or point MONGO_URI at Atlas.');
  }

  // shares the HTTP server, so one port serves REST and websockets
  await initSocket(server);

  server.listen(env.port, () => {
    console.log(`[server] http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

async function shutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down`);
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
