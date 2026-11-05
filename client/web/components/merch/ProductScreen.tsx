'use client';
/* eslint-disable @next/next/no-img-element -- /_next/image does not resize on production, so merch serves its own thumbnails */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Lightbox } from '@/components/ui/Lightbox';
import { ApiError } from '@/lib/api';
import { priceText, rememberCatalog } from '@/lib/merch';
import { addLine } from '@/lib/merch-cart';
import type { CatalogItem, ProductVariant, ProductView } from '@/lib/merch-types';
import { absoluteUrl } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { flyToCart } from './CartSheet';
import { useSurface } from './surface';
import {
  ACTION_CLASS,
  CHIP_TONE,
  CONTROL,
  Chip,
  Empty,
  PANEL_CLASS,
  PageBack,
  Photo,
  SECONDARY_CLASS,
  Spinner,
  Stepper,
  Zoomable,
} from './ui';

const ID = /^[1-9]\d{0,8}$/;
const MAX_QTY = 99;

const TITLE = 'text-2xl font-black leading-tight sm:text-3xl';
const STEP_LABEL = 'text-xs font-black uppercase tracking-wider text-muted';

const isAvailable = (v: ProductVariant) => v.stock === null || v.stock > 0;

/** In size order, because the server sends variants in matrix order. */
const variantsIn = (product: ProductView, color: string) =>
  product.variants.filter((v) => !product.colors.length || v.color === color);

const firstSize = (variants: ProductVariant[]) =>
  (variants.find(isAvailable) ?? variants[0])?.size ?? '';

const photoFor = (product: ProductView, color: string) =>
  product.photos.find((p) => p.color === color) ??
  product.photos.find((p) => p.color === '') ??
  product.photos[0];

/** One column in Telegram and on phones; photo left and buy card right from lg on the web. */
function useLayout() {
  const { kind } = useSurface();
  return cn(
    'grid grid-cols-1 items-start gap-4',
    kind === 'web' && 'lg:grid-cols-[1fr_380px] lg:gap-8',
  );
}

export function ProductScreen({ id, initial }: { id: string; initial: ProductView | null }) {
  const { api, kind, ready, signedIn } = useSurface();
  const [product, setProduct] = useState(initial);
  const [failure, setFailure] = useState<'missing' | 'failed' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [listed] = useState(
    () => rememberCatalog()?.products.find((p) => String(p.id) === id) ?? null,
  );
  // The server's answer stands for an anonymous visitor of the public tree.
  const asks = ID.test(id) && (kind === 'tg' || signedIn);

  useEffect(() => {
    if (!ready || !asks) return;
    let live = true;
    api.product(id).then(
      (fresh) => {
        if (live) setProduct(fresh);
      },
      (err: unknown) => {
        if (live) setFailure(err instanceof ApiError && err.status < 500 ? 'missing' : 'failed');
      },
    );
    return () => {
      live = false;
    };
  }, [api, asks, attempt, id, ready]);

  const retry = () => {
    setFailure(null);
    setAttempt((n) => n + 1);
  };

  return (
    <div className="space-y-4">
      <PageBack label="Каталог" tgLabel="Назад до каталогу" />
      {product?.archived ? (
        <Archived product={product} />
      ) : product ? (
        <Product key={product.id} product={product} />
      ) : failure === 'failed' ? (
        <Empty
          icon="⚠️"
          title="Не вдалося завантажити товар"
          action={
            <button type="button" onClick={retry} className={SECONDARY_CLASS}>
              Спробувати ще раз
            </button>
          }
        />
      ) : failure === 'missing' || !asks ? (
        <NotFound id={id} />
      ) : listed ? (
        <Listed item={listed} />
      ) : (
        <Spinner />
      )}
    </div>
  );
}

/** The list data shows at once, so a tap on a card never lands on an empty screen. */
function Listed({ item }: { item: CatalogItem }) {
  return (
    <div className={useLayout()}>
      <Photo
        thumb={item.thumbUrl}
        alt={item.title}
        className="rounded-3xl border border-border"
      />
      <div className={cn(PANEL_CLASS, 'space-y-3')}>
        <h1 className={TITLE}>{item.title}</h1>
        <p className="text-xl font-black tabular-nums text-brand-green">
          від {priceText(item.minPrice)} грн
        </p>
        <div aria-hidden className="h-28 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    </div>
  );
}

