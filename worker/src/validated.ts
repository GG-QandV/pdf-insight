import { complete, parseModelJson, type ChatTurn, type Env } from './llm';
import { retryMessage } from './prompt';

export class InvalidAiResponseError extends Error {
  constructor(readonly issues: string[]) {
    super('AI response failed validation');
  }
}

export type Check<T> = (raw: unknown) => { ok: true; value: T } | { ok: false; issues: string[] };

/**
 * Calls the model and checks the result; on failure asks ONCE more with the list of
 * problems (brief: "1 ponowna próba, potem komunikat błędu").
 */
export async function callValidated<T>(
  env: Env,
  models: Set<string>,
  system: string,
  turn: ChatTurn,
  check: Check<T>,
): Promise<T> {
  const turns: ChatTurn[] = [turn];
  let issues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, model } = await complete(env, system, turns);
    models.add(model);
    const result = check(parseModelJson(text));
    if (result.ok) return result.value;
    issues = result.issues;
    turns.push({ role: 'assistant', text }, { role: 'user', text: retryMessage(issues) });
  }
  throw new InvalidAiResponseError(issues);
}
