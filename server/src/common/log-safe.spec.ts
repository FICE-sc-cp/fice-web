import { errorMessage, redactTokens } from './log-safe';

const TOKEN = '1234567890:AAH9xYz_abcdefghijklmnopqrstuvw-12345';

describe('log-safe', () => {
  it('redacts tokens inside Bot API URLs', () => {
    expect(
      redactTokens(
        `request to https://api.telegram.org/bot${TOKEN}/getUpdates failed`,
      ),
    ).toBe(
      'request to https://api.telegram.org/bot<redacted>/getUpdates failed',
    );
  });

  it('redacts bare tokens', () => {
    expect(redactTokens(`token ${TOKEN} rejected`)).toBe(
      'token <redacted> rejected',
    );
  });

  it('logs only the message of an error, redacted', () => {
    const err = new Error(`fetch https://api.telegram.org/bot${TOKEN}/getMe`);
    (err as Error & { cause?: unknown }).cause = { url: TOKEN };
    expect(errorMessage(err)).toBe(
      'fetch https://api.telegram.org/bot<redacted>/getMe',
    );
    expect(errorMessage('plain')).toBe('plain');
  });
});
