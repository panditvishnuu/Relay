import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { allowedOrigins, env, isDev, isProd } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { authRoutes } from './routes/auth.routes.js';
import { apiRoutes } from './routes/index.js';
import { UPLOAD_DIR, usingCloudinary } from './lib/storage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(here, '../../client/dist');

export function createApp() {
  const app = express();

  // rate limiters and secure cookies both need the real client IP/proto when
  // running behind a proxy (Render, Railway, Fly, nginx)
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // uploads are served cross-origin to the client dev server
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // the app is a same-origin SPA; a strict CSP here would need a nonce
      // pipeline for Vite's inline bootstrap, so it's left off deliberately
      contentSecurityPolicy: false,
    })
  );
  app.use(compression());

  app.use(
    cors({
      /**
       * Allowlist rather than a single origin, so staging and production can
       * share a deployment. A request with no Origin (curl, health checks,
       * same-origin fetches) is allowed through.
       */
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} is not allowed`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (isDev) app.use(morgan('dev'));

  app.get('/api/health', (req, res) => {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
      ok: true,
      service: 'relay-server',
      env: env.nodeEnv,
      db: states[mongoose.connection.readyState] ?? 'unknown',
      storage: usingCloudinary ? 'cloudinary' : 'local',
      uptime: Math.round(process.uptime()),
    });
  });

  // local-disk fallback provider serves files from here; Cloudinary serves its own
  if (!usingCloudinary) {
    app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));
  }

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api', apiRoutes); // users + conversations, all behind requireAuth

  /**
   * In production the built client is served from this same process, so one
   * deployment covers both and there's no cross-origin cookie problem at all.
   */
  if (isProd) {
    app.use(express.static(CLIENT_DIST, { maxAge: '1y', index: false }));
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
