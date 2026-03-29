import { describe, it, expect, vi } from 'vitest';

// Mock Anthropic SDK so tests never make real API calls
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      stream: vi.fn(),
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Runner is training for a 10K with 30km/week base.' }],
      }),
    },
  })),
}));

import { buildContextMessages, maybeSummarize } from '../shared/context.js';
import { buildSystemPrompt } from '../shared/prompts.js';
import Anthropic from '@anthropic-ai/sdk';

type Msg = { planId: string; role: 'user' | 'assistant'; content: string; timestamp: Date };

function makeMockDb(messages: Msg[], count?: number) {
  const plansUpdateOne = vi.fn().mockResolvedValue({});
  const toArray = vi.fn().mockResolvedValue(messages);
  const limit = vi.fn().mockReturnValue({ toArray });
  const sort = vi.fn().mockReturnValue({ limit, toArray });
  const find = vi.fn().mockReturnValue({ sort });
  const countDocuments = vi.fn().mockResolvedValue(count ?? messages.length);

  return {
    collection: vi.fn().mockImplementation((name: string) => {
      if (name === 'plans') return { updateOne: plansUpdateOne };
      return { find, countDocuments };
    }),
    _mocks: { find, sort, limit, toArray, countDocuments, plansUpdateOne },
  };
}


describe('Chat - Rolling 20-message window (COACH-06)', () => {
  it('buildContextMessages returns last 20 messages sorted by timestamp', async () => {
    // Simulate MongoDB returning messages in descending order (sort({timestamp:-1}))
    const msgs: Msg[] = Array.from({ length: 20 }, (_, i) => ({
      planId: 'plan1',
      role: 'user',
      content: `msg ${19 - i}`, // descending: msg19, msg18, ..., msg0
      timestamp: new Date(19 - i),
    }));
    const db = makeMockDb(msgs);

    const result = await buildContextMessages('plan1', db as any);

    expect(db._mocks.sort).toHaveBeenCalledWith({ timestamp: -1 });
    expect(db._mocks.limit).toHaveBeenCalledWith(20);
    // reverse() in buildContextMessages produces ascending order
    expect(result).toHaveLength(20);
    expect(result[0].content).toBe('msg 0');
    expect(result[19].content).toBe('msg 19');
  });

  it('buildContextMessages returns fewer than 20 when fewer exist', async () => {
    const msgs: Msg[] = [
      { planId: 'plan1', role: 'user', content: 'hello', timestamp: new Date(2) },
      { planId: 'plan1', role: 'assistant', content: 'hi', timestamp: new Date(1) },
    ];
    const db = makeMockDb(msgs);

    const result = await buildContextMessages('plan1', db as any);

    expect(result).toHaveLength(2);
  });

  it('buildContextMessages returns empty array when no messages exist', async () => {
    const db = makeMockDb([]);

    const result = await buildContextMessages('plan1', db as any);

    expect(result).toHaveLength(0);
  });
});

describe('Chat - Summary generation (COACH-06)', () => {
  it('maybeSummarize does nothing when count < 25', async () => {
    const db = makeMockDb([], 10);
    const client = new Anthropic() as any;

    await maybeSummarize('plan1', db as any, client);

    expect(client.messages.create).not.toHaveBeenCalled();
    expect(db._mocks.plansUpdateOne).not.toHaveBeenCalled();
  });

  it('maybeSummarize generates summary when count >= 25', async () => {
    // 15 messages returned from find().limit(25-10=15)
    const msgs: Msg[] = Array.from({ length: 15 }, (_, i) => ({
      planId: 'plan1',
      role: 'user',
      content: `msg ${i}`,
      timestamp: new Date(i),
    }));
    const db = makeMockDb(msgs, 25);
    const client = new Anthropic() as any;

    await maybeSummarize('plan1', db as any, client);

    expect(client.messages.create).toHaveBeenCalledOnce();
    expect(db._mocks.plansUpdateOne).toHaveBeenCalledOnce();
    const [, updateDoc] = db._mocks.plansUpdateOne.mock.calls[0] as [unknown, { $set: { summary: string } }];
    expect(updateDoc.$set.summary).toBe('Runner is training for a 10K with 30km/week base.');
  });

  it('summary is prepended to system prompt when available', () => {
    const summary = 'Runner: 10K target, 30km/week base, 4 days/week, no injuries.';
    const prompt = buildSystemPrompt(summary, undefined, []);

    expect(prompt).toContain('Conversation Summary');
    expect(prompt).toContain(summary);
  });
});
