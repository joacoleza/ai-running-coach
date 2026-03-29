import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Anthropic from '@anthropic-ai/sdk';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import { buildContextMessages, maybeSummarize } from '../shared/context.js';
import { buildSystemPrompt } from '../shared/prompts.js';
import { normalizeWeekDays } from '../shared/planUtils.js';
import { ChatMessage, Plan, PlanPhase, PlanGoal } from '../shared/types.js';

const anthropic = new Anthropic();

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    if (!process.env.ANTHROPIC_API_KEY) {
      context.error('ANTHROPIC_API_KEY is not configured');
      return { status: 500, jsonBody: { error: 'ANTHROPIC_API_KEY not configured' } };
    }

    const { planId, message, currentDate } = await req.json() as {
      planId: string;
      message: string;
      currentDate?: string;
    };
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
    const { ObjectId } = await import('mongodb');
    const plan = ObjectId.isValid(planId)
      ? await db.collection<Plan>('plans').findOne({ _id: new ObjectId(planId) as any })
      : null;
    const summary = plan?.summary;
    const onboardingStep = plan?.status === 'onboarding' ? plan.onboardingStep : undefined;
    const phases = plan?.phases;

    // Build context
    const contextMessages = await buildContextMessages(planId, db);
    const systemPrompt = buildSystemPrompt(summary, onboardingStep, phases, currentDate);

    // Inject current plan state as a synthetic message pair right before the user's message.
    // This makes the current plan appear as recent conversation context, overriding stale
    // references in older history (e.g. days the user later deleted or un-completed).
    if (phases && phases.length > 0 && contextMessages.length > 0) {
      const trainingDays = phases
        .flatMap(p => p.weeks.flatMap(w => w.days))
        .filter(d => d.type !== 'rest')
        .sort((a, b) => a.date.localeCompare(b.date));

      if (trainingDays.length > 0) {
        const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const today = currentDate ?? isoDate(new Date());
        const lines = trainingDays.map(d => {
          const dow = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
          const status = d.completed ? '[COMPLETED]' : d.skipped ? '[SKIPPED]' : (d.date < today ? '[PAST/UPCOMING]' : '[UPCOMING]');
          const obj = d.objective ? ` ${d.objective.value}${d.objective.unit}` : '';
          return `- ${dow} ${d.date} ${status}:${obj} — ${d.guidelines}`;
        });
        const planStateContent = `[Current training plan — authoritative, reflects all manual changes made outside this chat]\n\n${lines.join('\n')}`;

        // Insert synthetic pair before the last message (the current user message)
        const currentUserMsg = contextMessages.pop()!;
        contextMessages.push(
          { role: 'user', content: planStateContent },
          { role: 'assistant', content: 'Got it — I have the current state of your plan.' },
        );
        contextMessages.push(currentUserMsg);
      }
    }

    // Stream Claude response
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
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

            // If Claude generated a training plan, parse and save it directly — no client round-trip needed
            let planGenerated = false;
            if (fullText.includes('<training_plan>') && ObjectId.isValid(planId)) {
              const planMatch = fullText.match(/<training_plan>([\s\S]*?)<\/training_plan>/);
              if (planMatch) {
                try {
                  const parsed = JSON.parse(planMatch[1]) as { goal?: PlanGoal; phases: PlanPhase[] };
                  if (parsed.phases && Array.isArray(parsed.phases) && parsed.phases.length > 0) {
                    const resolvedGoal: PlanGoal = parsed.goal ?? plan?.goal ?? ({} as PlanGoal);
                    function deriveObjective(eventType?: string): Plan['objective'] | undefined {
                      if (!eventType) return undefined;
                      const et = eventType.toLowerCase().replace(/[\s_]+/g, '-');
                      if (et.includes('half')) return 'half-marathon';
                      if (et.includes('marathon')) return 'marathon';
                      if (et.includes('15k')) return '15km';
                      if (et.includes('10k')) return '10km';
                      if (et.includes('5k')) return '5km';
                      return undefined;
                    }
                    const resolvedObjective = deriveObjective(resolvedGoal?.eventType);
                    const normalizedPhases = parsed.phases.map((p: PlanPhase) => ({
                      ...p,
                      weeks: p.weeks.map(normalizeWeekDays),
                    }));
                    await db.collection<Plan>('plans').findOneAndUpdate(
                      { _id: new ObjectId(planId) as any },
                      {
                        $set: {
                          status: 'active',
                          goal: resolvedGoal,
                          phases: normalizedPhases,
                          objective: resolvedObjective,
                          targetDate: resolvedGoal?.targetDate,
                          updatedAt: new Date(),
                        },
                      },
                    );
                    planGenerated = true;
                  }
                } catch {
                  // Non-fatal: log but let the client know plan saving failed via the done event
                  context.error('Failed to parse/save training plan from chat response');
                }
              }
            }

            // Trigger summarization if needed (fire and forget)
            maybeSummarize(planId, db, anthropic).catch(err =>
              context.error('Summary generation failed:', err)
            );

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, planGenerated })}\n\n`));
            controller.close();
          });

          stream.on('error', (err) => {
            const msg = err instanceof Error ? err.message : String(err);
            context.error('Claude stream error:', { message: msg, planId, stack: err instanceof Error ? err.stack : undefined });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Claude error: ${msg}` })}\n\n`));
            controller.close();
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          context.error('Stream setup error:', { message: msg, planId, stack: err instanceof Error ? (err as Error).stack : undefined });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Stream setup failed: ${msg}` })}\n\n`));
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
