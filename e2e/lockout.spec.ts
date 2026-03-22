import { test, expect } from '@playwright/test'
import { MongoClient } from 'mongodb'

const MONGO_URI = process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017'

test.describe('Lockout behavior', () => {
  test.beforeEach(async () => {
    // Reset lockout state in MongoDB before each test
    const client = new MongoClient(MONGO_URI)
    await client.connect()
    await client.db('running-coach').collection('auth').deleteMany({})
    await client.close()
  })

  test('shows locked error after too many wrong attempts', async ({ page }) => {
    // Simulate 30 failed attempts directly in MongoDB
    // (Faster than submitting the form 30 times)
    const client = new MongoClient(MONGO_URI)
    await client.connect()
    await client.db('running-coach').collection('auth').insertOne({
      _id: 'lockout' as any,
      failureCount: 30,
      blocked: true,
    })
    await client.close()

    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await page.getByPlaceholder('Enter password').fill('e2e-test-password')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByText('Service locked. Contact administrator.')).toBeVisible({ timeout: 10_000 })
  })

  test('wrong password increments failure count in DB', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await page.getByPlaceholder('Enter password').fill('wrong')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByText('Wrong password')).toBeVisible({ timeout: 10_000 })

    // Assert MongoDB state
    const client = new MongoClient(MONGO_URI)
    await client.connect()
    const doc = await client.db('running-coach').collection('auth').findOne({ _id: 'lockout' as any })
    expect(doc?.failureCount).toBe(1)
    expect(doc?.blocked).toBeFalsy()
    await client.close()
  })
})