function Archived({ product }: { product: ProductView }) {
  const { base } = useSurface();
  const photo = photoFor(product, product.defaultColor);
  return (
    <div className={useLayout()}>
      <Photo
        thumb={photo?.thumbUrl ?? null}
        full={photo?.url}
        alt={product.title}
        className="rounded-3xl border border-border opacity-60"
      />
      <div className={cn(PANEL_CLASS, 'space-y-3')}>
        <h1 className={TITLE}>{product.title}</h1>
        <p className="text-base leading-relaxed text-muted">Цей товар зараз недоступний</p>
        <Link href={base} className={cn(SECONDARY_CLASS, 'w-full')}>
          До каталогу
        </Link>
      </div>
    </div>
  );
}

function NotFound({ id }: { id: string }) {
  const { api, base, kind } = useSurface();
  const web = kind === 'web';
  const [bot, setBot] = useState(() => rememberCatalog()?.botUsername ?? null);

  useEffect(() => {
    if (!web || rememberCatalog()) return;
    let live = true;
    api.catalog().then(
      (catalog) => {
        if (live) setBot(catalog.botUsername);
      },
      () => {}, // the link is a bonus on this screen
    );
    return () => {
      live = false;
    };
  }, [api, web]);

  return (
    <Empty
      icon="🔍"
      title="Товар не знайдено"
      action={
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link href={base} className={SECONDARY_CLASS}>
            До каталогу
          </Link>
          {web && bot && ID.test(id) && (
            <a
              href={`https://t.me/${bot}?start=item_${id}`}
              target="_blank"
              rel="noreferrer"
              className={SECONDARY_CLASS}
            >
              Відкрити в боті
            </a>
          )}
        </div>
      }
    />
  );
}

