import Anthropic from '@anthropic-ai/sdk';

export function getClaudeClient(apiKey: string) {
  return new Anthropic({ apiKey });
}

export async function runAgent(
  client: Anthropic,
  systemPrompt: string,
  userMessage: string,
  model = 'claude-sonnet-4-6',
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
  return block.text;
}

export async function runAgentJSON<T>(
  client: Anthropic,
  systemPrompt: string,
  userMessage: string,
  model = 'claude-sonnet-4-6',
): Promise<T> {
  const raw = await runAgent(
    client,
    systemPrompt + '\n\nRespond with valid JSON only. No prose, no markdown fences.',
    userMessage,
    model,
  );
  return JSON.parse(raw) as T;
}
