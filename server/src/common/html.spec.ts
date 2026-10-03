import { escapeHtml } from './html';

describe('escapeHtml', () => {
  it('escapes the characters Telegram HTML mode parses', () => {
    expect(escapeHtml('<a href="https://evil">Tom & Jerry</a>')).toBe(
      '&lt;a href=&quot;https://evil&quot;&gt;Tom &amp; Jerry&lt;/a&gt;',
    );
  });

  it('stringifies non-strings and empties null-ish values', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
