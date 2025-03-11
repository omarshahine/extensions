import { DEBUG } from "../constants";

export function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

/**
 * Log detailed information about OpenAI API token usage
 */
export function debugTokenUsage(response: {
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  id: string;
  choices?: Array<{ message?: { role: string; content: string | null } }>;
}): void {
  if (DEBUG && response.usage) {
    console.log("[DEBUG] Token Usage:", response.usage);
  }
}
