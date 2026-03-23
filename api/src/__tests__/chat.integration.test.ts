import { describe, it } from 'vitest';

describe('Chat Integration (COACH-01)', () => {
  it.todo('POST /api/chat saves user message to messages collection');
  it.todo('POST /api/chat saves assistant message after stream completes');
  it.todo('POST /api/chat returns 400 when planId is missing');
  it.todo('POST /api/chat returns 401 when password is wrong');
});
