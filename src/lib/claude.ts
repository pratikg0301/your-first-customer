import Anthropic from '@anthropic-ai/sdk';

export function getClaudeClient(apiKey: string) {
  return new Anthropic({ apiKey });
}

export async function runAgent(
  client: Anthropic,
  systemPrompt: string,
  userMessage: string,
  model = 'claude-sonnet-4-6',
  maxTokens = 4096,
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
  if (response.stop_reason === 'max_tokens') {
    throw new Error(`Claude response truncated at ${maxTokens} tokens — the output was too long. Try reducing scope.`);
  }
  return block.text;
}

export async function runAgentJSON<T>(
  client: Anthropic,
  systemPrompt: string,
  userMessage: string,
  model = 'claude-sonnet-4-6',
  maxTokens = 4096,
): Promise<T> {
  const raw = await runAgent(
    client,
    systemPrompt + '\n\nRespond with valid JSON only. No prose, no markdown fences.',
    userMessage,
    model,
    maxTokens,
  );
  // Strip any markdown fences Claude may still emit despite the instruction
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`JSON parse failed. Claude output (first 600 chars): ${cleaned.slice(0, 600)}`);
  }
}