function Product({ product }: { product: ProductView }) {
  const { kind, share, tg, toast } = useSurface();
  const web = kind === 'web';
  const layout = useLayout();
  const [color, setColor] = useState(product.defaultColor);
  const [size, setSize] = useState(() => firstSize(variantsIn(product, product.defaultColor)));
  const [quantity, setQuantity] = useState(1);
  const [zoomed, setZoomed] = useState(false);
  const closeZoom = useCallback(() => setZoomed(false), []);
  // The last add, for the button's moment of success; `at` replays its animation on a quick second tap.
  const [added, setAdded] = useState<{ n: number; at: number } | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const buyButton = useRef<HTMLButtonElement>(null);
  useEffect(() => () => clearTimeout(addedTimer.current), []);
  const [category] = useState(
    () => rememberCatalog()?.categories.find((c) => c.id === product.categoryId)?.name,
  );

  useEffect(() => {
    product.photos.forEach((p) => {
      new Image().src = p.thumbUrl; // so the first colour switch is instant
    });
  }, [product.photos]);

  const choices = variantsIn(product, color);
  const variant = product.sizes.length ? choices.find((v) => v.size === size) : choices[0];
  const limit = variant ? Math.min(variant.stock ?? MAX_QTY, MAX_QTY) : 0;
  const count = Math.max(1, Math.min(quantity, limit)); // derived: holds through option changes and a stock refresh
  const photo = photoFor(product, color);
  const sum = variant
    ? priceText(((Math.round(Number(variant.price) * 100) * count) / 100).toFixed(2))
    : '';

  const pickColor = (next: string) => {
    const inColor = variantsIn(product, next);
    setColor(next);
    if (!inColor.some((v) => v.size === size && isAvailable(v))) setSize(firstSize(inColor));
  };

  const add = () => {
    if (!variant) return;
    const options = [product.sizes.length ? variant.size : product.fixedSize, variant.color]
      .filter(Boolean)
      .join(' — ');
    const added = addLine(
      {
        variantId: variant.id,
        quantity: count,
        label: options ? `${product.title} (${options})` : product.title,
      },
      limit,
    );
    if (added < count) toast('Більше немає в наявності');
    if (!added) {
      tg?.hapticNotify('error');
      return;
    }
    tg?.hapticNotify('success');
    setAdded((last) => ({ n: added, at: (last?.at ?? 0) + 1 }));
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(null), 1800);
    flyToCart(buyButton.current, photo?.thumbUrl);
  };

  const frame = web ? 'rounded-3xl border-border' : 'rounded-2xl border-white/10';
  const picture = photo ? (
    <button
      type="button"
      onClick={() => setZoomed(true)}
      aria-label="Збільшити фото"
      className={cn('group relative block w-full cursor-zoom-in overflow-hidden border', frame, CONTROL)}
    >
      <Photo thumb={photo.thumbUrl} full={photo.url} alt={product.title} />
      <span
        aria-hidden
        className="absolute bottom-3 right-3 flex size-[40px] items-center justify-center rounded-full border border-white/15 bg-black/70 text-white transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
      >
        <ZoomIcon />
      </span>
    </button>
  ) : (
    <Photo thumb={null} alt={product.title} className={cn('border', frame)} />
  );

  const colorStep = product.colors.length > 0 && (
    <div className="space-y-2.5">
      <p className={STEP_LABEL}>Оберіть колір</p>
      <div className="flex flex-wrap gap-2">
        {product.colors.map((c) => {
          const swatch = product.photos.find((p) => p.color === c)?.thumbUrl;
          return (
            <Chip
              key={c}
              kind="option"
              active={c === color}
              disabled={!variantsIn(product, c).some(isAvailable)}
              onClick={() => pickColor(c)}
            >
              <span className="flex items-center gap-2">
                {swatch && (
                  <img
                    src={swatch}
                    alt=""
                    decoding="async"
                    className="-my-1 -ml-2 size-[24px] rounded-full object-cover"
                  />
                )}
                {c}
              </span>
            </Chip>
          );
        })}
      </div>
    </div>
  );

  const sizeStep = product.sizes.length > 0 && (
    <div className="space-y-2.5">
      <p className={STEP_LABEL}>Оберіть розмір</p>
      <div className="grid grid-cols-3 gap-2">
        {choices.map((v) => {
          const on = v.size === size;
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={on}
              disabled={!isAvailable(v)}
              onClick={() => {
                tg?.haptic('light');
                setSize(v.size);
              }}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 text-center transition-all duration-200 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
                CONTROL,
                CHIP_TONE.option[on ? 'on' : 'off'],
              )}
            >
              <span className="text-base font-black leading-tight">{v.size}</span>
              <span className="text-[13px] font-bold tabular-nums">{priceText(v.price)} грн</span>
              {v.stock !== null && (
                <span className="text-[11px] font-medium leading-tight">
                  {v.stock > 0 ? `${v.stock} шт` : 'Немає в наявності'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const fixedSize = product.fixedSize && (
    <p className={cn('font-bold text-muted', web ? 'text-base' : 'text-sm')}>
      Розмір: {product.fixedSize}
    </p>
  );

  const stockLine = variant && variant.stock !== null && (
    <p className="text-sm font-semibold text-muted">
      {variant.stock > 0 ? `🔥 В наявності: ${variant.stock} шт.` : '❌ Немає в наявності'}
    </p>
  );

  const buy = (
    <>
      {/* Nothing to count when the chosen option is sold out. */}
      {limit > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className={STEP_LABEL}>Кількість</span>
          <Stepper value={count} min={1} max={limit} onChange={setQuantity} />
        </div>
      )}
      <Button
        ref={buyButton}
        className={cn(ACTION_CLASS, added && '[background-image:none] bg-brand-green hover:scale-100')}
        disabled={limit === 0}
        onClick={add}
      >
        {added ? (
          <span key={added.at} className="inline-flex items-center gap-2 motion-safe:animate-[su-pop_0.45s_ease-out]">
            <svg width="22" height="22" viewBox="0 0 52 52" fill="none" aria-hidden>
              <path
                d="M14 27 L23 36 L39 18"
                stroke="currentColor"
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={60}
                className="[stroke-dashoffset:0] motion-safe:[stroke-dashoffset:60] motion-safe:animate-[su-draw_0.35s_cubic-bezier(0.65,0,0.45,1)_0.12s_forwards]"
              />
            </svg>
            {added.n > 1 ? `Додано в кошик · ${added.n} шт` : 'Додано в кошик'}
          </span>
        ) : count > 1 ? (
          <span>
            Додати до кошика ·{' '}
            <span className="whitespace-nowrap">
              {count} шт · {sum} грн
            </span>
          </span>
        ) : (
          'Додати до кошика'
        )}
      </Button>
      <span role="status" className="sr-only">
        {added ? `Додано в кошик: ${added.n} шт` : ''}
      </span>
    </>
  );

  const shareButton = (
    <button
      type="button"
      onClick={() => share(absoluteUrl(`/merch/${product.id}`), product.title)}
      className={cn(SECONDARY_CLASS, 'flex-1 whitespace-nowrap')}
    >
      <ShareIcon />
      Поділитися
    </button>
  );

  const zoom = zoomed && photo && (
    <Lightbox onClose={closeZoom}>
      <Zoomable src={photo.url} thumb={photo.thumbUrl} alt={product.title} />
    </Lightbox>
  );

  if (!web) {
    // The events Mini App's detail: one card about the thing, one card to act on it.
    const price = variant
      ? `${priceText(variant.price)} грн`
      : product.minPrice && `від ${priceText(product.minPrice)} грн`;
    return (
      <>
        <div className="space-y-3.5 rounded-3xl border border-border bg-surface p-4">
          {picture}
          <div>
            <h1 className="text-xl font-black leading-snug [overflow-wrap:anywhere]">{product.title}</h1>
            {category && <p className="mt-1.5 text-sm font-semibold text-brand-cyan">{category}</p>}
          </div>
          {product.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">
              {product.description}
            </p>
          )}
          {price && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-purple/30 bg-brand-purple/10 p-3.5 text-sm">
              <span className="text-muted">Ціна:</span>
              <span className="text-base font-black tabular-nums text-brand-purple">{price}</span>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-3xl border border-border bg-surface p-4">
          <div className="border-b border-border pb-2.5">
            <h2 className="text-base font-black">Оберіть варіант</h2>
            <p className="mt-0.5 text-xs text-muted">
              {colorStep || sizeStep ? 'Колір, розмір і кількість' : 'Скільки штук додати в кошик'}
            </p>
          </div>
          {colorStep}
          {sizeStep}
          {fixedSize}
          {stockLine}
          {buy}
        </div>

        <div className="flex">{shareButton}</div>
        {zoom}
      </>
    );
  }

  return (
    <>
      <div className={layout}>
        <div className="min-w-0">{picture}</div>

        <aside className={cn(PANEL_CLASS, 'flex min-w-0 flex-col gap-5 lg:sticky lg:top-24 lg:p-6')}>
          <div className="space-y-2.5">
            <h1 className={cn(TITLE, '[overflow-wrap:anywhere]')}>{product.title}</h1>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-muted [overflow-wrap:anywhere]">
              {product.description}
            </p>
          </div>

          {colorStep}
          {sizeStep}
          {fixedSize}

          {!product.sizes.length && variant && (
            <p
              className={cn(
                'text-3xl font-black tabular-nums',
                limit > 0 ? 'text-brand-green' : 'text-subtle',
              )}
            >
              {priceText(variant.price)} грн
            </p>
          )}

          {stockLine}
          {buy}

          <div className="flex flex-wrap gap-2">
            {shareButton}
            {product.botUsername && (
              <a
                href={`https://t.me/${product.botUsername}?start=item_${product.id}`}
                target="_blank"
                rel="noreferrer"
                className={cn(SECONDARY_CLASS, 'flex-1 whitespace-nowrap')}
              >
                Відкрити в боті
              </a>
            )}
          </div>
        </aside>
      </div>
      {zoom}
    </>
  );
}

function ZoomIcon() {
  return (
    <svg className="size-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v13"
      />
    </svg>
  );
}
