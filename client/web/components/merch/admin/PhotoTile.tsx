'use client';

import { useEffect, useRef, useState } from 'react';
import { preparePhoto } from '@/lib/merch-image';
import { cn } from '@/lib/utils';
import { Photo, errorText, useSurface } from '../ui';
import { ICONS, Icon } from './kit';

export interface TilePhoto {
  url: string;
  thumbUrl: string;
}

export type TileStatus = 'idle' | 'busy' | 'failed';

const RETRY = 'Не вдалося завантажити · Повторити';

export function PhotoTile({
  color,
  value,
  wide,
  onChange,
  onStatus,
}: {
  /** '' for a product without colours. */
  color: string;
  value: TilePhoto | null;
  /** The only tile of a product: a banner rather than a square. */
  wide?: boolean;
  onChange(photo: TilePhoto | null): void;
  /** The save button waits for a busy tile and stays off for a failed one. */
  onStatus(status: TileStatus): void;
}) {
  const { api, tg } = useSurface();
  const label = color ? `Фото (${color})` : 'Фото товару';
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Stays until sent, so a retry needs no second trip to the gallery.
  const prepared = useRef<{ full: Blob; thumb: Blob } | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  // A colour taken away and put back is a new tile: the old one's failure must not block the save.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, and onStatus is a new closure on every render
  useEffect(() => onStatus('idle'), []);

  const upload = async (file?: File) => {
    setBusy(true);
    setProblem(null);
    onStatus('busy');
    try {
      if (file) {
        prepared.current = null;
        prepared.current = await preparePhoto(file);
        setPreview(URL.createObjectURL(prepared.current.thumb));
      }
      const { full, thumb } = prepared.current!;
      const [fullFile, thumbFile] = await Promise.all([
        api.admin.upload(full),
        api.admin.upload(thumb),
      ]);
      onChange({ url: fullFile.url, thumbUrl: thumbFile.url });
      prepared.current = null;
      onStatus('idle');
      tg?.haptic('light');
    } catch (err) {
      // Without blobs the file itself failed, such as HEIC: only another pick can help.
      setProblem(prepared.current ? RETRY : errorText(err, RETRY));
      onStatus('failed');
      tg?.hapticNotify('error');
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    prepared.current = null;
    setPreview(null);
    setProblem(null);
    onStatus('idle');
    if (!problem) onChange(null); // after a failed replace the X drops the attempt, not the saved photo
  };

  const shown = preview ?? value?.thumbUrl ?? null;
  const shape = wide ? 'aspect-[2/1]' : 'aspect-square';

  const picker = (
    <input
      type="file"
      accept="image/*"
      disabled={busy}
      className="sr-only"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // the same file can be picked again
        if (file) void upload(file);
      }}
    />
  );

  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      {color && <p className="mb-1.5 truncate px-1 text-sm font-semibold text-muted">{label}</p>}
      <div className={cn('relative overflow-hidden rounded-2xl', shape)}>
        {shown ? (
          <>
            <Photo
              thumb={shown}
              alt={label}
              className={cn('size-full transition-opacity', shape, busy && 'opacity-50')}
            />
            {busy ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <span
                  role="status"
                  aria-label="Завантаження"
                  className="size-8 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent"
                />
              </span>
            ) : (
              !problem && (
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/85 to-transparent p-1.5 pt-8">
                  <label className="flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-sm font-extrabold transition-all focus-within:ring-2 focus-within:ring-brand-cyan active:scale-95">
                    {picker}
                    Замінити
                  </label>
                  <button
                    type="button"
                    aria-label={`Прибрати: ${label}`}
                    onClick={clear}
                    className="flex size-11 items-center justify-center rounded-xl transition-all active:scale-90"
                  >
                    <Icon d={ICONS.close} />
                  </button>
                </div>
              )
            )}
          </>
        ) : (
          !problem && (
            <label className="flex size-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface/60 text-center text-sm font-bold text-muted transition-all hover:border-brand-purple/60 hover:text-fg focus-within:border-brand-cyan active:scale-[0.98]">
              {picker}
              {busy ? (
                <span
                  role="status"
                  aria-label="Завантаження"
                  className="size-8 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent"
                />
              ) : (
                <>
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-purple/15 text-brand-purple">
                    <Icon d={ICONS.upload} />
                  </span>
                  Додати фото
                </>
              )}
            </label>
          )
        )}

        {problem &&
          (problem === RETRY ? (
            <button
              type="button"
              onClick={() => void upload()}
              className="absolute inset-0 flex items-center justify-center rounded-2xl border border-brand-red/50 bg-black/85 p-4 pt-10 text-center text-sm font-bold leading-relaxed text-brand-red transition-all active:scale-[0.98]"
            >
              {problem}
            </button>
          ) : (
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center overflow-y-auto rounded-2xl border border-brand-red/50 bg-black/85 p-3 pt-10 text-center text-xs font-bold leading-relaxed text-brand-red">
              {picker}
              {problem}
            </label>
          ))}

        {problem && (
          <button
            type="button"
            aria-label={`Прибрати: ${label}`}
            onClick={clear}
            className="absolute right-0.5 top-0.5 flex size-11 items-center justify-center rounded-xl text-fg transition-all active:scale-90"
          >
            <Icon d={ICONS.close} />
          </button>
        )}
      </div>
    </div>
  );
}
