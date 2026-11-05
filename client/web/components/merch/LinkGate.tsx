'use client';

import { useEffect, useState, type FocusEvent, type ReactNode } from 'react';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/lib/api';
import { LINK_KEY, readStore, writeStore } from '@/lib/merch-cart';
import type { LinkStart } from '@/lib/merch-types';
import { cn } from '@/lib/utils';
import { useSurface } from './surface';
import { Banner, CONTROL, FIELD_CLASS, PANEL_CLASS, SECONDARY_CLASS, Spinner, errorText } from './ui';

// ponytail: a 2 s poll per open gate, counted against the read limit. Push it over SSE if campus
// NAT ever hits that limit.
const POLL_MS = 2_000;

const TIMED_OUT = 'Час вийшов. Спробуйте ще раз.';

/** The pending link outlives the trip to Telegram, a reload and a killed browser. */
function savedLink(): LinkStart | null {
  try {
    const link = JSON.parse(readStore(LINK_KEY) ?? 'null') as LinkStart | null;
    const usable = typeof link?.token === 'string' && typeof link.botUrl === 'string';
    return usable && Date.parse(link.expiresAt) > Date.now() ? link : null;
  } catch {
    return null;
  }
}

/** The web Telegram step at checkout; in the Mini App the surface already knows the person. */
export function LinkGate({ children }: { children: ReactNode }) {
  const { kind, ready, signedIn } = useSurface();
  if (signedIn) return <>{children}</>;
  // In Telegram the surface either has an identity or sends the visitor to the web tree.
  if (!ready || kind === 'tg') return <Spinner />;
  return <BotStep />;
}

function BotStep() {
  const { api, signIn } = useSurface();
  const [link, setLink] = useState<LinkStart | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.resolve(savedLink() ?? api.startLink()).then(
      (next) => {
        if (!live) return;
        // Only the link on screen: a dropped effect's answer must not replace it in the store.
        writeStore(LINK_KEY, JSON.stringify(next));
        setLink(next);
      },
      (err: unknown) => {
        if (live) setProblem(errorText(err));
      },
    );
    return () => {
      live = false;
    };
  }, [api, attempt]);

  useEffect(() => {
    if (!link) return;
    let stopped = false;
    let inFlight = false;

    const poll = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true; // the session is issued once: an overlapping poll would answer 404 to the winner
      try {
        const res = await api.pollLink(link.token);
        if (res.linked) {
          // Even after leaving the page: this response is the only copy of the session.
          writeStore(LINK_KEY, null);
          signIn(res.session);
        }
      } catch (err) {
        if (!stopped && err instanceof ApiError && (err.status === 404 || err.status === 410)) {
          writeStore(LINK_KEY, null);
          setLink(null);
          setProblem(TIMED_OUT);
        }
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [api, link, signIn]);

  const retry = () => {
    setProblem(null);
    setAttempt((n) => n + 1);
  };

  return (
    <section className={cn(PANEL_CLASS, 'flex flex-col items-center gap-3 px-5 py-7 text-center')}>
      <span className="flex size-14 items-center justify-center rounded-2xl border border-[#229ED9]/40 bg-[#229ED9]/15 text-[#229ED9] shadow-[0_0_40px_-12px_#229ED9]">
        <PlaneIcon className="size-7" />
      </span>
      <h3 className="text-xl font-black leading-snug">{"Прив'яжіть Telegram"}</h3>
      <p className="max-w-sm text-base leading-relaxed text-muted">
        {"Бот надсилатиме статус замовлення, а збережені отримувачі підставлятимуться самі."}
      </p>

      {problem ? (
        <div className="mt-1 flex w-full flex-col gap-3">
          <Banner tone="error">{problem}</Banner>
          <button type="button" onClick={retry} className={SECONDARY_CLASS}>
            Спробувати ще раз
          </button>
        </div>
      ) : link ? (
        <>
          <a
            href={link.botUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#229ED9] py-3.5 text-base font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
              CONTROL,
            )}
          >
            <PlaneIcon className="size-5" />
            Відкрити бота у Telegram
          </a>
          <p className="text-sm leading-relaxed text-subtle">
            Натисніть «Розпочати», потім «Підтвердити». Ця сторінка оновиться сама.
          </p>
          <p className="inline-flex items-center gap-2 text-sm font-bold text-brand-cyan">
            <span aria-hidden className="live-dot size-2 rounded-full bg-brand-cyan" />
            Очікуємо підтвердження...
          </p>
        </>
      ) : (
        <div aria-hidden className="mt-1 h-[52px] w-full animate-pulse rounded-2xl bg-surface-2" />
      )}
    </section>
  );
}

function PlaneIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

// ---- Form pieces of the screens behind the gate -----------------------------------

/** Telegram's WebView does not scroll a focused input clear of the keyboard by itself. */
export function keepInView(e: FocusEvent<HTMLElement>) {
  const field = e.target;
  setTimeout(() => field.scrollIntoView({ block: 'center' }), 300);
}

export function DefaultBadge() {
  return (
    <span className="shrink-0 rounded-full border border-brand-purple/40 bg-brand-purple/10 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-purple">
      За замовч.
    </span>
  );
}

/** Goes inside an element with role="radiogroup". */
export function RadioCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect(): void;
  children: ReactNode;
}) {
  const { tg } = useSurface();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => {
        tg?.haptic('light');
        onSelect();
      }}
      className={cn(
        'flex min-h-[48px] w-full items-center gap-3 rounded-2xl border p-3.5 text-left text-base font-semibold transition-all duration-200 active:scale-[0.99]',
        CONTROL,
        selected
          ? 'border-brand-cyan bg-brand-cyan/10'
          : 'border-border bg-bg/50 hover:border-brand-cyan/50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-[20px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
          selected ? 'border-brand-cyan' : 'border-subtle/50',
        )}
      >
        <span
          className={cn(
            'size-[10px] rounded-full bg-brand-cyan transition-transform duration-200',
            selected ? 'scale-100' : 'scale-0',
          )}
        />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

export function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-[40px] cursor-pointer select-none items-center gap-3 text-base font-semibold text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-[20px] shrink-0 cursor-pointer rounded accent-brand-cyan"
      />
      <span>{children}</span>
    </label>
  );
}

export function RecipientFields({
  name,
  phone,
  onName,
  onPhone,
}: {
  name: string;
  phone: string;
  onName(next: string): void;
  onPhone(next: string): void;
}) {
  const { kind } = useSurface();
  const onFocus = kind === 'tg' ? keepInView : undefined;
  return (
    <>
      <Input
        label="ПІБ (По-батькові не обов’язково)"
        placeholder="Прізвище Ім'я"
        autoComplete="name"
        maxLength={255}
        value={name}
        onChange={(e) => onName(e.target.value)}
        onFocus={onFocus}
        className={FIELD_CLASS}
      />
      <Input
        label="Номер телефону"
        type="tel"
        placeholder="+380... або 0..."
        autoComplete="tel"
        maxLength={50}
        value={phone}
        onChange={(e) => onPhone(e.target.value)}
        onFocus={onFocus}
        className={FIELD_CLASS}
      />
    </>
  );
}
