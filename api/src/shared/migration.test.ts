import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runStartupMigration } from './migration.js';
import * as dbModule from './db.js';

vi.mock('./db.js');

function makeMockDb(overrides: {
  orphanedPlans?: number;
  orphanedRuns?: number;
  orphanedMessages?: number;
  adminUser?: object | null;
} = {}) {
  const counts = {
    plans: overrides.orphanedPlans ?? 0,
    runs: overrides.orphanedRuns ?? 0,
    messages: overrides.orphanedMessages ?? 0,
  };

  const collections: Record<string, any> = {
    plans: {
      countDocuments: vi.fn().mockResolvedValue(counts.plans),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: counts.plans }),
    },
    runs: {
      countDocuments: vi.fn().mockResolvedValue(counts.runs),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: counts.runs }),
    },
    messages: {
      countDocuments: vi.fn().mockResolvedValue(counts.messages),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: counts.messages }),
    },
    users: {
      findOne: vi.fn().mockResolvedValue(
        overrides.adminUser !== undefined
          ? overrides.adminUser
          : { _id: 'admin-id', isAdmin: true }
      ),
    },
  };

  vi.mocked(dbModule.getDb).mockResolvedValue({
    collection: (name: string) => collections[name],
  } as any);

  return collections;
}

describe('runStartupMigration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op when no orphaned documents exist', async () => {
    const cols = makeMockDb({ orphanedPlans: 0, orphanedRuns: 0, orphanedMessages: 0 });
    await runStartupMigration();
    expect(cols.plans.updateMany).not.toHaveBeenCalled();
    expect(cols.runs.updateMany).not.toHaveBeenCalled();
    expect(cols.messages.updateMany).not.toHaveBeenCalled();
  });

  it('backfills all collections when orphaned documents exist and admin user found', async () => {
    const adminId = 'admin-object-id';
    const cols = makeMockDb({
      orphanedPlans: 3,
      orphanedRuns: 5,
      orphanedMessages: 10,
      adminUser: { _id: adminId, isAdmin: true },
    });
    await runStartupMigration();
    expect(cols.plans.updateMany).toHaveBeenCalledWith(
      { userId: { $exists: false } },
      { $set: { userId: adminId } }
    );
    expect(cols.runs.updateMany).toHaveBeenCalledWith(
      { userId: { $exists: false } },
      { $set: { userId: adminId } }
    );
    expect(cols.messages.updateMany).toHaveBeenCalledWith(
      { userId: { $exists: false } },
      { $set: { userId: adminId } }
    );
  });

  it('skips backfill without crashing when no admin user exists', async () => {
    const cols = makeMockDb({ orphanedPlans: 2, orphanedRuns: 1, orphanedMessages: 0, adminUser: null });
    await expect(runStartupMigration()).resolves.not.toThrow();
    expect(cols.plans.updateMany).not.toHaveBeenCalled();
  });

  it('is idempotent — second call with no orphans is a no-op', async () => {
    const cols = makeMockDb({ orphanedPlans: 0, orphanedRuns: 0, orphanedMessages: 0 });
    await runStartupMigration();
    await runStartupMigration();
    expect(cols.plans.updateMany).not.toHaveBeenCalled();
  });
});
