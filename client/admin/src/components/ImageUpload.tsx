'use client';

import { useState } from 'react';
import { api, mediaUrl } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import { isVideo } from '@/lib/utils';
import { Spinner } from './ui/Spinner';

function Preview({ src, className }: { src: string; className: string }) {
  return isVideo(src) ? (
    <video src={src} muted loop autoPlay playsInline className={className} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} />
  );
}

export function ImageUpload({
  value,
  onChange,
  label = 'Зображення',
  aspect,
  hint,
  accept = 'image/*',
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  aspect?: string;
  hint?: string;
  accept?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Mirrors the server: videos and GIFs up to 50 MB, other files up to 5 MB.
    const limitMb = /^(video\/|image\/gif)/.test(file.type) ? 50 : 5;
    if (file.size > limitMb * 1024 * 1024) {
      setError(`Файл завеликий: максимум ${limitMb} МБ`);
      e.target.value = '';
      return;
    }
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
          <Preview
            src={preview}
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
          <Preview src={preview} className="max-h-52 w-full object-cover" />
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
            accept={accept}
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
