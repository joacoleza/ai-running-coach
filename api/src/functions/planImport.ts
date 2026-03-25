import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Anthropic from '@anthropic-ai/sdk';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import type { Plan, PlanGoal, PlanPhase } from '../shared/types.js';

function extractTextFromHtml(html: string): string {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const noStyle = noScript.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = noStyle.replace(/<[^>]+>/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

app.http('importPlan', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plan/import',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    if (!process.env.ANTHROPIC_API_KEY) {
      return { status: 500, jsonBody: { error: 'AI service not configured' } };
    }

    let body: { url?: string };
    try {
      body = (await req.json()) as { url?: string };
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const { url } = body;

    if (!url) {
      return { status: 400, jsonBody: { error: 'url is required' } };
    }

    // Validate URL: must be a ChatGPT share link
    if (!/^https:\/\/chatgpt\.com\/share\//.test(url)) {
      return {
        status: 400,
        jsonBody: { error: 'URL must be a ChatGPT share link (https://chatgpt.com/share/...)' },
      };
    }

    // Fetch the shared URL
    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; running-coach/1.0)',
          'Accept': 'text/html',
        },
      });
      if (!res.ok) {
        return {
          status: 400,
          jsonBody: { error: 'Could not fetch the URL. Make sure the ChatGPT share link is public.' },
        };
      }
      html = await res.text();
    } catch (err) {
      context.log('Error fetching import URL:', err);
      return {
        status: 400,
        jsonBody: { error: 'Could not fetch the URL. Make sure the ChatGPT share link is public.' },
      };
    }

    // Extract text from HTML
    const extractedText = extractTextFromHtml(html);

    // Validate extracted content
    if (
      extractedText.length < 200 ||
      extractedText.includes('Log in') ||
      extractedText.includes('Sign up')
    ) {
      return {
        status: 400,
        jsonBody: { error: 'No training plan content detected in the shared conversation.' },
      };
    }

    // Send to Claude for parsing
    const anthropic = new Anthropic();
    const truncatedText = extractedText.slice(0, 15000);

    let claudeResponse: string;
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system:
          'You are a training plan parser. Extract the training plan from the following conversation and output it as JSON wrapped in <training_plan> tags. The JSON must be: {"phases": [{"name": "...", "description": "...", "weeks": [{"weekNumber": 1, "startDate": "YYYY-MM-DD", "days": [{"date": "YYYY-MM-DD", "type": "run|rest|cross-train", "objective": {"kind": "distance|time", "value": N, "unit": "km|min"}, "guidelines": "...", "completed": false, "skipped": false}]}]}]}. Rest days have type "rest" and no objective. Use real calendar dates starting from next Monday. Output ONLY the <training_plan> JSON, no other text.',
        messages: [{ role: 'user', content: truncatedText }],
      });

      claudeResponse =
        message.content[0].type === 'text' ? message.content[0].text : '';
    } catch (err) {
      context.log('Error calling Claude for plan parsing:', err);
      return { status: 500, jsonBody: { error: 'AI service not configured' } };
    }

    // Parse <training_plan> tag from Claude's response
    const match = claudeResponse.match(/<training_plan>([\s\S]*?)<\/training_plan>/);
    if (!match) {
      return {
        status: 400,
        jsonBody: {
          error:
            'Could not parse a training plan from the conversation. Try pasting the content directly in the coach chat.',
        },
      };
    }

    let parsedPlan: { phases: PlanPhase[] };
    try {
      parsedPlan = JSON.parse(match[1]);
      if (!parsedPlan.phases || !Array.isArray(parsedPlan.phases) || parsedPlan.phases.length === 0) {
        return {
          status: 400,
          jsonBody: {
            error:
              'Could not parse a training plan from the conversation. Try pasting the content directly in the coach chat.',
          },
        };
      }
    } catch {
      return {
        status: 400,
        jsonBody: {
          error:
            'Could not parse a training plan from the conversation. Try pasting the content directly in the coach chat.',
        },
      };
    }

    try {
      const db = await getDb();

      // Archive existing active plan (D-22)
      await db.collection('plans').updateOne(
        { status: 'active' },
        { $set: { status: 'archived', updatedAt: new Date() } },
      );

      // Create new plan with parsed phases
      const newPlan: Omit<Plan, '_id'> = {
        status: 'active',
        onboardingMode: 'paste',
        onboardingStep: 6,
        goal: {} as PlanGoal,
        phases: parsedPlan.phases,
        objective: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection<Plan>('plans').insertOne(newPlan as Plan);

      return {
        status: 201,
        jsonBody: { plan: { ...newPlan, _id: result.insertedId } },
      };
    } catch (err) {
      context.log('Error saving imported plan:', err);
      return {
        status: 503,
        jsonBody: { error: 'Service temporarily unavailable' },
      };
    }
  },
});
