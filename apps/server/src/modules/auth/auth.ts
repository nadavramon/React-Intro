import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';
import { env } from '../../shared/config/env.ts';
import { publishWelcomeEmail } from '../mail/welcomeMail.publisher.ts';

const client = new MongoClient(env.MONGODB_URI);

export const auth = betterAuth({
  database: mongodbAdapter(client.db(), { client, transaction: false }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_ORIGIN],
  emailAndPassword: { enabled: true },
  session: {
    cookieCache: { enabled: true, maxAge: 300 },
  },
  databaseHooks: {
    user: {
      create: {
        after: (user) =>
          publishWelcomeEmail({ userId: user.id, email: user.email, name: user.name }),
      },
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'user', input: false },
    },
  },
});
