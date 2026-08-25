import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));

// server/src/config -> server/.env
dotenv.config({ path: path.resolve(here, '../../.env') });

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  extraOrigins: process.env.EXTRA_ORIGINS ?? '',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/relay',

  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  refreshCookieName: 'relay_rt',

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024),
};

/** Comma-separated EXTRA_ORIGINS lets staging and prod share one deployment. */
export const allowedOrigins = [env.clientOrigin, ...env.extraOrigins.split(',')]
  .map((o) => o.trim())
  .filter(Boolean);

export const isDev = env.nodeEnv === 'development';
export const isProd = env.nodeEnv === 'production';

/** Fail loudly at boot rather than at the first login attempt. */
export function assertEnv() {
  const missing = ['accessTokenSecret', 'refreshTokenSecret'].filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `Missing env vars: ${missing.join(', ')}. Generate them with: openssl rand -hex 32`
    );
  }
}
