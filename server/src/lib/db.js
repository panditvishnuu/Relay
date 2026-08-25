import mongoose from 'mongoose';
import { env } from '../config/env.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  mongoose.connection.on('connected', () => console.log('[db] connected'));
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('error', (err) => console.error('[db] error:', err.message));

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.connection.close();
}
