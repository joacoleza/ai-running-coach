import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

async function getDb(): Promise<Db> {
  if (db) return db;

  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('MONGODB_CONNECTION_STRING environment variable is not set');
  }

  client = new MongoClient(connectionString);
  await client.connect();
  db = client.db('running-coach');
  return db;
}

export async function checkBlocked(): Promise<boolean> {
  const database = await getDb();
  const auth = database.collection('auth');
  const doc = await auth.findOne({ _id: 'lockout' as unknown as import('mongodb').ObjectId });
  if (!doc) return false;
  return doc['blocked'] === true;
}

export async function requirePassword(req: HttpRequest): Promise<HttpResponseInit | null> {
  // Step 1: Check if site is globally locked out
  const blocked = await checkBlocked();
  if (blocked) {
    return {
      status: 503,
      jsonBody: { error: 'Service temporarily unavailable' },
    };
  }

  // Step 2: Check the password header
  const providedPassword = req.headers.get('x-app-password');

  if (!providedPassword || providedPassword !== process.env.APP_PASSWORD) {
    // Step 3: Wrong or missing password — increment failure count
    const database = await getDb();
    const auth = database.collection('auth');

    const result = await auth.findOneAndUpdate(
      { _id: 'lockout' as unknown as import('mongodb').ObjectId },
      { $inc: { failureCount: 1 } },
      { upsert: true, returnDocument: 'after' },
    );

    // If failure count reaches threshold, set blocked
    const failureCount: number = (result as { failureCount?: number } | null)?.failureCount ?? 1;
    if (failureCount >= 30) {
      await auth.updateOne(
        { _id: 'lockout' as unknown as import('mongodb').ObjectId },
        { $set: { blocked: true } },
      );
    }

    return {
      status: 401,
      jsonBody: { error: 'Unauthorized' },
    };
  }

  // Step 4: Correct password — reset lockout state
  const database = await getDb();
  const auth = database.collection('auth');
  await auth.updateOne(
    { _id: 'lockout' as unknown as import('mongodb').ObjectId },
    { $set: { failureCount: 0, blocked: false } },
    { upsert: true },
  );

  return null;
}
