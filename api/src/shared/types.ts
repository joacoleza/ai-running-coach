import { ObjectId } from 'mongodb';

export interface ChatMessage {
  _id?: ObjectId;
  planId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  threadId: string;
}

export interface PlanGoal {
  eventType: '5K' | '10K' | 'half-marathon' | 'marathon';
  targetDate: string; // ISO date
  weeklyMileage: number;
  availableDays: number;
  units: 'km' | 'miles';
}

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

export interface Plan {
  _id?: ObjectId;
  status: 'onboarding' | 'active' | 'completed' | 'discarded';
  onboardingMode: 'conversational' | 'paste';
  onboardingStep: number;
  summary?: string;
  goal: PlanGoal;
  sessions: PlanSession[];
  createdAt: Date;
  updatedAt: Date;
}
