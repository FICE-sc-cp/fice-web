'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ApiError, fice, mediaUrl, type AnswerFile, type EventQuestion } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  FILE_KINDS,
  extensionOf,
  fileAccept,
  fileHint,
  fileKindOf,
  fileProblem,
  formatSize,
  shortName,
  tooLargeText,
} from '@/lib/uploads';
import { CloseIcon } from '@/components/ui/icons';

interface Upload {
  id: number;
  name: string;
  size: number;
  progress: number;
  controller: AbortController;
}

function FileName({ name }: { name: string }) {
  const ext = extensionOf(name);
  const tail = ext.length > 1 && ext.length <= 8 ? name.slice(-ext.length) : '';
  return (
    <span className="flex min-w-0 flex-1" title={name}>
      <span className="truncate">{tail ? name.slice(0, -tail.length) : name}</span>
      <span className="shrink-0">{tail}</span>
    </span>
  );
}

const iconOf = (name: string) => {
  const kind = fileKindOf({ name });
  return kind ? FILE_KINDS[kind].icon : '📎';
};

export function AnswerFileLinks({
  files,
  className,
}: {
  files: AnswerFile[];
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col gap-1', className)}>
      {files.map((file) => (
        <li key={file.url} className="min-w-0">
          <a
            href={mediaUrl(file.url) ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-1.5 font-semibold text-brand-cyan hover:underline"
          >
            <span aria-hidden className="shrink-0">
              {iconOf(file.url)}
            </span>
            <FileName name={file.name} />
            <span aria-hidden className="shrink-0">
              ↗
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

interface FileAnswerFieldProps {
  question: EventQuestion;
  label: string;
  files: AnswerFile[];
  onChange: (update: (files: AnswerFile[]) => AnswerFile[]) => void;
  onBusyChange: (busy: boolean) => void;
  error?: string;
  onResult?: (ok: boolean) => void;
}

export function FileAnswerField({
  question,
  label,
  files,
  onChange,
  onBusyChange,
  error,
  onResult,
}: FileAnswerFieldProps) {
  const kinds = question.fileKinds ?? [];
  const max = question.maxFiles ?? 1;
  const fieldId = useId();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const nextId = useRef(0);
  const pending = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const controllers = useRef(new Set<AbortController>());

  useEffect(() => {
    const active = controllers.current;
    return () => active.forEach((controller) => controller.abort());
  }, []);

  const used = files.length + uploads.length;
  const free = Math.max(0, max - used);
  const errors = [...problems, ...(error ? [error] : [])];

  const settle = () => {
    pending.current -= 1;
    if (pending.current === 0) onBusyChange(false);
  };

  const send = async (upload: Upload, file: File) => {
    try {
      if (upload.controller.signal.aborted) return;
      const { url } = await fice.uploadFile(
        file,
        (share) =>
          setUploads((list) =>
            list.map((u) => (u.id === upload.id ? { ...u, progress: share } : u)),
          ),
        upload.controller.signal,
      );
      onChange((list) =>
        list.length >= max
          ? list
          : [...list, { url, name: [...file.name].slice(0, 255).join('') }],
      );
      onResult?.(true);
    } catch (err) {
      if (upload.controller.signal.aborted) return;
      const kind = fileKindOf(file);
      const message =
        err instanceof ApiError && err.status === 413 && kind
          ? tooLargeText(file.name, kind)
          : `Файл «${shortName(file.name)}»: ${err instanceof Error ? err.message : 'не вдалося завантажити'}`;
      setProblems((list) => [...list, message]);
      onResult?.(false);
    } finally {
      controllers.current.delete(upload.controller);
      setUploads((list) => list.filter((u) => u.id !== upload.id));
      settle();
    }
  };

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!picked.length) return;
    const found: string[] = [];
    const accepted: { upload: Upload; file: File }[] = [];
    let skipped = 0;
    for (const file of picked) {
      const problem = fileProblem(file, kinds);
      if (problem) {
        found.push(problem);
      } else if (accepted.length >= free) {
        skipped += 1;
      } else {
        accepted.push({
          file,
          upload: {
            id: nextId.current++,
            name: file.name,
            size: file.size,
            progress: 0,
            controller: new AbortController(),
          },
        });
      }
    }
    if (skipped) {
      found.push(
        max === 1
          ? 'Сюди можна додати лише один файл.'
          : `Можна додати не більше ${max} файлів, зайві не додано.`,
      );
    }
    setProblems(found);
    if (!accepted.length) {
      if (found.length) onResult?.(false);
      return;
    }
    if (pending.current === 0) onBusyChange(true);
    pending.current += accepted.length;
    setUploads((list) => [...list, ...accepted.map((a) => a.upload)]);
    for (const { upload, file } of accepted) {
      controllers.current.add(upload.controller);
      chain.current = chain.current.then(() => send(upload, file));
    }
  };

  const cancel = (upload: Upload) => {
    upload.controller.abort();
    setUploads((list) => list.filter((u) => u.id !== upload.id));
  };

  const remove = (url: string) => {
    setProblems([]);
    onChange((list) => list.filter((f) => f.url !== url));
  };

  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby={`${fieldId}-label`}>
      <div className="flex flex-col gap-0.5">
        <span id={`${fieldId}-label`} className="text-sm font-semibold text-muted">
          {label}
        </span>
        <span id={`${fieldId}-hint`} className="text-xs text-subtle">
          {fileHint(kinds, max)}
        </span>
      </div>

      {used > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((file) => (
            <li
              key={file.url}
              className="flex min-w-0 items-center gap-2.5 rounded-xl border border-brand-green/30 bg-brand-green/5 px-3 py-2 text-sm"
            >
              <span aria-hidden className="shrink-0">
                {iconOf(file.url)}
              </span>
              <span className="flex min-w-0 flex-1 text-fg">
                <FileName name={file.name} />
              </span>
              <button
                type="button"
                onClick={() => remove(file.url)}
                aria-label={`Прибрати файл ${file.name}`}
                className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/10 hover:text-fg"
              >
                <CloseIcon className="size-4" />
              </button>
            </li>
          ))}
          {uploads.map((upload) => {
            const percent = Math.round(upload.progress * 100);
            return (
              <li
                key={upload.id}
                className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden className="shrink-0">
                    {iconOf(upload.name)}
                  </span>
                  <span className="flex min-w-0 flex-1 text-fg">
                    <FileName name={upload.name} />
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-subtle">
                    {percent >= 100 ? 'Обробка…' : `${percent}% · ${formatSize(upload.size)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => cancel(upload)}
                    aria-label={`Скасувати завантаження ${upload.name}`}
                    className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/10 hover:text-fg"
                  >
                    <CloseIcon className="size-4" />
                  </button>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label={`Завантаження ${upload.name}`}
                  className="h-1 w-full overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-full rounded-full bg-brand-cyan transition-[width] duration-200"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {free > 0 && (
        <label
          className={cn(
            'flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3.5 text-center text-sm font-semibold text-fg transition-colors hover:border-brand-cyan focus-within:border-brand-cyan',
            errors.length ? 'border-brand-red/70' : 'border-border',
          )}
        >
          <input
            type="file"
            accept={fileAccept(kinds)}
            multiple={max > 1}
            onChange={pick}
            aria-labelledby={`${fieldId}-label`}
            aria-describedby={`${fieldId}-hint`}
            aria-invalid={errors.length ? true : undefined}
            className="sr-only"
          />
          <span aria-hidden>📎</span>
          <span>
            {used === 0
              ? max > 1
                ? 'Додати файли'
                : 'Додати файл'
              : free === 1
                ? 'Додати ще один файл'
                : `Додати ще (до ${free})`}
          </span>
        </label>
      )}

      {errors.length > 0 && (
        <div className="flex flex-col gap-1" aria-live="polite">
          {errors.map((text, i) => (
            <span key={i} className="break-words text-xs font-medium text-brand-red">
              {text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
