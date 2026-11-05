'use client';

import { useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { AdminProduct, AdminState, AdminTemplate } from '@/lib/merch-types';
import { cn, plural } from '@/lib/utils';
import {
  ACTION_CLASS,
  Banner,
  CONTROL,
  Chip,
  Empty,
  Photo,
  SECONDARY_CLASS,
  useSurface,
} from '../ui';
import {
  Gate,
  ICONS,
  Icon,
  LIST_CLASS,
  MoveButtons,
  NO_SIZE,
  ROUND_BUTTON,
  SHEET_ROW,
  ScreenHead,
  Segmented,
  Sheet,
  TemplatePicker,
  colorsOf,
  colorsText,
  failText,
  lowestPrice,
  moved,
  sizesOf,
  useLatestOrder,
  useTwoTap,
  type Move,
} from './kit';
import { sending, useAdminState } from './useAdminState';

interface Filter {
  status: 'all' | 'active' | 'archive';
  category: number | null;
  tags: number[];
}

const NO_FILTER: Filter = { status: 'all', category: null, tags: [] };
const STATUS = [
  ['all', 'Усі'],
  ['active', 'Активні'],
  ['archive', 'Архів'],
] as const;

// Survive a trip to the editor: filters and the place in a long list.
let lastFilter = NO_FILTER;
let lastScroll = 0;
const rememberFilter = (filter: Filter) => (lastFilter = filter);

/** The visible rows take the places they already hold, so hidden rows stay: as the server's redistribute. */
function placeVisible(all: AdminProduct[], ids: number[]) {
  const rows = ids.flatMap((id) => all.filter((p) => p.id === id));
  const places = new Set(ids);
  return all.map((p) => (places.has(p.id) ? rows.shift()! : p));
}

/** "S–XXL · 2 кольори · від 500 грн" */
function firstLine(p: AdminProduct) {
  const sizes = sizesOf(p.variants).filter((s) => s !== NO_SIZE);
  const colors = colorsOf(p.variants).length;
  return [
    sizes.length > 3 ? `${sizes[0]}–${sizes.at(-1)}` : sizes.join(', '),
    colors > 0 && colorsText(colors),
    p.variants.length > 0 && `від ${lowestPrice(p.variants.map((v) => v.price))} грн`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Футболки · Куратори · 37 шт" */
function secondLine(p: AdminProduct, state: AdminState) {
  const unlimited = p.variants.some((v) => v.stock === null);
  const stock = p.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  return [
    state.categories.find((c) => c.id === p.categoryId)?.name,
    ...state.groups.filter((g) => p.groupIds.includes(g.id)).map((g) => g.name),
    unlimited ? 'Без обмежень' : `${stock} шт`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function AdminList() {
  const { state, error, refresh, patch } = useAdminState();
  if (!state) {
    return (
      <div className="space-y-4">
        <ScreenHead title="Управління товарами" />
        <Gate error={error} refresh={refresh} />
      </div>
    );
  }
  return <List state={state} error={error} refresh={refresh} patch={patch} />;
}

function List({
  state,
  error,
  refresh,
  patch,
}: {
  state: AdminState;
  error: string | null;
  refresh(): Promise<void>;
  patch(change: (s: AdminState) => AdminState): void;
}) {
  const { api, base, tg, toast } = useSurface();
  const router = useRouter();
  const [filter, setFilter] = useState(lastFilter);
  const [ordering, setOrdering] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const removal = useTwoTap();
  const open = state.products.find((p) => p.id === openId);

  // A layout effect: its cleanup runs before Next resets the scroll for the next route.
  useLayoutEffect(() => {
    window.scrollTo({ top: lastScroll, behavior: 'instant' });
    return () => {
      lastScroll = window.scrollY;
    };
  }, []);

  const changeFilter = (change: Partial<Filter>) => {
    setFilter(rememberFilter({ ...filter, ...change }));
  };

  const visible = state.products.filter(
    (p) =>
      (filter.status === 'all' || p.isActive === (filter.status === 'active')) &&
      (filter.category === null || p.categoryId === filter.category) &&
      (!filter.tags.length || p.tagIds.some((t) => filter.tags.includes(t))),
  );

  const reorder = useLatestOrder(
    (ids) => sending(api.admin.reorderProducts(ids)),
    (err) => {
      toast(failText(err));
      void refresh();
    },
  );

  const move = (id: number, direction: Move) => {
    tg?.haptic('light');
    const ids = moved(
      visible.map((p) => p.id),
      id,
      direction,
    );
    patch((s) => ({ ...s, products: placeVisible(s.products, ids) }));
    void reorder(ids);
  };

  const setRowActive = (id: number, isActive: boolean) =>
    patch((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? { ...p, isActive } : p)),
    }));

  const toggleActive = async (p: AdminProduct) => {
    const next = !p.isActive;
    setOpenId(null);
    setRowActive(p.id, next);
    try {
      await sending(api.admin.setActive(p.id, next));
    } catch (err) {
      setRowActive(p.id, !next);
      toast(failText(err));
    }
  };

  const remove = async (p: AdminProduct) => {
    setOpenId(null);
    try {
      await api.admin.deleteProduct(p.id);
      patch((s) => ({ ...s, products: s.products.filter((row) => row.id !== p.id) }));
      toast('Видалено');
    } catch (err) {
      toast(failText(err));
    }
  };

  const startAdding = () => {
    if (state.templates.length) setAdding(true);
    else router.push(`${base}/admin/product`);
  };

  const pickTemplate = (template: AdminTemplate | null) =>
    router.push(`${base}/admin/product${template ? `?template=${template.id}` : ''}`);

  const tools = [
    { href: 'templates', label: 'Шаблони' },
    { href: 'labels', label: 'Категорії і теги' },
    { href: 'groups', label: '👥 Групи користувачів' },
    { href: 'slots', label: '🗓 Слоти видачі' },
  ];

  return (
    <div className="space-y-4">
      <ScreenHead
        title="Управління товарами"
        aside={
          <span className="shrink-0 pb-1 text-sm font-bold text-brand-cyan">
            {plural(state.products.length, ['товар', 'товари', 'товарів'])}
          </span>
        }
      />

      {error && <Banner tone="error">{error}</Banner>}
      {!state.adminChatBound && <Banner tone="hint">⚠ Адмін-чат не прив&apos;язано</Banner>}

      <Button onClick={startAdding} className={ACTION_CLASS}>
        + Додати товар
      </Button>

      <nav aria-label="Налаштування" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={`${base}/admin/${tool.href}`}
            className={cn(
              'flex min-h-11 shrink-0 items-center rounded-full border border-border bg-surface px-4 text-sm font-bold text-muted transition-all hover:border-brand-cyan/50 hover:text-fg active:scale-95',
              CONTROL,
            )}
          >
            {tool.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Segmented
            value={filter.status}
            options={STATUS}
            disabled={ordering}
            onChange={(status) => changeFilter({ status })}
            className="flex-1 border border-border bg-surface"
          />
          <button
            type="button"
            aria-pressed={ordering}
            disabled={visible.length < 2}
            onClick={() => setOrdering((on) => !on)}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-extrabold transition-all active:scale-95 disabled:opacity-40',
              CONTROL,
              ordering
                ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
                : 'border-border bg-surface/50 text-muted hover:text-fg',
            )}
          >
            <Icon d={ICONS.sort} className="size-4" />
            Порядок
          </button>
        </div>

        {state.categories.length + state.tags.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {state.categories.map((c) => (
              <Chip
                key={`c${c.id}`}
                kind="option"
                active={filter.category === c.id}
                disabled={ordering}
                onClick={() =>
                  changeFilter({ category: filter.category === c.id ? null : c.id })
                }
              >
                {c.name}
              </Chip>
            ))}
            {state.tags.map((t) => (
              <Chip
                key={`t${t.id}`}
                kind="option"
                active={filter.tags.includes(t.id)}
                disabled={ordering}
                onClick={() =>
                  changeFilter({
                    tags: filter.tags.includes(t.id)
                      ? filter.tags.filter((id) => id !== t.id)
                      : [...filter.tags, t.id],
                  })
                }
              >
                {t.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {!visible.length ? (
        state.products.length ? (
          <Empty
            icon="🔍"
            title="Нічого не знайшли"
            text="Спробуй іншу категорію або зміни фільтри."
            action={
              <button
                type="button"
                onClick={() => changeFilter(NO_FILTER)}
                className={SECONDARY_CLASS}
              >
                Скинути фільтри
              </button>
            }
          />
        ) : (
          <Empty icon="📦" title="Товарів ще немає" />
        )
      ) : (
        <ul className={LIST_CLASS}>
          {visible.map((p, index) => {
            const thumb = p.photos[0]?.thumbUrl ?? null;
            const face = (
              <Photo
                thumb={thumb}
                alt={p.title}
                className={cn(
                  'shrink-0 rounded-xl',
                  ordering ? 'size-11' : 'size-14',
                  !p.isActive && 'opacity-50 grayscale',
                )}
              />
            );
            const archived = !p.isActive && (
              <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                Архів
              </span>
            );
            return ordering ? (
              <li key={p.id} className="flex items-center gap-2.5 py-1.5 pl-3 pr-1">
                {face}
                <span className="line-clamp-2 min-w-0 flex-1 text-sm font-extrabold leading-snug">
                  {p.title}
                </span>
                <MoveButtons
                  first={index === 0}
                  last={index === visible.length - 1}
                  label={p.title}
                  onMove={(direction) => move(p.id, direction)}
                />
              </li>
            ) : (
              <li
                key={p.id}
                className="flex items-center transition-colors has-[a:active]:bg-white/5"
              >
                <Link
                  href={`${base}/admin/product?id=${p.id}`}
                  className={cn('flex min-w-0 flex-1 items-center gap-3 py-3 pl-3', CONTROL)}
                >
                  {face}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-extrabold leading-snug">
                        {p.title}
                      </span>
                      {archived}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] font-semibold text-muted">
                      {firstLine(p)}
                    </span>
                    <span className="line-clamp-2 text-xs text-subtle">
                      {secondLine(p, state)}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Дії: ${p.title}`}
                  onClick={() => setOpenId(p.id)}
                  className={cn(ROUND_BUTTON, 'mr-1 h-14')}
                >
                  <Icon d={ICONS.dots} className="size-6" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Додати товар">
        <TemplatePicker templates={state.templates} onPick={pickTemplate} />
      </Sheet>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.title ?? ''}>
        {open && (
          <>
            <Link href={`${base}/admin/product?copy=${open.id}`} className={SHEET_ROW}>
              Дублювати
            </Link>
            <button type="button" onClick={() => void toggleActive(open)} className={SHEET_ROW}>
              {open.isActive ? 'Архів' : 'Активувати'}
            </button>
            <button
              type="button"
              onClick={() => removal.tap(open.id, () => void remove(open))}
              className={cn(SHEET_ROW, 'text-brand-red', removal.armed === open.id && 'bg-brand-red/10')}
            >
              {removal.armed === open.id ? 'Натисніть ще раз для підтвердження' : 'Видалити'}
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}
