'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { priceText } from '@/lib/merch';
import {
  cartCount,
  clearCart,
  readCart,
  removeLine,
  setQuantity,
  useCart,
  type StoredLine,
} from '@/lib/merch-cart';
import type { CartLineView, CartPreview, LineStatus } from '@/lib/merch-types';
import { cn, plural } from '@/lib/utils';
import { ACTION_CLASS, Banner, CONTROL, Photo, SECONDARY_CLASS, Stepper, useSurface } from './ui';

const PROBLEM_TEXT: Partial<Record<LineStatus, (max: number) => string>> = {
  short: (max) => `Залишилось ${max} шт`,
  soldout: () => 'Немає в наявності',
  archived: () => 'Товар недоступний',
  gone: () => 'Товар недоступний',
};

const BAG = 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z';
const TRASH =
  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';
const CLOSE = 'M6 18L18 6M6 6l12 12';

const items = (n: number) => plural(n, ['товар', 'товари', 'товарів']);

/** The last preview's prices and limits on the current quantities, because a tap sends no request. */
function viewRow(line: StoredLine, view: CartLineView | undefined) {
  if (!view) return { line, view, status: null, kopecks: 0 };
  if (view.status !== 'ok' && view.status !== 'short') {
    return { line, view, status: view.status, kopecks: 0 };
  }
  const paid = Math.min(line.quantity, view.maxQuantity);
  const status: LineStatus = line.quantity > view.maxQuantity ? 'short' : 'ok';
  return { line, view, status, kopecks: Math.round(Number(view.unitPrice) * 100) * paid };
}

const money = (kopecks: number) => priceText((kopecks / 100).toFixed(2));

/**
 * A copy of the product photo flies from the add button into the cart bar's bag. Runs after the
 * next paint, because the bar appears in the same update on the first add.
 */
export function flyToCart(from: HTMLElement | null, thumb: string | undefined) {
  if (!from || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('[data-cart-target]');
      if (!target) return;
      const a = from.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const size = 64;
      const dot = document.createElement('div');
      dot.setAttribute('aria-hidden', 'true');
      dot.className =
        'pointer-events-none fixed z-[60] rounded-2xl border-2 border-white/80 bg-surface-2 bg-cover bg-center shadow-[0_12px_32px_rgba(0,0,0,0.6)]';
      Object.assign(dot.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${a.left + a.width / 2 - size / 2}px`,
        top: `${a.top + a.height / 2 - size / 2}px`,
        backgroundImage: thumb ? `url("${thumb}")` : 'var(--gradient-main)',
      });
      document.body.appendChild(dot);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const lift = Math.min(160, Math.abs(dy) / 2 + 60);
      dot
        .animate(
          [
            { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
            { transform: 'translate(0, -24px) scale(1)', opacity: 1, offset: 0.18 },
            { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - lift}px) scale(0.75)`, offset: 0.6 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0.4 },
          ],
          { duration: 700, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
        )
        .finished.finally(() => dot.remove());
    }),
  );
}

/** Pages that already show the cart's content or have nothing to buy. */
const quiet = (path: string, base: string) =>
  ['/checkout', '/admin', '/pickup'].some((p) => path.startsWith(base + p));

/**
 * The way into the cart, shown only while it holds something: a bar over the bottom of a phone
 * and of the Mini App, a pill in the corner of a wide screen.
 */
