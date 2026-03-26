import { Db } from 'mongodb';
import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage } from './types.js';

/**
 * Retrieve last 20 messages for a plan, formatted for Claude API.
 * If plan has a summary, it will be prepended by the caller in the system prompt.
 */
export async function buildContextMessages(planId: string, db: Db): Promise<Anthropic.MessageParam[]> {
  const messages = await db.collection<ChatMessage>('messages')
    .find({ planId })
    .limit(20)
    .toArray();

  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
}

/**
 * If message count exceeds 25, summarize older messages and store summary on plan.
 * Uses claude-3-5-haiku for cost efficiency.
 */
export async function maybeSummarize(planId: string, db: Db, client: Anthropic): Promise<void> {
  const count = await db.collection('messages').countDocuments({ planId });
  if (count < 25) return;

  const allMessages = await db.collection<ChatMessage>('messages')
    .find({ planId })
    .limit(count - 10)
    .toArray();

  allMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const summaryResponse = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Summarize this coaching conversation concisely. Focus on: the runner's goal, fitness level, preferences, and any plan adjustments discussed.\n\n${allMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`
    }]
  });

  const summary = (summaryResponse.content[0] as Anthropic.TextBlock).text;
  await db.collection('plans').updateOne(
    { _id: planId as any },
    { $set: { summary, updatedAt: new Date() } }
  );
}
