import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

async function getDb(): Promise<Db | null> {
  if (db) return db;

  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) return null;

  try {
    client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    db = client.db('running-coach');
    return db;
  } catch {
    client = null;
    return null;
  }
}

export async function checkBlocked(): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;
  const doc = await database.collection('auth').findOne({ _id: 'lockout' as unknown as import('mongodb').ObjectId });
  if (!doc) return false;
  return doc['blocked'] === true;
}

export async function requirePassword(req: HttpRequest): Promise<HttpResponseInit | null> {
  const blocked = await checkBlocked();
  if (blocked) {
    return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
  }

  const providedPassword = req.headers.get('x-app-password');

  if (!providedPassword || providedPassword !== process.env.APP_PASSWORD) {
    const database = await getDb();
    if (database) {
      const result = await database.collection('auth').findOneAndUpdate(
        { _id: 'lockout' as unknown as import('mongodb').ObjectId },
        { $inc: { failureCount: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
      const failureCount: number = (result as { failureCount?: number } | null)?.failureCount ?? 1;
      if (failureCount >= 30) {
        await database.collection('auth').updateOne(
          { _id: 'lockout' as unknown as import('mongodb').ObjectId },
          { $set: { blocked: true } },
        );
      }
    }
    return { status: 401, jsonBody: { error: 'Unauthorized' } };
  }

  const database = await getDb();
  if (database) {
    await database.collection('auth').updateOne(
      { _id: 'lockout' as unknown as import('mongodb').ObjectId },
      { $set: { failureCount: 0, blocked: false } },
      { upsert: true },
    );
  }

  return null;
}
