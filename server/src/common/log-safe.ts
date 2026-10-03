const TOKEN_IN_URL = /bot\d+:[\w-]+/g;
const BARE_TOKEN = /\b\d{6,}:[\w-]{30,}\b/g;

export function redactTokens(text: string): string {
  return text
    .replace(TOKEN_IN_URL, 'bot<redacted>')
    .replace(BARE_TOKEN, '<redacted>');
}

export function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return redactTokens(message);
}
