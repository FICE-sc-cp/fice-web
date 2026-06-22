'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fice, type Donation, type Fundraiser } from '@/lib/api';
import {
  cn,
  donateJarUrl,
  formatUAH,
  fundraiserPct,
  fundraiserTheme,
  relativeTimeUk,
} from '@/lib/utils';

const PRESETS = [100, 200, 500, 1000];
const POLL_MS = 15_000;

const DONOR_GRADIENTS = [
  'linear-gradient(135deg,#2eff97,#36dfff)',
  'linear-gradient(135deg,#f6339a,#9810fa)',
  'linear-gradient(135deg,#ff8904,#fb2c36)',
  'linear-gradient(135deg,#36dfff,#2b7fff)',
  'linear-gradient(135deg,#ad46ff,#f6339a)',
];

function donorInitial(name: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed[0].toUpperCase() : 'А';
}

function RecentDonors({
  donations,
  accentText,
}: {
  donations: Donation[];
  accentText: string;
}) {
  if (donations.length === 0) {
    return (
      <p className="text-sm text-subtle">
        Стань першим, хто підтримає цей збір 💚
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      {donations.map((d, i) => (
        <div key={d.id} className="flex items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-black"
            style={{ background: DONOR_GRADIENTS[i % DONOR_GRADIENTS.length] }}
          >
            {donorInitial(d.name)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-bold">
              {d.name?.trim() || 'Анонім'}
            </span>
            <span className="text-xs text-neutral-500">
              {relativeTimeUk(d.createdAt)}
            </span>
          </div>
          <span className={cn('shrink-0 text-base font-extrabold', accentText)}>
            {formatUAH(d.amount)} ₴
          </span>
        </div>
      ))}
    </div>
  );
}

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
  const donations = data.donations ?? [];

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
    <div className="flex flex-col gap-4">
      {/* donate card */}
      <div className="flex flex-col gap-6 rounded-3xl border border-border bg-surface p-6 sm:p-7">
        {/* progress */}
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
              з мети{' '}
              <span className="font-bold text-fg">{formatUAH(goal)} ₴</span>
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

            {/* amount picker */}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-bold text-muted">Оберіть суму</span>
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

            {/* donate button */}
            {donateHref ? (
              <a
                href={donateHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-extrabold text-black shadow-lg shadow-brand-red/20 transition-opacity hover:opacity-90',
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
                  'flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-extrabold text-black shadow-lg shadow-brand-red/20 transition-opacity hover:opacity-90',
                  theme.gradient,
                )}
              >
                Скопіювати реквізити
              </button>
            )}

            {/* requisites */}
            {data.cardNumber && (
              <>
                <div className="h-px bg-border" />
                <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-muted">
                    Або переказом
                  </span>
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

      {/* recent donors */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <span className="text-base font-extrabold">Останні донати</span>
          {isActive && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-brand-green">
              <span className="size-2 animate-pulse rounded-full bg-brand-green" />
              наживо
            </span>
          )}
        </div>
        <RecentDonors donations={donations} accentText={theme.accentText} />
      </div>
    </div>
  );
}

/** Ukrainian plural for "донат". */
function pluralDonations(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'донат';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'донати';
  return 'донатів';
}
