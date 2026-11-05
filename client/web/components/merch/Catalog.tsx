'use client';

import { Fragment, useEffect, useState } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { useSearchParams } from 'next/navigation';
import { priceText, rememberCatalog, rememberCatalogUrl } from '@/lib/merch';
import type { Catalog as CatalogData, CatalogItem, Label } from '@/lib/merch-types';
import { cn, plural } from '@/lib/utils';
import { useSurface } from './surface';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { Reveal, RevealEach } from '@/components/ui/Reveal';
import { CONTROL, Empty, Photo, SECONDARY_CLASS, Spinner } from './ui';

/** Ids from the URL, where anything can arrive. */
const idsOf = (raw: string | null): number[] =>
  (raw ?? '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

// ponytail: the whole catalog is one response filtered in the browser. Fine for a student shop;
// paginate the server read past a few hundred products.
export function Catalog({ initial }: { initial: CatalogData | null }) {
  const { api, base, kind, ready, signedIn, tg } = useSurface();
  // The URL is the filter: Back and plain links change it, and Next keeps this hook in step with replaceState.
  const params = useSearchParams();
  const cat = idsOf(params.get('cat'))[0] ?? null;
  // Back from a product, the remembered list may hold restricted products the server copy has not.
  const [catalog, setCatalog] = useState(
    () => (signedIn && rememberCatalog()) || initial || rememberCatalog(),
  );
  const [failed, setFailed] = useState(false);
  const hasServerCopy = !!initial;

  useEffect(() => {
    rememberCatalogUrl(`${location.pathname}${location.search}`);
  }, [params]);

  useEffect(() => {
    if (catalog) rememberCatalog(catalog);
  }, [catalog]);

  // Adds what only this viewer may see. Without a server copy it is also the second try.
  useEffect(() => {
    if (!ready || (!signedIn && hasServerCopy)) return;
    let live = true;
    api.catalog().then(
      (fresh) => {
        if (live) setCatalog(fresh);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [api, hasServerCopy, ready, signedIn]);

  if (!catalog) {
    if (kind === 'tg' && !failed) return <Spinner />;
    return (
      <Empty
        icon="⚠️"
        title="Не вдалося завантажити каталог"
        action={
          <button type="button" onClick={() => location.reload()} className={SECONDARY_CLASS}>
            Спробувати ще раз
          </button>
        }
      />
    );
  }

  // A chip the viewer cannot see filters nothing, so a shared URL never reads as an empty shop.
  const activeCat = catalog.categories.some((c) => c.id === cat) ? cat : null;
  const filtering = activeCat !== null;
  const products = catalog.products.filter((p) => activeCat === null || p.categoryId === activeCat);

  // Tags show on the cards only; an old ?tags= link is dropped with the next choice.
  const applyFilters = (nextCat: number | null) => {
    const next = new URLSearchParams(location.search);
    if (nextCat === null) next.delete('cat');
    else next.set('cat', String(nextCat));
    next.delete('tags');
    const search = next.toString();
    // The hash holds Telegram's init data.
    history.replaceState(null, '', `${location.pathname}${search && `?${search}`}${location.hash}`);
  };

  const web = kind === 'web';
  // The site's page rises in under its hero; the Mini App opens straight on the catalog.
  const Rise = web ? Reveal : Fragment;
  const Grid = web ? RevealEach : 'div';
  const pick = (nextCat: number | null) => {
    tg?.haptic('light');
    applyFilters(nextCat);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {!web && (
        <div className="flex items-center justify-between gap-3 px-1">
          <h1 className="text-base font-black uppercase tracking-wider text-muted">Каталог мерчу</h1>
          <span className="text-sm font-bold text-brand-cyan">
            {plural(products.length, ['товар', 'товари', 'товарів'])}
          </span>
        </div>
      )}

      {catalog.categories.length > 0 && (
        <Rise>
          <FilterTabs
            label="Категорія"
            center={web}
            options={[
              { value: null, label: 'Усі' },
              ...catalog.categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={activeCat}
            onChange={pick}
          />
        </Rise>
      )}

      {products.length > 0 ? (
        <Grid
          className={cn(
            'grid grid-cols-2',
            web ? 'gap-3 sm:gap-5 lg:grid-cols-3' : 'gap-2.5',
          )}
        >
          {products.map((item) =>
            web ? (
              <ProductCard key={item.id} item={item} tags={catalog.tags} href={`${base}/${item.id}`} />
            ) : (
              <AppCard
                key={item.id}
                item={item}
                category={catalog.categories.find((c) => c.id === item.categoryId)?.name}
                tags={catalog.tags.filter((t) => item.tagIds.includes(t.id)).map((t) => t.name)}
                href={`${base}/${item.id}`}
              />
            ),
          )}
        </Grid>
      ) : filtering ? (
        <Empty
          icon="🔍"
          title="Нічого не знайшли"
          text="Спробуй іншу категорію або зміни фільтри."
          action={
            <button type="button" onClick={() => applyFilters(null)} className={SECONDARY_CLASS}>
              Скинути фільтри
            </button>
          }
        />
      ) : (
        <Empty icon="🛍️" title="Каталог порожній" />
      )}
    </div>
  );
}

function ProductCard({ item, tags, href }: { item: CatalogItem; tags: Label[]; href: string }) {
  const { kind, tg } = useSurface();
  // Scoped: breakpoints read the viewport, and the Mini App column stays 448 px on a wide window.
  const web = kind === 'web';
  const badge = item.soldOut
    ? 'Немає в наявності'
    : tags.find((t) => item.tagIds.includes(t.id))?.name;
  return (
    <Link
      href={href}
      onClick={() => tg?.haptic('light')}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface/45 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-purple/60 hover:shadow-2xl hover:shadow-black/40 active:translate-y-0 active:scale-[0.98]',
        CONTROL,
      )}
    >
      <div className="relative">
        <Photo thumb={item.thumbUrl} alt={item.title} className={cn(item.soldOut && 'opacity-60')} />
        {badge && (
          <span
            className={cn(
              'absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[11px] font-extrabold',
              // Sentence case for the long one: in capitals it does not fit a 360 px card.
              !item.soldOut && 'uppercase tracking-wide',
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <div className={cn('flex flex-1 flex-col gap-2 p-3', web && 'sm:p-4')}>
        <h3
          className={cn(
            'line-clamp-2 text-base font-extrabold leading-snug',
            web && 'sm:text-lg lg:text-xl',
          )}
        >
          {item.title}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              web && 'sm:text-base',
              item.soldOut ? 'text-subtle' : 'text-brand-green',
            )}
          >
            від {priceText(item.minPrice)} грн
          </span>
          <OpenMark />
        </div>
      </div>
    </Link>
  );
}

/** The Mini App card: the events Mini App's card, with the price where an event shows its fee. */
function AppCard({
  item,
  category,
  tags,
  href,
}: {
  item: CatalogItem;
  category?: string;
  tags: string[];
  href: string;
}) {
  const { tg } = useSurface();
  return (
    <Link
      href={href}
      onClick={() => tg?.haptic('light')}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-surface p-3.5 transition-all hover:border-brand-cyan/60 active:scale-[0.99]',
        CONTROL,
      )}
    >
      <div>
        <div className="relative mb-3 overflow-hidden rounded-2xl border border-white/5">
          <Photo thumb={item.thumbUrl} alt={item.title} className={cn(item.soldOut && 'opacity-60')} />
          <span
            className={cn(
              'absolute right-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-border/80 bg-black/80 px-2.5 py-1 text-xs font-bold tabular-nums backdrop-blur-md',
              item.soldOut ? 'text-subtle' : 'text-brand-green',
            )}
          >
            {item.soldOut ? 'Немає в наявності' : `від ${priceText(item.minPrice)} грн`}
          </span>
        </div>
        <h3 className="line-clamp-2 text-sm font-black leading-snug text-fg transition-colors group-hover:text-brand-cyan">
          {item.title}
        </h3>
        {category && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-cyan">
            <MetaIcon d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            <span className="truncate">{category}</span>
          </p>
        )}
        {tags.length > 0 && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <MetaIcon d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            <span className="truncate">{tags.join(' · ')}</span>
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs font-bold text-fg group-hover:text-brand-cyan">
        <span>Деталі</span>
        <OpenArrow />
      </div>
    </Link>
  );
}

function MetaIcon({ d }: { d: string }) {
  return (
    <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

function OpenArrow() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span aria-hidden className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  ) : (
    <span aria-hidden>→</span>
  );
}

/** There is no loading boundary on these routes, so a tap on a slow network answers here. */
function OpenMark() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-brand-purple/15 text-sm font-black text-brand-purple transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white group-hover:[background-image:var(--gradient-purple)]"
    >
      {pending ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        '→'
      )}
    </span>
  );
}
