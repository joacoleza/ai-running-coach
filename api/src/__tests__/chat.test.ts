import { describe, it } from 'vitest';

describe('Chat - Rolling 20-message window (COACH-06)', () => {
  it.todo('buildContextMessages returns last 20 messages sorted by timestamp');
  it.todo('buildContextMessages returns fewer than 20 when fewer exist');
  it.todo('buildContextMessages returns empty array when no messages exist');
});

describe('Chat - Summary generation (COACH-06)', () => {
  it.todo('maybeSummarize does nothing when count < 25');
  it.todo('maybeSummarize generates summary when count >= 25');
  it.todo('summary is prepended to system prompt when available');
});
