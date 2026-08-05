'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fice, type Fundraiser } from '@/lib/api';
import {
  cn,
  donateJarUrl,
  formatUAH,
  fundraiserPct,
  fundraiserTheme,
} from '@/lib/utils';

const PRESETS = [100, 200, 500, 1000];
const POLL_MS = 15_000;

export function DonateCard({ initial }: { initial: Fundraiser }) {
  const [data, setData] = useState<Fundraiser>(initial);
  const [preset, setPreset] = useState<number | null>(500);
  const [custom, setCustom] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = data.status === 'ACTIVE';
  const theme = fundraiserTheme(data.id);

  // Live refresh: poll the API while the tab is visible and the collection is open.
  useEffect(() => {
    if (!isActive) return;
    let stop = false;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const fresh = await fice.fundraiser(data.id);
        if (!stop) setData(fresh);
      } catch {
        /* keep last good data */
      }
    };
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [data.id, isActive]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const current = Number(data.currentAmount);
  const goal = Number(data.goalAmount);
  const pct = fundraiserPct(current, goal);

  const amount = useMemo(() => {
    const c = Number(custom.replace(/\s/g, ''));
    if (custom && Number.isFinite(c) && c > 0) return Math.round(c);
    return preset ?? 0;
  }, [custom, preset]);

  function pickPreset(v: number) {
    setPreset(v);
    setCustom('');
  }

  function copyCard() {
    const digits = (data.cardNumber ?? '').replace(/\s/g, '');
    if (!digits) return;
    navigator.clipboard?.writeText(digits).catch(() => {});
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  const donateHref = data.jarUrl ? donateJarUrl(data.jarUrl, amount) : null;

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-border bg-surface p-6 sm:p-7">
      <div className="flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cn(
              'bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl',
              theme.gradient,
            )}
          >
            {formatUAH(current)} ₴
          </span>
          <span className={cn('text-lg font-bold', theme.accentText)}>{pct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500',
              theme.gradient,
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-subtle">
          <span>
            з мети <span className="font-bold text-fg">{formatUAH(goal)} ₴</span>
          </span>
          <span>
            <span className="font-bold text-fg">
              {data.donationsCount.toLocaleString('uk-UA')}
            </span>{' '}
            {pluralDonations(data.donationsCount)}
          </span>
        </div>
      </div>

      {isActive ? (
        <>
          <div className="h-px bg-border" />

          <div className="flex flex-col gap-3">
            <span className="text-sm font-bold text-muted">Обери суму</span>
            <div className="grid grid-cols-2 gap-2.5">
              {PRESETS.map((v) => {
                const selected = !custom && preset === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => pickPreset(v)}
                    className={cn(
                      'rounded-xl py-3 text-base font-extrabold transition-colors',
                      selected
                        ? `${theme.gradient} text-black`
                        : cn(
                            'border border-border bg-surface-2 text-fg',
                            theme.borderHover,
                          ),
                    )}
                  >
                    {formatUAH(v)} ₴
                  </button>
                );
              })}
            </div>
            <label className="relative flex items-center">
              <input
                inputMode="numeric"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Інша сума"
                className={cn(
                  'w-full rounded-xl border bg-surface-2 px-4 py-3 pr-9 text-base font-bold text-fg outline-none transition-colors placeholder:font-medium placeholder:text-subtle',
                  custom ? theme.border : cn('border-border', theme.borderFocus),
                )}
              />
              <span className="pointer-events-none absolute right-4 text-base font-bold text-subtle">
                ₴
              </span>
            </label>
          </div>

          {donateHref ? (
            <a
              href={donateHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-extrabold text-black shadow-lg shadow-black/40 transition-opacity hover:opacity-90',
                theme.gradient,
                amount <= 0 && 'pointer-events-none opacity-50',
              )}
            >
              Задонатити{amount > 0 ? ` ${formatUAH(amount)} ₴` : ''}
            </a>
          ) : (
            <button
              type="button"
              onClick={copyCard}
              className={cn(
                'flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-extrabold text-black shadow-lg shadow-black/40 transition-opacity hover:opacity-90',
                theme.gradient,
              )}
            >
              Скопіювати реквізити
            </button>
          )}

          {data.cardNumber && (
            <>
              <div className="h-px bg-border" />
              <div className="flex flex-col gap-3">
                <span className="text-sm font-bold text-muted">Або переказом</span>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3.5">
                  <span className="text-lg font-bold tracking-wide tabular-nums">
                    {data.cardNumber}
                  </span>
                  <button
                    type="button"
                    onClick={copyCard}
                    className={cn(
                      'shrink-0 text-sm font-bold transition-colors',
                      copied ? 'text-brand-green' : theme.accentText,
                    )}
                  >
                    {copied ? 'Скопійовано ✓' : 'Копіювати'}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-center text-sm font-bold text-brand-green">
          Збір завершено. Дякуємо кожному, хто долучився! 💚
        </div>
      )}
    </div>
  );
}

function pluralDonations(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'донат';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'донати';
  return 'донатів';
}
