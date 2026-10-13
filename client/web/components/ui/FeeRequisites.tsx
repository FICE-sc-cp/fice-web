'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Line =
  | { kind: 'link'; label: string; url: string }
  | { kind: 'card'; label: string; number: string }
  | { kind: 'text'; text: string };

const TOKEN =
  /(https?:\/\/[^\s<>"']+)|(\b\d{4}[ \u00a0-]?\d{4}[ \u00a0-]?\d{4}[ \u00a0-]?\d{4}\b)/g;
const URL_TAIL = /[.,;:!?)\]]+$/;
const LABEL_EDGES = /^[\s.,;:]+|[\s:\-–—]+$/g;
const MAX_LABEL = 48;

export function parseRequisites(text: string): Line[] {
  const lines: Line[] = [];
  const pushText = (raw: string) => {
    for (const part of raw.split(/\n+/)) {
      const clean = part.replace(LABEL_EDGES, '');
      if (clean) lines.push({ kind: 'text', text: clean });
    }
  };

  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    let label = text.slice(last, start).replace(/\s+/g, ' ').replace(LABEL_EDGES, '');
    if (label.length > MAX_LABEL) {
      pushText(label);
      label = '';
    }
    if (match[1]) {
      const url = match[1].replace(URL_TAIL, '');
      lines.push({ kind: 'link', label, url });
      last = start + url.length;
    } else {
      lines.push({ kind: 'card', label, number: match[2] });
      last = start + match[0].length;
    }
  }
  pushText(text.slice(last));
  return lines;
}

function linkLabel(url: string) {
  return /monobank/i.test(url) ? 'Посилання на банку' : 'Посилання для оплати';
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {}
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
  } catch {}
  area.remove();
}

interface FeeRequisitesProps {
  text: string;
  className?: string;
  onCopy?: () => void;
}

export function FeeRequisites({ text, className, onCopy }: FeeRequisitesProps) {
  const lines = useMemo(() => parseRequisites(text), [text]);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = (number: string) => {
    void copyText(number.replace(/\D/g, ''));
    setCopied(number);
    onCopy?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className={cn('flex flex-col items-start gap-2', className)}>
      {lines.map((line, i) => {
        if (line.kind === 'link') {
          return (
            <a
              key={i}
              href={line.url}
              target="_blank"
              rel="noopener noreferrer"
              title={line.url}
              className="inline-flex items-center gap-1.5 font-bold text-brand-cyan underline-offset-2 hover:underline"
            >
              {line.label || linkLabel(line.url)}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="size-3.5 shrink-0"
              >
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
          );
        }
        if (line.kind === 'card') {
          const done = copied === line.number;
          return (
            <button
              key={i}
              type="button"
              onClick={() => copy(line.number)}
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-left"
            >
              <span>{line.label || 'Номер картки'}:</span>
              <span className="font-bold tabular-nums text-fg">
                {line.number}
              </span>
              <span
                aria-live="polite"
                className={cn(
                  'text-xs font-bold',
                  done ? 'text-brand-green' : 'text-brand-cyan',
                )}
              >
                {done ? 'Номер картки скопійовано ✓' : 'Копіювати'}
              </span>
            </button>
          );
        }
        return <p key={i}>{line.text}</p>;
      })}
    </div>
  );
}
