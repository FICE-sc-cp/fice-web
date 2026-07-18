'use client';

import { useEffect, useRef } from 'react';

/**
 * A minimal WYSIWYG editor: text formats visibly as you type. Uses the native
 * (deprecated but universally supported) `document.execCommand` so we ship zero
 * dependencies. Output is limited to the tags Telegram's parse_mode=HTML accepts
 * (<b><i><u><s><a>) so the same value renders in the TG post and on the site.
 * richtext: execCommand is legacy; regex-sanitize is best-effort for trusted admins.
 */

const TOOLS: { cmd: string; title: string; content: React.ReactNode }[] = [
  { cmd: 'bold', title: 'Жирний', content: <b>Ж</b> },
  { cmd: 'italic', title: 'Курсив', content: <i>К</i> },
  { cmd: 'underline', title: 'Підкреслений', content: <u>П</u> },
  { cmd: 'strikeThrough', title: 'Закреслений', content: <s>S</s> },
];

const fromStored = (v: string) => v.replace(/\n/g, '<br>');

function toStored(html: string): string {
  return html
    .replace(/<div><br\s*\/?><\/div>/gi, '\n')
    .replace(/<\/(?:div|p)>/gi, '')
    .replace(/<(?:div|p)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?strong>/gi, (t) => (t.startsWith('</') ? '</b>' : '<b>'))
    .replace(/<\/?em>/gi, (t) => (t.startsWith('</') ? '</i>' : '<i>'))
    .replace(/<\/?(?:strike|del)>/gi, (t) => (t.startsWith('</') ? '</s>' : '<s>'))
    // keep only b/i/u/s/a; strip attrs (except <a href>)
    .replace(/<(b|i|u|s)\b[^>]*>/gi, '<$1>')
    .replace(/<a\b[^>]*?href="([^"]*)"[^>]*>/gi, '<a href="$1">')
    .replace(/<(?!\/?(?:b|i|u|s|a)(?:\s|>|\/))[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function RichTextArea({
  label,
  value,
  onChange,
  rows = 5,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string>('');

  useEffect(() => {
    try {
      // 'false' => format with tags (<b>/<i>/…), not inline <span style> (which we'd strip).
      document.execCommand('styleWithCSS', false, 'false');
    } catch {}
  }, []);

  // Load external value (e.g. edit form fetch) without clobbering the caret.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== last.current && document.activeElement !== el) {
      el.innerHTML = fromStored(value);
      last.current = value;
    }
  }, [value]);

  function sync() {
    const stored = toStored(ref.current?.innerHTML ?? '');
    last.current = stored;
    onChange(stored);
  }

  function exec(cmd: string) {
    ref.current?.focus();
    document.execCommand(cmd, false);
    sync();
  }

  function addLink() {
    const url = window.prompt('Посилання (https://…):')?.trim();
    if (!url) return;
    ref.current?.focus();
    document.execCommand('createLink', false, url);
    sync();
  }

  const btn =
    'rounded-lg border border-border bg-bg-soft px-3 py-1 text-sm text-muted transition-colors hover:border-brand-cyan hover:text-fg';

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-muted">{label}</label>}
      {/* onMouseDown preventDefault keeps the selection when a button is pressed. */}
      <div className="flex gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.cmd}
            type="button"
            className={btn}
            title={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(t.cmd)}
          >
            {t.content}
          </button>
        ))}
        <button
          type="button"
          className={btn}
          title="Посилання"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
        >
          🔗
        </button>
        <button
          type="button"
          className={btn}
          title="Прибрати форматування"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('removeFormat')}
        >
          ✕
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-ph={placeholder}
        onInput={sync}
        style={{ minHeight: `${Math.max(rows, 3) * 1.7}rem` }}
        className="rounded-xl border border-border bg-bg-soft px-4 py-3 text-fg outline-none transition-colors focus:border-brand-cyan [&:empty]:before:text-subtle [&:empty]:before:content-[attr(data-ph)] [&_a]:text-brand-cyan [&_a]:underline"
      />
    </div>
  );
}
