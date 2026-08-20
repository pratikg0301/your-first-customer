import type { APIRoute } from 'astro';
import { getClaudeClient } from '@/lib/claude';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env as Env;
    const body = await request.json() as { data: string; mediaType: string };

    const client = getClaudeClient(env.ANTHROPIC_API_KEY);

    const message = await client.messages.create({
      model: env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: body.data,
            },
          } as any,
          {
            type: 'text',
            text: `Extract the key business context from this deck into a short paragraph (max 200 words).
Focus on: what the product is, the problem it solves, the target customer, traction signals, and any unique differentiation.
Return plain text only — no headers, no bullet points, no markdown.`,
          },
        ],
      }],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    return Response.json({ context: text });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

interface Env {
  ANTHROPIC_API_KEY: string;
  CLAUDE_MODEL?: string;
}
