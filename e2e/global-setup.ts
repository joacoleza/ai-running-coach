import { execSync } from 'child_process'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcrypt'

const MONGO_URI = process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/running-coach-e2e'

export default async function globalSetup() {
  // In CI, MongoDB is started by the github-action before this runs — skip Docker.
  // Locally, start it via docker compose (idempotent — safe if already running).
  if (!process.env.CI) {
    execSync('docker compose up -d mongodb', { stdio: 'inherit' })
  }

  // Wait up to 30s for MongoDB to accept connections
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 2000 })
  const deadline = Date.now() + 30_000
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      await client.connect()
      await client.db('admin').command({ ping: 1 })
      break
    } catch (err) {
      lastError = err
      await client.close().catch(() => {})
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  if (Date.now() >= deadline) {
    throw new Error(`MongoDB not ready after 30s: ${lastError}`)
  }

  // Seed test users for E2E auth tests
  try {
    // DB name is embedded in the connection string path segment.
    // e.g. mongodb://localhost:27017/running-coach-e2e → running-coach-e2e
    //      mongodb://localhost:27017 (no path, CI default)  → running-coach
    const dbName = MONGO_URI.match(/\/\/[^/]+\/([^/?]+)/)?.[1] || 'running-coach'
    const db = client.db(dbName)
    const users = db.collection('users')

    // Remove existing test users (idempotent re-runs)
    await users.deleteMany({ email: { $in: ['test@example.com', 'temp@example.com', 'userb@example.com', 'admin@example.com', 'deactivate@example.com'] } })
    // Clear IP lockout records to prevent E2E auth tests being blocked by a previous run
    await db.collection('login_attempts').deleteMany({})

    const passwordHash = await bcrypt.hash('password123', 10)
    const now = new Date()

    // Normal user — no temp password required
    await users.insertOne({
      email: 'test@example.com',
      passwordHash,
      isAdmin: false,
      tempPassword: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    })

    // Temp-password user — must change password on login
    await users.insertOne({
      email: 'temp@example.com',
      passwordHash,
      isAdmin: false,
      tempPassword: true,
      active: true,
      createdAt: now,
      updatedAt: now,
    })

    // Second normal user — for cross-user data isolation tests
    await users.insertOne({
      email: 'userb@example.com',
      passwordHash,
      isAdmin: false,
      tempPassword: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    })

    // Admin user — for E2E admin panel tests
    await users.insertOne({
      email: 'admin@example.com',
      passwordHash,
      isAdmin: true,
      tempPassword: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    })

    // Deactivation target — used in admin deactivate/deactivated-login E2E tests only
    // (kept separate from userb@example.com to avoid breaking data isolation tests)
    await users.insertOne({
      email: 'deactivate@example.com',
      passwordHash,
      isAdmin: false,
      tempPassword: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    })

  } finally {
    await client.close()
  }
}
