import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runStartupMigration } from './migration.js';
import * as dbModule from './db.js';

vi.mock('./db.js');

function makeMockDb(overrides: {
  orphanedPlans?: number;
  orphanedRuns?: number;
  orphanedMessages?: number;
  adminUser?: object | null;
  adminHasActivePlan?: boolean;
} = {}) {
  const counts = {
    plans: overrides.orphanedPlans ?? 0,
    runs: overrides.orphanedRuns ?? 0,
    messages: overrides.orphanedMessages ?? 0,
  };

  const adminId = (overrides.adminUser as any)?._id ?? 'admin-id';

  const collections: Record<string, any> = {
    plans: {
      countDocuments: vi.fn().mockResolvedValue(counts.plans),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: counts.plans }),
      findOne: vi.fn().mockImplementation((filter: any) => {
        // Conflict guard check: findOne({ userId: adminId, status: 'active' })
        if (filter.userId && filter.status === 'active') {
          return Promise.resolve(overrides.adminHasActivePlan ? { _id: 'existing-plan' } : null);
        }
        return Promise.resolve(null);
      }),
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
          : { _id: adminId, isAdmin: true }
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
      adminHasActivePlan: false,
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

  it('archives orphaned active plans when admin already has an active plan', async () => {
    const adminId = 'admin-object-id';
    const cols = makeMockDb({
      orphanedPlans: 2,
      orphanedRuns: 1,
      orphanedMessages: 0,
      adminUser: { _id: adminId, isAdmin: true },
      adminHasActivePlan: true,
    });
    cols.plans.updateMany.mockResolvedValue({ modifiedCount: 1 });

    await runStartupMigration();

    // Conflict guard: orphaned active plans must be archived first
    expect(cols.plans.updateMany).toHaveBeenCalledWith(
      { userId: { $exists: false }, status: 'active' },
      { $set: { userId: adminId, status: 'archived' } }
    );
    // Remaining orphans assigned normally
    expect(cols.plans.updateMany).toHaveBeenCalledWith(
      { userId: { $exists: false } },
      { $set: { userId: adminId } }
    );
  });
});

describe('runStartupMigration — discipline backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets discipline: run on runs when runs lack the field', async () => {
    const cols = makeMockDb({ orphanedPlans: 0, orphanedRuns: 0, orphanedMessages: 0 });
    // Override runs countDocuments to return 3 (runs needing discipline)
    cols.runs.countDocuments
      .mockResolvedValueOnce(0)   // first call: userId orphan check
      .mockResolvedValueOnce(3);  // second call: discipline check
    cols.runs.updateMany.mockResolvedValue({ modifiedCount: 3 });
    // plans.findOne returns null (no plans need discipline)
    cols.plans.findOne.mockResolvedValue(null);

    await runStartupMigration();

    expect(cols.runs.updateMany).toHaveBeenCalledWith(
      { discipline: { $exists: false } },
      { $set: { discipline: 'run' } }
    );
  });

  it('sets discipline: run on non-rest plan days via arrayFilters', async () => {
    const cols = makeMockDb({ orphanedPlans: 0, orphanedRuns: 0, orphanedMessages: 0 });
    cols.runs.countDocuments.mockResolvedValue(0);
    // totalOrphans === 0, so userId backfill block is skipped entirely.
    // The discipline check is the ONLY plans.findOne call in this scenario.
    cols.plans.findOne.mockResolvedValueOnce({ _id: 'plan1' });  // discipline check finds a plan needing migration
    cols.plans.updateMany.mockResolvedValue({ modifiedCount: 1 });

    await runStartupMigration();

    expect(cols.plans.updateMany).toHaveBeenCalledWith(
      { 'phases.weeks.days': { $elemMatch: { discipline: { $exists: false }, type: { $ne: 'rest' } } } },
      { $set: { 'phases.$[].weeks.$[].days.$[day].discipline': 'run' } },
      { arrayFilters: [{ 'day.discipline': { $exists: false }, 'day.type': { $ne: 'rest' } }] }
    );
  });

  it('skips discipline backfill when all runs and plans already have discipline', async () => {
    const cols = makeMockDb({ orphanedPlans: 0, orphanedRuns: 0, orphanedMessages: 0 });
    cols.runs.countDocuments.mockResolvedValue(0);  // all runs have discipline
    cols.plans.findOne.mockResolvedValue(null);       // no plans need discipline

    await runStartupMigration();

    // updateMany must NOT be called for discipline (it was not called for userId either)
    expect(cols.runs.updateMany).not.toHaveBeenCalledWith(
      { discipline: { $exists: false } },
      expect.anything()
    );
    expect(cols.plans.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ 'phases.weeks.days': expect.anything() }),
      expect.anything(),
      expect.anything()
    );
  });
});
