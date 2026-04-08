import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Anthropic from '@anthropic-ai/sdk';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import { buildContextMessages, maybeSummarize } from '../shared/context.js';
import { buildSystemPrompt } from '../shared/prompts.js';
import { assignPlanStructure } from '../shared/planUtils.js';
import { ChatMessage, Plan, PlanPhase, PlanGoal, Run } from '../shared/types.js';

/**
 * Format a decimal pace (minutes per km/mile) as "M:SS"
 * e.g. 5.5 → "5:30", 4.25 → "4:15"
 */
export function formatPace(paceDecimal: number): string {
  const minutes = Math.floor(paceDecimal);
  const seconds = Math.round((paceDecimal - minutes) * 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format an ISO date string (YYYY-MM-DD) as DD/MM/YYYY
 */
export function formatRunDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

const anthropic = new Anthropic();

// Extract the first balanced JSON object from a string, ignoring any trailing content.
// Claude occasionally emits stray characters after the closing brace (e.g. an extra `}`)
// which makes JSON.parse throw "Unexpected non-whitespace character after JSON".
export function extractFirstJson(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in text');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') { if (--depth === 0) return text.slice(start, i + 1); }
    }
  }
  throw new Error('Unbalanced JSON object in training plan');
}

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

    const { planId, message } = await req.json() as {
      planId: string;
      message: string;
      currentDate?: string; // kept for backward compat but no longer forwarded to prompt
    };
    if (!planId || !message) {
      return { status: 400, jsonBody: { error: 'planId and message are required' } };
    }

    const db = await getDb();

    // Save user message — content is stored as-is, newlines preserved
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
    const systemPrompt = buildSystemPrompt(summary, onboardingStep, phases);

    // Inject current plan state as a synthetic message pair right before the user's message.
    // This makes the current plan appear as recent conversation context, overriding stale
    // references in older history (e.g. days the user later deleted or un-completed).
    if (phases && phases.length > 0 && contextMessages.length > 0) {
      const trainingDays = phases
        .flatMap(p => p.weeks.flatMap(w =>
          w.days
            .filter(d => d.type !== 'rest')
            .map(d => ({ ...d, weekNumber: w.weekNumber }))
        ))
        .sort((a, b) => {
          if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
          return (a.label ?? '').localeCompare(b.label ?? '');
        });

      if (trainingDays.length > 0) {
        // Fetch linked runs for completed days to enrich context
        let runsByKey = new Map<string, Run>();
        if (plan?._id && ObjectId.isValid(planId)) {
          try {
            const linkedRuns = await db.collection<Run>('runs').find({
              planId: plan._id,
            }).toArray();
            for (const run of linkedRuns) {
              if (run.weekNumber != null && run.dayLabel) {
                runsByKey.set(`${run.weekNumber}-${run.dayLabel}`, run);
              }
            }
          } catch {
            // Non-fatal: proceed without run data if fetch fails
          }
        }

        const lines = trainingDays.map(d => {
          const status = d.completed ? '[COMPLETED]' : d.skipped ? '[SKIPPED]' : '[UPCOMING]';
          const obj = d.objective ? ` ${d.objective.value}${d.objective.unit}` : '';
          let line = `- Week ${d.weekNumber} Day ${d.label} ${status}:${obj} — ${d.guidelines}`;

          // For completed days, append actual run data if available
          if (d.completed && d.weekNumber != null && d.label) {
            const run = runsByKey.get(`${d.weekNumber}-${d.label}`);
            if (run) {
              const runDate = formatRunDate(run.date);
              const runPace = run.pace > 0 ? ` @ ${formatPace(run.pace)}/km` : '';
              line += ` | Ran: ${runDate}, ${run.distance}km${runPace}`;
              if (run.notes) {
                const truncatedNotes = run.notes.length > 500
                  ? run.notes.slice(0, 500) + '...'
                  : run.notes;
                line += ` | Notes: ${truncatedNotes}`;
              }
              if (run.insight) {
                const truncatedInsight = run.insight.length > 150
                  ? run.insight.slice(0, 150) + '...'
                  : run.insight;
                line += ` | Insight: ${truncatedInsight}`;
              }
            }
          }

          return line;
        });

        // Prepend progressFeedback if available
        const feedbackPrefix = plan?.progressFeedback
          ? `Coach's previous progress assessment: ${plan.progressFeedback}\n\n`
          : '';

        const planStateContent = `[Current training plan — authoritative, reflects all manual changes made outside this chat]\n\n${feedbackPrefix}${lines.join('\n')}`;

        // Insert synthetic pair before the last message (the current user message)
        const currentUserMsg = contextMessages.pop()!;
        contextMessages.push(
          { role: 'user', content: planStateContent },
          { role: 'assistant', content: 'Got it — I have the current state of your plan.' },
        );
        contextMessages.push(currentUserMsg);
      }
    }

    // Stream Claude response (no tool calls — calendar is pre-computed in the system prompt)
    const messages: Anthropic.MessageParam[] = contextMessages;
    let fullText = '';
    const encoder = new TextEncoder();

    const body = new ReadableStream({
      async start(controller) {
        try {
          const stream = anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            system: systemPrompt,
            messages,
          });

          stream.on('text', (text) => {
            fullText += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          });

          try {
            await stream.finalMessage();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.error('Claude stream error:', { message: msg, planId, stack: err instanceof Error ? err.stack : undefined });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Claude error: ${msg}` })}\n\n`));
            controller.close();
            return;
          }

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
                const parsed = JSON.parse(extractFirstJson(planMatch[1])) as { goal?: PlanGoal; phases: PlanPhase[] };
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
                  // Assign globally sequential week numbers and A-G labels
                  const normalizedPhases = assignPlanStructure(parsed.phases);
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
              } catch (saveErr) {
                const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
                context.error('Failed to parse/save training plan from chat response:', msg);
                // Surface the error to the client so it shows in the chat
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Plan save failed: ${msg}` })}\n\n`));
              }
            }
          }

          // Trigger summarization if needed (fire and forget)
          maybeSummarize(planId, db, anthropic).catch(err =>
            context.error('Summary generation failed:', err)
          );

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, planGenerated })}\n\n`));
          controller.close();

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
