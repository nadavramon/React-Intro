import { MongoClient } from 'mongodb';
import { env } from './env.ts';
import { logger } from '../utils/logger.ts';

let client: MongoClient | null = null;

export async function connectDB(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(env.MONGODB_URI);
    await client.connect();
    logger.info('Connected to MongoDB');
  }
  return client;
}

export function getDB(dbName: string) {
  if (!client) throw new Error('MongoDB client not connected. Call connectDB() first.');

  return client.db(dbName);
}

export async function disconnectDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    logger.info('Disconnected from MongoDB');
  }
}
