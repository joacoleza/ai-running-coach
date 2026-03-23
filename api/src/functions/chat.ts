import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Anthropic from '@anthropic-ai/sdk';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import { buildContextMessages, maybeSummarize } from '../shared/context.js';
import { buildSystemPrompt } from '../shared/prompts.js';
import { ChatMessage, Plan } from '../shared/types.js';

const anthropic = new Anthropic();

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    if (!process.env.ANTHROPIC_API_KEY) {
      return { status: 500, jsonBody: { error: 'ANTHROPIC_API_KEY not configured' } };
    }

    const { planId, message } = await req.json() as { planId: string; message: string };
    if (!planId || !message) {
      return { status: 400, jsonBody: { error: 'planId and message are required' } };
    }

    const db = await getDb();

    // Save user message
    const userMsg: ChatMessage = {
      planId,
      role: 'user',
      content: message,
      timestamp: new Date(),
      threadId: planId,
    };
    await db.collection<ChatMessage>('messages').insertOne(userMsg);

    // Get plan for summary and onboarding state
    const plan = await db.collection<Plan>('plans').findOne({ _id: planId as any });
    const summary = plan?.summary;
    const onboardingStep = plan?.status === 'onboarding' ? plan.onboardingStep : undefined;

    // Build context
    const contextMessages = await buildContextMessages(planId, db);
    const systemPrompt = buildSystemPrompt(summary, onboardingStep);

    // Stream Claude response
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: contextMessages,
    });

    let fullText = '';
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          stream.on('text', (text) => {
            fullText += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          });

          stream.on('message', async () => {
            // Save assistant message
            const assistantMsg: ChatMessage = {
              planId,
              role: 'assistant',
              content: fullText,
              timestamp: new Date(),
              threadId: planId,
            };
            await db.collection<ChatMessage>('messages').insertOne(assistantMsg);

            // Increment onboarding step if in onboarding
            if (plan?.status === 'onboarding' && plan.onboardingStep < 6) {
              await db.collection('plans').updateOne(
                { _id: plan._id },
                { $inc: { onboardingStep: 1 }, $set: { updatedAt: new Date() } }
              );
            }

            // Trigger summarization if needed (fire and forget)
            maybeSummarize(planId, db, anthropic).catch(err =>
              context.error('Summary generation failed:', err)
            );

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
          });

          stream.on('error', (err) => {
            context.error('Claude stream error:', err);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
            controller.close();
          });
        } catch (err) {
          context.error('Stream setup error:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream setup failed' })}\n\n`));
          controller.close();
        }
      }
    });

    return {
      status: 200,
      body,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    };
  },
});
