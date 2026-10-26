import type { PageImage } from './request';

export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  // Any OpenAI-compatible API (optional, e.g. OpenRouter or a local mock for tests).
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  // Groq fallback: three accounts, used in order when the previous provider is unavailable.
  GROQ_API_KEY?: string;
  GROQ_API_KEY_2?: string;
  GROQ_API_KEY_3?: string;
  GROQ_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  // Workers Rate Limiting binding (typed structurally so shared code needs no Workers types).
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  images?: PageImage[];
}

export class LlmError extends Error {
  constructor(
    readonly code: 'AI_BUSY' | 'AI_TIMEOUT' | 'AI_UPSTREAM' | 'AI_CONFIG',
    message: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 25_000;

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new LlmError('AI_TIMEOUT', 'LLM request timed out');
    }
    throw new LlmError('AI_UPSTREAM', 'LLM request failed');
  }
  if (res.status === 429 || res.status === 503)
    throw new LlmError('AI_BUSY', `LLM busy (${res.status})`);
  if (!res.ok) throw new LlmError('AI_UPSTREAM', `LLM error ${res.status}`);
  return res.json();
}

async function geminiComplete(
  apiKey: string,
  model: string,
  system: string,
  turns: ChatTurn[],
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const data = (await postJson(
    url,
    { 'x-goog-api-key': apiKey },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({
        role: t.role === 'assistant' ? 'model' : 'user',
        parts: [
          { text: t.text },
          ...(t.images ?? []).map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.data },
          })),
        ],
      })),
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (text === '') throw new LlmError('AI_UPSTREAM', 'Empty LLM response');
  return text;
}

async function openAiComplete(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  turns: ChatTurn[],
): Promise<string> {
  const hasImages = turns.some((t) => (t.images?.length ?? 0) > 0);
  const data = (await postJson(
    `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    { Authorization: `Bearer ${apiKey}` },
    {
      model,
      temperature: 0.1,
      // JSON mode is not supported together with images by every provider; the prompt still asks for JSON.
      ...(hasImages ? {} : { response_format: { type: 'json_object' } }),
      messages: [
        { role: 'system', content: system },
        ...turns.map((t) => ({
          role: t.role,
          content:
            t.images && t.images.length > 0
              ? [
                  { type: 'text', text: t.text },
                  ...t.images.map((img) => ({
                    type: 'image_url',
                    image_url: { url: `data:${img.mimeType};base64,${img.data}` },
                  })),
                ]
              : t.text,
        })),
      ],
    },
  )) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? '';
  if (text === '') throw new LlmError('AI_UPSTREAM', 'Empty LLM response');
  return text;
}

interface Provider {
  model: string;
  call: (system: string, turns: ChatTurn[]) => Promise<string>;
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_DEFAULT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

/** Providers in priority order: Gemini → OpenAI-compatible → Groq accounts 1, 2, 3. */
export function providers(env: Env): Provider[] {
  const list: Provider[] = [];
  if (env.GEMINI_API_KEY) {
    const key = env.GEMINI_API_KEY;
    const model = env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    list.push({ model, call: (s, t) => geminiComplete(key, model, s, t) });
  }
  if (env.OPENAI_API_KEY && env.OPENAI_BASE_URL && env.OPENAI_MODEL) {
    const { OPENAI_API_KEY: key, OPENAI_BASE_URL: base, OPENAI_MODEL: model } = env;
    list.push({ model, call: (s, t) => openAiComplete(base, key, model, s, t) });
  }
  const groqModel = env.GROQ_MODEL ?? GROQ_DEFAULT_MODEL;
  for (const key of [env.GROQ_API_KEY, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3]) {
    if (key)
      list.push({
        model: groqModel,
        call: (s, t) => openAiComplete(GROQ_BASE_URL, key, groqModel, s, t),
      });
  }
  return list;
}

export interface Completion {
  text: string;
  model: string;
}

/**
 * Tries providers in order; a provider that is rate-limited, times out or fails
 * hands the request to the next one. Only the last error reaches the user.
 */
export async function complete(env: Env, system: string, turns: ChatTurn[]): Promise<Completion> {
  const list = providers(env);
  if (list.length === 0) throw new LlmError('AI_CONFIG', 'No LLM provider configured');
  let lastError: LlmError = new LlmError('AI_UPSTREAM', 'No provider succeeded');
  for (const provider of list) {
    try {
      return { text: await provider.call(system, turns), model: provider.model };
    } catch (err) {
      lastError = err instanceof LlmError ? err : new LlmError('AI_UPSTREAM', 'LLM call failed');
    }
  }
  throw lastError;
}

/** Parses the model's JSON, tolerating a ```json fence around it. */
export function parseModelJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
