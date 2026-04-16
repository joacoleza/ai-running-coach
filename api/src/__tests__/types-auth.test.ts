import { describe, it, expect } from 'vitest'
import type { User, RefreshToken } from '../shared/types.js'
import { ObjectId } from 'mongodb'

describe('User interface', () => {
  it('accepts a valid User object with all required fields', () => {
    const user: User = {
      email: 'test@example.com',
      passwordHash: '$2b$12$hashedvalue',
      isAdmin: false,
      tempPassword: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(user.email).toBe('test@example.com')
    expect(user.passwordHash).toBeDefined()
    expect(user.isAdmin).toBe(false)
    expect(user.tempPassword).toBe(true)
  })

  it('accepts optional fields on User', () => {
    const user: User = {
      _id: new ObjectId(),
      email: 'admin@example.com',
      passwordHash: '$2b$12$hashedvalue',
      isAdmin: true,
      tempPassword: false,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(user._id).toBeDefined()
    expect(user.lastLoginAt).toBeDefined()
  })
})

describe('RefreshToken interface', () => {
  it('accepts a valid RefreshToken object', () => {
    const userId = new ObjectId()
    const token: RefreshToken = {
      userId,
      tokenHash: 'abc123def456',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }
    expect(token.userId).toBe(userId)
    expect(token.tokenHash).toBe('abc123def456')
    expect(token.expiresAt).toBeInstanceOf(Date)
  })

  it('accepts optional _id field on RefreshToken', () => {
    const token: RefreshToken = {
      _id: new ObjectId(),
      userId: new ObjectId(),
      tokenHash: 'sha256hexhash',
      expiresAt: new Date(),
    }
    expect(token._id).toBeDefined()
  })
})
