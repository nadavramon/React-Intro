import { MongoClient } from 'mongodb';
import { env } from '../shared/config/env.ts';
import { logger } from '../shared/utils/logger.ts';

async function seed() {
  const client = new MongoClient(env.MONGODB_URI);
  try {
    await client.connect();
    logger.info('Connected to MongoDB');
    const db = client.db('blogs');

    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      await db.dropCollection(col.name);
    }
    logger.info('Dropped existing collections');

    const users = [
      {
        user_id: 1,
        username: 'alice_dev',
        email: 'alice@example.com',
        password_hash: 'hashed_pw_alice',
        created_at: new Date(),
      },
      {
        user_id: 2,
        username: 'bob_writes',
        email: 'bob@example.com',
        password_hash: 'hashed_pw_bob',
        created_at: new Date(),
      },
      {
        user_id: 3,
        username: 'charlie_tech',
        email: 'charlie@example.com',
        password_hash: 'hashed_pw_charlie',
        created_at: new Date(),
      },
    ];

    const posts = [
      {
        post_id: 1,
        user_id: 1,
        title: 'Getting Started with TypeScript',
        content:
          'TypeScript adds static typing to JavaScript, making it easier to catch bugs early and improve code quality in large projects.',
        likes_count: 12,
        created_at: new Date(),
      },
      {
        post_id: 2,
        user_id: 1,
        title: 'Why I Love Node.js',
        content:
          'Node.js enables full-stack JavaScript development with its non-blocking I/O model, making it perfect for building scalable server applications.',
        likes_count: 8,
        created_at: new Date(),
      },
      {
        post_id: 3,
        user_id: 2,
        title: 'Docker for Beginners',
        content:
          'Docker containers package your application and its dependencies together, ensuring consistent behavior across development and production environments.',
        likes_count: 23,
        created_at: new Date(),
      },
      {
        post_id: 4,
        user_id: 2,
        title: 'CI/CD Best Practices',
        content:
          'A solid CI/CD pipeline automates testing and deployment, reducing human error and accelerating the release cycle.',
        likes_count: 5,
        created_at: new Date(),
      },
      {
        post_id: 5,
        user_id: 3,
        title: 'MongoDB vs PostgreSQL',
        content:
          'Choosing between MongoDB and PostgreSQL depends on your data structure needs — document flexibility versus relational integrity.',
        likes_count: 17,
        created_at: new Date(),
      },
    ];

    const comments = [
      {
        comment_id: 1,
        post_id: 1,
        user_id: 2,
        content: 'Great intro to TS!',
        created_at: new Date(),
      },
      {
        comment_id: 2,
        post_id: 1,
        user_id: 3,
        content: 'Very helpful, thanks!',
        created_at: new Date(),
      },
      {
        comment_id: 3,
        post_id: 3,
        user_id: 1,
        content: 'Docker changed my workflow',
        created_at: new Date(),
      },
      {
        comment_id: 4,
        post_id: 3,
        user_id: 3,
        content: 'Nice breakdown of containers',
        created_at: new Date(),
      },
      {
        comment_id: 5,
        post_id: 5,
        user_id: 1,
        content: 'Good comparison of both DBs',
        created_at: new Date(),
      },
      {
        comment_id: 6,
        post_id: 2,
        user_id: 3,
        content: 'Node.js is amazing indeed',
        created_at: new Date(),
      },
    ];

    await db.collection('users').insertMany(users);
    await db.collection('posts').insertMany(posts);
    await db.collection('comments').insertMany(comments);

    logger.info('Seed complete: 3 users, 5 posts, 6 comments');
  } catch (error) {
    logger.error(`Seed failed: ${error}`);
    process.exit(1);
  } finally {
    await client.close();
    logger.info('Disconnected from MongoDB');
  }
}

seed();
