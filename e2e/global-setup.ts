import { execSync } from 'child_process'
import { MongoClient } from 'mongodb'

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
      await client.close()
      return
    } catch (err) {
      lastError = err
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw new Error(`MongoDB not ready after 30s: ${lastError}`)
}
