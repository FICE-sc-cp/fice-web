'use client';

import { downloadFile } from '@telegram-apps/sdk';
import { mediaUrl } from '@/lib/api';

interface AnswerFile {
  url: string;
  name: string;
}

const DOWNLOADS = /\.(pdf|docx?)$/i;

const ICONS: [RegExp, string][] = [
  [/\.(jpe?g|png|webp)$/i, '🖼️'],
  [/\.(mp4|mov|webm)$/i, '🎬'],
  [/\.pdf$/i, '📄'],
  [/\.docx?$/i, '📝'],
];

function isAnswerFile(item: unknown): item is AnswerFile {
  if (typeof item !== 'object' || item === null) return false;
  const { url, name } = item as Record<string, unknown>;
  return typeof url === 'string' && url.startsWith('/uploads/') && typeof name === 'string';
}

export function parseFileAnswer(value: string): AnswerFile[] | null {
  if (!value.startsWith('[')) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.every(isAnswerFile) ? parsed : null;
  } catch {
    return null;
  }
}

function FileName({ name }: { name: string }) {
  const ext = name.match(/\.[^./\\]{1,7}$/)?.[0] ?? '';
  return (
    <span className="flex min-w-0" title={name}>
      <span className="truncate">{ext ? name.slice(0, -ext.length) : name}</span>
      <span className="shrink-0">{ext}</span>
    </span>
  );
}

export function AnswerFiles({ files }: { files: AnswerFile[] }) {
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {files.map((file) => {
        const href = mediaUrl(file.url) ?? '#';
        const icon = ICONS.find(([pattern]) => pattern.test(file.url))?.[1] ?? '📎';
        return (
          <li key={file.url} className="min-w-0">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!DOWNLOADS.test(file.url) || !downloadFile.isAvailable()) return;
                e.preventDefault();
                void downloadFile(
                  new URL(href, window.location.origin).toString(),
                  file.name,
                ).catch(() => window.open(href, '_blank'));
              }}
              className="flex min-w-0 items-center gap-1.5 font-semibold text-brand-cyan hover:underline"
            >
              <span aria-hidden className="shrink-0">
                {icon}
              </span>
              <FileName name={file.name} />
              <span aria-hidden className="shrink-0 text-[10px] opacity-70">
                ↗
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
