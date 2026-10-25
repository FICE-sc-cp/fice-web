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
    <div className={cn('flex flex-col gap-2.5', className)}>
      {lines.map((line, i) => {
        if (line.kind === 'link') {
          return (
            <a
              key={i}
              href={line.url}
              target="_blank"
              rel="noopener noreferrer"
              title={line.url}
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-3.5 py-2.5 font-bold text-brand-cyan transition-colors hover:bg-brand-cyan/15"
            >
              <span className="min-w-0">{line.label || linkLabel(line.url)}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="size-4 shrink-0"
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
            <div key={i} className="flex flex-col gap-1">
              <span className="text-xs">{line.label || 'Номер картки'}</span>
              <button
                type="button"
                onClick={() => copy(line.number)}
                className="flex flex-col items-start gap-0.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left"
              >
                <span className="whitespace-nowrap font-mono text-base font-bold tracking-wide text-fg tabular-nums">
                  {line.number.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ')}
                </span>
                <span
                  aria-live="polite"
                  className={cn(
                    'text-xs font-bold',
                    done ? 'text-brand-green' : 'text-brand-cyan',
                  )}
                >
                  {done ? 'Номер скопійовано ✓' : 'Натисни, щоб скопіювати'}
                </span>
              </button>
            </div>
          );
        }
        return <p key={i}>{line.text}</p>;
      })}
    </div>
  );
}