export function CartBar() {
  const { base, kind, ready, cartOpen, openCart } = useSurface();
  const count = cartCount(useCart());
  const path = usePathname();
  if (!ready || !count || quiet(path, base)) return null;
  const tg = kind === 'tg';

  return (
    <>
      {/* Room at the end of the page, so the bar never covers the last row or the footer. */}
      <div aria-hidden className={tg ? 'h-20' : 'h-24 sm:hidden'} />
      <button
        type="button"
        onClick={openCart}
        aria-haspopup="dialog"
        aria-label={`Кошик: ${items(count)}`}
        className={cn(
          'fixed z-40 flex items-center gap-3 rounded-2xl bg-gradient-main px-4 py-3 text-stone-950 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.85)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] motion-safe:animate-[su-rise_0.3s_cubic-bezier(0.22,0.7,0.2,1)]',
          CONTROL,
          tg
            ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 w-[calc(100%-2rem)] max-w-[26rem] -translate-x-1/2'
            : 'inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:rounded-full sm:py-3 sm:pl-4 sm:pr-5',
          cartOpen && 'invisible',
        )}
      >
        {/* Keyed by the count: the bag jumps when the flying photo lands in it. */}
        <span
          key={count}
          data-cart-target
          className="relative motion-safe:animate-[merch-bump_0.5s_ease-out_0.55s_both]"
        >
          <Icon d={BAG} className="size-[24px]" />
          <span
            key={count}
            className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-stone-950 px-1 text-[11px] font-black leading-none text-white motion-safe:animate-[su-pop_0.4s_ease-out]"
          >
            {count > 99 ? '99+' : count}
          </span>
        </span>
        <span className="text-[15px] font-extrabold">Кошик</span>
        <span className="ml-auto pl-3 text-[13px] font-bold opacity-75 sm:ml-1">{items(count)}</span>
        <span aria-hidden className="text-lg font-black leading-none">
          →
        </span>
      </button>
    </>
  );
}

/** The cart over the current page: a bottom sheet on phones and in Telegram, a side drawer on wide web. */
export function CartSheet() {
  const { api, base, kind, cartOpen, closeCart, toast } = useSurface();
  const router = useRouter();
  const lines = useCart();
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<CartPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ids = lines
    .map((l) => l.variantId)
    .sort((a, b) => a - b)
    .join(',');

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (cartOpen && !el.open) el.showModal();
    if (!cartOpen && el.open) el.close();
  }, [cartOpen]);

  // The last line removed: nothing left to show, the bar is gone too.
  useEffect(() => {
    if (cartOpen && !lines.length) closeCart();
  }, [cartOpen, closeCart, lines.length]);

  // ponytail: quantities are not re-checked per tap, only the set of ids is. Stock sold while the
  // sheet is open shows at checkout entry, which is the check that counts.
  useEffect(() => {
    if (!cartOpen || !ids) return;
    let live = true;
    api.preview(readCart()).then(
      (next) => {
        if (!live) return;
        setPreview(next);
        setFailed(false);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [api, attempt, cartOpen, ids]);

  const rows = lines.map((line) =>
    viewRow(line, preview?.lines.find((l) => l.variantId === line.variantId)),
  );
  const total = rows.reduce((sum, row) => sum + row.kopecks, 0);
  const loading = !preview && !failed;
  const drawer = kind === 'web';

  const checkout = () => {
    closeCart();
    router.push(`${base}/checkout`);
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Кошик"
      data-scroll-lock
      onClose={closeCart}
      // A tap on the backdrop lands on the dialog itself; the panel takes every other tap.
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCart();
      }}
      className={cn(
        'mx-auto mb-0 mt-auto max-h-none w-full max-w-md bg-transparent text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm open:motion-safe:animate-[su-rise_0.28s_cubic-bezier(0.22,0.7,0.2,1)]',
        drawer &&
          'sm:my-0 sm:ml-auto sm:mr-0 sm:h-dvh sm:max-w-[26.5rem] sm:open:motion-safe:animate-[merch-drawer-in_0.3s_cubic-bezier(0.22,0.7,0.2,1)]',
      )}
    >
      <div
        className={cn(
          'flex max-h-[85dvh] flex-col rounded-t-3xl border border-b-0 border-border bg-surface shadow-2xl shadow-black/60',
          drawer && 'sm:h-full sm:max-h-none sm:rounded-none sm:rounded-l-3xl sm:border-b sm:border-r-0',
        )}
      >
        <div className="flex items-center gap-2 border-b border-border/60 py-3 pl-5 pr-3">
          <h2 className="text-lg font-black">Кошик</h2>
          <span className="text-sm font-bold text-brand-cyan">{items(cartCount(lines))}</span>
          <button
            type="button"
            onClick={() => {
              clearCart();
              toast('Кошик очищено');
            }}
            className={cn(
              'ml-auto min-h-[40px] rounded-lg px-2 text-[13px] font-bold text-subtle transition-colors hover:text-brand-red',
              CONTROL,
            )}
          >
            Очистити
          </button>
          <button
            type="button"
            aria-label="Закрити"
            // showModal focuses the first control otherwise, and that is Очистити.
            autoFocus
            onClick={closeCart}
            className={cn(
              'flex size-[40px] items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-brand-cyan hover:text-brand-cyan',
              CONTROL,
            )}
          >
            <Icon d={CLOSE} className="size-[18px]" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain px-5">
          {rows.map((row) => (
            <Row key={row.line.variantId} {...row} loading={loading} onOpen={closeCart} />
          ))}
        </ul>

        <div className="space-y-3 border-t border-border/60 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {failed && (
            <Banner tone="error">
              <span className="flex items-center justify-between gap-3">
                Не вдалося оновити ціни
                <button
                  type="button"
                  onClick={() => {
                    setFailed(false);
                    setAttempt((n) => n + 1);
                  }}
                  className={cn(SECONDARY_CLASS, 'shrink-0 px-3 text-fg')}
                >
                  Спробувати ще раз
                </button>
              </span>
            </Banner>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-bold text-muted">Разом</span>
            {preview ? (
              <span className="text-gradient text-2xl font-black tabular-nums">{money(total)} грн</span>
            ) : failed ? (
              <span className="text-2xl font-black text-subtle">—</span>
            ) : (
              <span aria-hidden className="h-7 w-24 animate-pulse rounded-lg bg-surface-2" />
            )}
          </div>
          <Button className={ACTION_CLASS} disabled={failed} onClick={checkout}>
            Оформити замовлення
          </Button>
        </div>
      </div>
    </dialog>
  );
}

