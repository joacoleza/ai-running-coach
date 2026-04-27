import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('MONGODB_CONNECTION_STRING environment variable is not set');
  }
  client = new MongoClient(connectionString);
  await client.connect();
  const dbName = connectionString.match(/\/\/[^/]+\/([^/?]+)/)?.[1] || 'running-coach';
  db = client.db(dbName);
  await db.collection('messages').createIndex({ planId: 1, timestamp: 1 });
  await db.collection('plans').createIndex({ status: 1, createdAt: -1 });
  await db.collection('runs').createIndex({ date: -1 });
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('refresh_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  // userId scoping indexes — Phase 8 data isolation
  await db.collection('plans').createIndex({ userId: 1, status: 1, createdAt: -1 });
  await db.collection('runs').createIndex({ userId: 1, date: -1 });
  await db.collection('messages').createIndex({ userId: 1, planId: 1, timestamp: 1 });
  await db.collection('login_attempts').createIndex({ ip: 1 }, { unique: true });
  await db.collection('login_attempts').createIndex({ updatedAt: 1 }, { expireAfterSeconds: 604800 }); // 7 days TTL
  await db.collection('usage_events').createIndex({ userId: 1, timestamp: -1 });
  await db.collection('usage_events').createIndex({ timestamp: -1 }); // for admin aggregation
  return db;
}

export function _resetDbForTest(): void {
  client = null;
  db = null;
}
