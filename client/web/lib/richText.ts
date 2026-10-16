const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"' };

/** The admin editor and posts from Telegram store text HTML-escaped (&amp;). */
export const decodeBasicEntities = (s: string) =>
  s.replace(/&(amp|lt|gt|quot);/g, (_m, name: string) => ENTITIES[name]);

const LINK_ATTRS =
  'target="_blank" rel="noopener noreferrer" class="text-brand-cyan underline underline-offset-2"';

const linkifyBare = (html: string): string =>
  html.replace(
    /(^|[\s(])(https?:\/\/[^\s<)"']+)/gi,
    (_m, pre: string, url: string) =>
      `${pre}<a href="${url}" ${LINK_ATTRS}>${url}</a>`,
  );

/**
 * Render admin-authored inline rich text: escape everything, then re-enable a
 * small whitelist (<b>/<strong>/<u>/<i>/<em>/<br> and <a href="http…">) and make
 * bare URLs clickable. Admin content is trusted; escaping just stops stray
 * markup from breaking the page. Not for untrusted input.
 * richtext: no tag nesting/validation; a tag can't span a news paragraph break.
 */
export function renderRichInline(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';
  // Decode first, or "&amp;" would be escaped twice and show up as text.
  const html = escapeHtml(decodeBasicEntities(text))
    .replace(/&lt;(\/?)(b|strong|u|i|em|s|strike|del)&gt;/gi, '<$1$2>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(
      /&lt;a href="(https?:\/\/[^"\s]+)"&gt;/gi,
      (_m, url: string) => `<a href="${url}" ${LINK_ATTRS}>`,
    )
    .replace(/&lt;\/a&gt;/gi, '</a>');

  // Linkify bare URLs only outside existing <a>…</a> spans.
  return html
    .split(/(<a\b[^>]*>.*?<\/a>)/gi)
    .map((seg) => (seg.startsWith('<a') ? seg : linkifyBare(seg)))
    .join('');
}
