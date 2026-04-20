import { ObjectId } from 'mongodb';

export interface ChatMessage {
  _id?: ObjectId;
  planId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  threadId: string;
  userId?: ObjectId;
}

export interface PlanGoal {
  eventType: '5K' | '10K' | 'half-marathon' | 'marathon';
  targetDate: string; // ISO date
  weeklyMileage: number;
  availableDays: number;
  units: 'km' | 'miles';
}

/** @deprecated Use PlanDay instead */
export interface PlanSession {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  distance: number;
  duration?: number; // minutes
  avgPace?: string; // "mm:ss"
  avgBpm?: number;
  notes: string;
  completed: boolean;
}

export interface PlanDay {
  label: string;          // "A"-"G" for non-rest days, "" for rest days
  type: 'run' | 'rest' | 'cross-train';
  objective?: {
    kind: 'distance' | 'time';
    value: number;
    unit: 'km' | 'min';
  };
  guidelines: string;
  completed: boolean;
  skipped: boolean;
}

export interface PlanWeek {
  weekNumber: number;     // globally sequential across all phases (1, 2, 3...)
  days: PlanDay[];
}

export interface PlanPhase {
  name: string;           // e.g. "Base Building"
  description: string;
  weeks: PlanWeek[];
}

export interface Plan {
  _id?: ObjectId;
  status: 'onboarding' | 'active' | 'archived';
  onboardingMode: 'conversational' | 'paste';
  onboardingStep: number;
  summary?: string;
  goal: PlanGoal;
  phases: PlanPhase[];
  objective?: 'marathon' | 'half-marathon' | '15km' | '10km' | '5km';
  targetDate?: string;
  progressFeedback?: string;
  createdAt: Date;
  updatedAt: Date;
  userId?: ObjectId;
}

export interface Run {
  _id?: ObjectId;
  date: string;            // ISO YYYY-MM-DD (actual run date, user-entered)
  distance: number;        // in user's preferred unit (km or miles)
  duration: string;        // "MM:SS" or "HH:MM:SS"
  pace: number;            // computed: minutes per km/mile (decimal)
  avgHR?: number;          // optional beats per minute
  notes?: string;          // optional free text
  planId?: ObjectId;       // linked plan ID (if linked to a training plan day)
  weekNumber?: number;     // linked week number (if linked)
  dayLabel?: string;       // linked day label A-G (if linked)
  insight?: string;        // coaching insight text (set after feedback)
  userId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  _id?: ObjectId;
  email: string;           // unique
  passwordHash: string;    // bcrypt hash
  isAdmin: boolean;
  tempPassword: boolean;   // true = must change password on next login (Phase 7 enforces)
  active: boolean;         // false = deactivated, cannot login or use API
  failedLoginAttempts?: number;  // consecutive failed login attempts; missing treated as 0
  lockedUntil?: Date;            // lockout expiry; absent = not locked
  lockoutCount?: number;         // how many times this user has been locked out (drives progressive duration)
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshToken {
  _id?: ObjectId;
  userId: ObjectId;
  tokenHash: string;       // SHA-256 hex of raw refresh token
  expiresAt: Date;         // TTL index auto-purges after this date
}
