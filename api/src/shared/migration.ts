import { ObjectId } from 'mongodb';
import { getDb } from './db.js';

/**
 * Startup migration: backfill orphaned documents (no userId) to the seed admin user.
 * Runs on every cold start. Idempotent — no-op after first successful migration.
 *
 * Per D-01/D-02: Check for orphaned docs → find admin user → updateMany all 3 collections.
 * Per D-04: If no admin user exists, log warning and skip (no crash).
 * Conflict guard: if admin already has an active plan, orphaned active plans are archived
 * instead of assigned as active — prevents non-deterministic getPlan results.
 */
export async function runStartupMigration(): Promise<void> {
  const db = await getDb();

  // Check for orphaned documents across all collections
  const [orphanedPlans, orphanedRuns, orphanedMessages] = await Promise.all([
    db.collection('plans').countDocuments({ userId: { $exists: false } }),
    db.collection('runs').countDocuments({ userId: { $exists: false } }),
    db.collection('messages').countDocuments({ userId: { $exists: false } }),
  ]);

  const totalOrphans = orphanedPlans + orphanedRuns + orphanedMessages;

  if (totalOrphans === 0) {
    console.log('[migration] No orphaned documents found — skipping backfill.');
    return;
  }

  console.log(
    `[migration] Found ${totalOrphans} orphaned documents ` +
      `(plans:${orphanedPlans}, runs:${orphanedRuns}, messages:${orphanedMessages}). ` +
      'Looking for admin user...'
  );

  // Find the seed admin user
  const adminUser = await db.collection('users').findOne({ isAdmin: true });

  if (!adminUser) {
    console.warn(
      '[migration] WARNING: No admin user found (isAdmin: true). ' +
        'Cannot backfill orphaned documents. ' +
        'Create an admin user and restart the API to complete migration.'
    );
    return;
  }

  const adminId = adminUser._id as ObjectId;
  const filter = { userId: { $exists: false } };

  // Check if admin already has an active plan — if so, orphaned active plans must be
  // archived to avoid multiple active plans for the same user (non-deterministic getPlan).
  const adminHasActivePlan = !!(await db
    .collection('plans')
    .findOne({ userId: adminId, status: 'active' }));

  if (adminHasActivePlan) {
    const conflictResult = await db
      .collection('plans')
      .updateMany(
        { userId: { $exists: false }, status: 'active' },
        { $set: { userId: adminId, status: 'archived' } }
      );
    if (conflictResult.modifiedCount > 0) {
      console.log(
        `[migration] Conflict guard: archived ${conflictResult.modifiedCount} orphaned active plan(s) ` +
          '— admin already has an active plan.'
      );
    }
  }

  // Assign all remaining orphaned documents (non-active plans, runs, messages) to admin
  const [plansResult, runsResult, messagesResult] = await Promise.all([
    db.collection('plans').updateMany(filter, { $set: { userId: adminId } }),
    db.collection('runs').updateMany(filter, { $set: { userId: adminId } }),
    db.collection('messages').updateMany(filter, { $set: { userId: adminId } }),
  ]);

  console.log(
    `[migration] Backfill complete. Updated: ` +
      `plans=${plansResult.modifiedCount}, ` +
      `runs=${runsResult.modifiedCount}, ` +
      `messages=${messagesResult.modifiedCount}`
  );
}
