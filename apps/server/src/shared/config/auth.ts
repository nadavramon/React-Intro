import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';
import { env } from './env.ts';

// Dedicated client: the adapter needs a Db handle at module init,
// before mongoose's connectDB() has run.
const client = new MongoClient(env.MONGODB_URI);

export const auth = betterAuth({
  // transaction:false — local dev Mongo is a standalone (no replica set), and the
  // adapter's transactions require one ("Transaction numbers are only allowed on
  // a replica set member or mongos"). Flip to true if we ever run against Atlas.
  database: mongodbAdapter(client.db(), { client, transaction: false }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: ['http://localhost:5173'],
  emailAndPassword: { enabled: true },
  session: {
    cookieCache: { enabled: true, maxAge: 300 }, // 5 min signed-cookie cache — skips the per-request Mongo read
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  // Keep the @repo/shared User contract's `role`; input:false = clients can't set it.
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'user', input: false },
    },
  },
});