function Row({
  line,
  view,
  status,
  kopecks,
  loading,
  onOpen,
}: ReturnType<typeof viewRow> & { loading: boolean; onOpen(): void }) {
  const { base } = useSurface();
  const dead = status === 'soldout' || status === 'archived' || status === 'gone';
  const problem = status && PROBLEM_TEXT[status]?.(view?.maxQuantity ?? 0);
  const title = view?.title ?? line.label;
  const options = view?.options.replace(' — ', ' · ');

  return (
    <li className="flex gap-3.5 py-4">
      <Photo
        thumb={view?.thumbUrl ?? null}
        alt={title}
        className={cn('size-[76px] shrink-0 rounded-2xl border border-white/5', dead && 'opacity-50')}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {view?.productId ? (
              <Link
                href={`${base}/${view.productId}`}
                onClick={onOpen}
                className={cn(
                  'line-clamp-2 rounded text-[15px] font-extrabold leading-snug transition-colors hover:text-brand-cyan',
                  CONTROL,
                )}
              >
                {title}
              </Link>
            ) : (
              <p className="line-clamp-2 text-[15px] font-extrabold leading-snug">{title}</p>
            )}
            {options && <p className="mt-0.5 text-sm text-subtle">{options}</p>}
          </div>
          <button
            type="button"
            aria-label="Видалити"
            onClick={() => removeLine(line.variantId)}
            className={cn(
              '-mr-2 -mt-1.5 flex size-[36px] shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-brand-red/10 hover:text-brand-red',
              CONTROL,
            )}
          >
            <Icon d={TRASH} className="size-[18px]" />
          </button>
        </div>
        {problem && (
          <p className={cn('mt-1 text-sm font-bold', dead ? 'text-brand-red' : 'text-amber-300')}>
            {problem}
          </p>
        )}
        {!dead && (
          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <Stepper
              value={line.quantity}
              min={1}
              max={view?.maxQuantity ?? 99}
              removeAtMin
              onChange={(next) => setQuantity(line.variantId, next)}
            />
            {loading ? (
              <span aria-hidden className="h-5 w-16 animate-pulse rounded bg-surface-2" />
            ) : (
              view && <span className="text-base font-black tabular-nums">{money(kopecks)} грн</span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function Icon({ d, className }: { d: string; className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}
