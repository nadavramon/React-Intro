import mongoose from 'mongoose';
import { env } from './env.ts';
import { logger } from '../utils/logger.ts';

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  logger.info('Connected to MongoDB');
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');
}
