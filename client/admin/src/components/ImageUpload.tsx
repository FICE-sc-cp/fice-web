'use client';

import { useState } from 'react';
import { api, mediaUrl } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import { Spinner } from './ui/Spinner';

export function ImageUpload({
  value,
  onChange,
  label = 'Зображення',
  aspect,
  hint,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  aspect?: string;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await api.upload(file);
      onChange(res.url);
      haptic();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const preview = mediaUrl(value);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {hint && <span className="text-xs text-subtle">{hint}</span>}
      {preview && aspect ? (
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-bg-soft"
          style={{ aspectRatio: aspect }}
        >
          <img
            src={preview}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-lg bg-black/60 px-3 py-1 text-xs font-medium text-white"
          >
            Прибрати
          </button>
        </div>
      ) : preview ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-52 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-lg bg-black/60 px-3 py-1 text-xs font-medium text-white"
          >
            Прибрати
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-bg-soft py-8 text-sm text-subtle transition-colors hover:border-brand-cyan">
          {uploading ? <Spinner /> : <span>Натисни, щоб завантажити</span>}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
        </label>
      )}
      {error && <span className="text-xs text-brand-red">{error}</span>}
    </div>
  );
}
