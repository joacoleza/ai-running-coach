import { execSync } from 'child_process'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcrypt'

const MONGO_URI = process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017'

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
    const db = client.db()  // uses default DB from connection string
    const users = db.collection('users')

    // Remove existing test users (idempotent re-runs)
    await users.deleteMany({ email: { $in: ['test@example.com', 'temp@example.com'] } })

    const passwordHash = await bcrypt.hash('password123', 10)
    const now = new Date()

    // Normal user — no temp password required
    await users.insertOne({
      email: 'test@example.com',
      passwordHash,
      isAdmin: false,
      tempPassword: false,
      createdAt: now,
      updatedAt: now,
    })

    // Temp-password user — must change password on login
    await users.insertOne({
      email: 'temp@example.com',
      passwordHash,
      isAdmin: false,
      tempPassword: true,
      createdAt: now,
      updatedAt: now,
    })
  } finally {
    await client.close()
  }
}
