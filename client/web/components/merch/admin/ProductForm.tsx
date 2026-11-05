'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { parentOf, priceText } from '@/lib/merch';
import { newKey } from '@/lib/merch-cart';
import type {
  AdminProduct,
  AdminState,
  AdminTemplate,
  ProductBody,
  TemplateBody,
} from '@/lib/merch-types';
import { cn } from '@/lib/utils';
import {
  Banner,
  Chip,
  DANGER_CLASS,
  Empty,
  SectionTitle,
  useAction,
  useSurface,
} from '../ui';
import {
  Gate,
  HINT_CLASS,
  ICONS,
  Icon,
  NO_SIZE,
  SECONDARY,
  ScreenHead,
  Sheet,
  TemplatePicker,
  colorsOf,
  colorsText,
  lowestPrice,
  saving,
  scrollOnFocus,
  sizesOf,
  sizesText,
  useKeyboardInset,
  useTwoTap,
} from './kit';
import { PhotoTile, type TilePhoto, type TileStatus } from './PhotoTile';
import { useAdminState } from './useAdminState';
import {
  VariantMatrix,
  blankMatrix,
  cellKey,
  columnsOf,
  type MatrixCell,
  type MatrixValue,
} from './VariantMatrix';

interface Fields {
  title: string;
  description: string;
  categoryId: number | null;
  tagIds: number[];
  groupIds: number[];
  matrix: MatrixValue;
  photos: Record<string, TilePhoto>; // by colour, '' for a product without colours
}

/** What a template sets. Title and photos are this product's own. */
type TemplateValues = Omit<Fields, 'title' | 'photos'>;

const blankValues = (): TemplateValues => ({
  description: '',
  categoryId: null,
  tagIds: [],
  groupIds: [],
  matrix: blankMatrix(),
});

function templateValues(t: AdminTemplate, state: AdminState): TemplateValues {
  const cells: Record<string, MatrixCell> = {};
  for (const { size, color, price } of t.prices) {
    cells[cellKey(size, color)] = { price: priceText(price), stock: '' };
  }
  return {
    description: t.description,
    categoryId: t.categoryId,
    tagIds: t.tagIds.filter((id) => state.tags.some((tag) => tag.id === id)),
    groupIds: t.groupIds,
    matrix: { sizes: t.sizes.length ? t.sizes : [NO_SIZE], colors: t.colors, cells },
  };
}

function productFields(p: AdminProduct, copy: boolean): Fields {
  const cells: Record<string, MatrixCell> = {};
  for (const v of p.variants) {
    cells[cellKey(v.size, v.color)] = {
      price: priceText(v.price),
      stock: copy || v.stock === null ? '' : String(v.stock),
      ...(!copy && { stockSeen: v.stock }),
    };
  }
  const sizes = sizesOf(p.variants);
  return {
    title: copy ? `${p.title} (копія)`.slice(0, 255) : p.title,
    description: p.description,
    categoryId: p.categoryId,
    tagIds: p.tagIds,
    groupIds: p.groupIds,
    matrix: { sizes: sizes.length ? sizes : [NO_SIZE], colors: colorsOf(p.variants), cells },
    photos: Object.fromEntries(p.photos.map((f) => [f.color, f])),
  };
}

/** The matrix as request rows. A cell without a price is a combination not sold. */
function rowsOf({ sizes, colors, cells }: MatrixValue) {
  return sizes.flatMap((size, sizeIndex) =>
    columnsOf(colors).flatMap((color, colorIndex) => {
      const cell = cells[cellKey(size, color)];
      if (!cell?.price) return [];
      return [
        {
          size,
          color,
          price: cell.price,
          order: sizeIndex * 100 + colorIndex,
          stock: cell.stock === '' ? null : Number(cell.stock),
          stockSeen: cell.stockSeen, // JSON drops it on a cell with no variant behind it
        },
      ];
    }),
  );
}

const sizeName = (size: string) => (size === NO_SIZE ? 'без розміру' : size);

/** Same sentences as the server's variantProblem and templateProblem, plus its MONEY pattern. */
function problemOf(mode: 'product' | 'template', f: Fields): string | null {
  if (mode === 'template' && !f.title.trim()) return 'Вкажіть назву шаблону';
  if (mode === 'product' && (!f.title.trim() || !f.description.trim())) {
    return 'Заповніть назву та опис';
  }
  const rows = rowsOf(f.matrix);
  if (!rows.length) {
    return mode === 'template' ? 'Вкажіть хоча б одну ціну' : 'Додайте хоча б один варіант';
  }
  const badPrice = rows.find((r) => !/^\d{1,8}(\.\d{1,2})?$/.test(r.price) || !(Number(r.price) > 0));
  if (badPrice) return `Некоректна ціна для розміру ${sizeName(badPrice.size)}`;
  const badStock = rows.find((r) => r.stock !== null && r.stock > 1_000_000);
  if (badStock) return `Некоректна кількість для розміру ${sizeName(badStock.size)}`;
  return null;
}

/** "2 кольори · 5 розмірів · 500 грн" */
function matrixLine(matrix: MatrixValue) {
  const prices = rowsOf(matrix).map((r) => r.price);
  const low = prices.length ? lowestPrice(prices) : '';
  const single = prices.every((p) => Number(p) === Number(prices[0]));
  const sizes = matrix.sizes.filter((s) => s !== NO_SIZE).length;
  return [
    matrix.colors.length > 0 && colorsText(matrix.colors.length),
    sizes > 0 && sizesText(sizes),
    prices.length ? `${single ? '' : 'від '}${low} грн` : 'Ще без цін',
  ]
    .filter(Boolean)
    .join(' · ');
}

const CONTROLS = 'input, textarea, button, a, label, dialog';

const toggled = (ids: number[], id: number) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

/** Everything a template change would overwrite. Title and photos stay, so they do not count. */
const overwritable = ({ description, categoryId, tagIds, groupIds, matrix }: Fields) =>
  JSON.stringify({ description, categoryId, tagIds, groupIds, matrix });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

export function ProductForm({
  mode,
  id,
  copy,
  template,
}: {
  mode: 'product' | 'template';
  id?: number;
  copy?: number;
  template?: number;
}) {
  const { state, fresh, error, refresh, patch } = useAdminState();
  // A form built on the cached state would save it back over what others changed.
  const fromServer = id !== undefined || copy !== undefined || template !== undefined;
  if (!state || (fromServer && !fresh)) {
    return (
      <div className="space-y-4">
        <ScreenHead
          back={mode === 'template' ? 'Шаблони' : undefined}
          title={mode === 'template' ? 'Шаблон' : 'Товар'}
        />
        <Gate error={error} refresh={refresh} />
      </div>
    );
  }
  const missing =
    id !== undefined &&
    !(mode === 'template' ? state.templates : state.products).some((row) => row.id === id);
  if (missing) return <Missing mode={mode} />;
  return (
    <Editor
      mode={mode}
      id={id}
      copy={copy}
      template={template}
      state={state}
      refresh={refresh}
      patch={patch}
    />
  );
}

function Missing({ mode }: { mode: 'product' | 'template' }) {
  const { base } = useSurface();
  const template = mode === 'template';
  return (
    <Empty
      icon="🔍"
      title={template ? 'Шаблон не знайдено.' : 'Товар не знайдено.'}
      action={
        <Link href={`${base}/admin${template ? '/templates' : ''}`} className={SECONDARY}>
          До списку
        </Link>
      }
    />
  );
}

function Editor({
  mode,
  id,
  copy,
  template,
  state,
  refresh,
  patch,
}: {
  mode: 'product' | 'template';
  id?: number;
  copy?: number;
  template?: number;
  state: AdminState;
  refresh(): Promise<void>;
  patch(change: (s: AdminState) => AdminState): void;
}) {
  const { api, base, toast } = useSurface();
  const router = useRouter();
  const pathname = usePathname();
  const { busy, error, run } = useAction();
  const removal = useTwoTap();
  const keyboard = useKeyboardInset();
  const titleRef = useRef<HTMLInputElement>(null);

  const isTemplate = mode === 'template';
  const product = isTemplate ? undefined : state.products.find((p) => p.id === id);
  const [seenKey] = useState(product?.saveKey ?? null); // at load, not as later refreshes move it
  const attempt = useRef<{ body: string; key: string } | null>(null);

  const [source, setSource] = useState<AdminTemplate | null>(() =>
    isTemplate ? null : (state.templates.find((t) => t.id === template) ?? null),
  );
  // ponytail: the form lives in memory, so Android killing the app during a gallery trip loses it.
  // A draft in localStorage, as checkout has, is the upgrade if that ever happens to her.
  const [fields, setFields] = useState<Fields>(() => {
    if (isTemplate) {
      const own = state.templates.find((t) => t.id === id);
      return own
        ? { title: own.name, photos: {}, ...templateValues(own, state) }
        : { title: '', photos: {}, ...blankValues() };
    }
    if (product) return productFields(product, false);
    const original = state.products.find((p) => p.id === copy);
    if (original) return productFields(original, true);
    return {
      title: '',
      photos: {},
      ...(source ? templateValues(source, state) : blankValues()),
    };
  });
  const [untouched, setUntouched] = useState(() => overwritable(fields));

  const [matrixOpen, setMatrixOpen] = useState(!source);
  const [described, setDescribed] = useState(!source?.description);
  const [picking, setPicking] = useState(false);
  const [replacing, setReplacing] = useState<AdminTemplate | 'blank' | null>(null);
  const [tileStatus, setTileStatus] = useState<Record<string, TileStatus>>({});
  const [round, setRound] = useState(0); // new tiles after "save and next"
  const [added, setAdded] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const set = (change: Partial<Fields>) => setFields((f) => ({ ...f, ...change }));

  const setMatrix = (matrix: MatrixValue) =>
    setFields((f) => {
      // The photo of a product without colours becomes the first colour's, instead of vanishing.
      const from = f.matrix.colors[0] ?? '';
      const to = matrix.colors[0] ?? '';
      const carried = (from === '' || to === '') && f.photos[from] && !f.photos[to];
      return {
        ...f,
        matrix,
        photos: carried ? { ...f.photos, [to]: f.photos[from] } : f.photos,
      };
    });

  const applyTemplate = (next: AdminTemplate | 'blank') => {
    const merged = {
      ...fields,
      ...(next === 'blank' ? blankValues() : templateValues(next, state)),
    };
    setFields(merged);
    setUntouched(overwritable(merged));
    setSource(next === 'blank' ? null : next);
    setMatrixOpen(next === 'blank');
    setDescribed(next === 'blank' || !next.description);
    setPicking(false);
    setReplacing(null);
  };

  const askTemplate = (next: AdminTemplate | 'blank') => {
    if (overwritable(fields) === untouched) applyTemplate(next);
    else setReplacing(next);
  };

  // Colours can change, so only the tiles on screen count.
  const tiles = isTemplate ? [] : columnsOf(fields.matrix.colors);
  const uploading = tiles.some((color) => tileStatus[color] === 'busy');
  const lostPhoto = tiles.some((color) => tileStatus[color] === 'failed');
  const deadGroups = fields.groupIds.filter((g) => !state.groups.some((row) => row.id === g));
  const problem =
    problemOf(mode, fields) ??
    (deadGroups.length > 0
      ? 'Перевірте, хто бачить товар.'
      : lostPhoto
        ? 'Повторіть або приберіть фото, яке не завантажилось.'
        : null);
  const blocked = busy || leaving || uploading || !!problem;

  const leave = async () => {
    setLeaving(true); // the form stays on screen until the route changes, and it is already saved
    await refresh();
    router.push(parentOf(pathname, base) ?? `${base}/admin`);
  };

  const send = (): Promise<unknown> => {
    if (isTemplate) {
      const { title, matrix, description, categoryId, tagIds, groupIds } = fields;
      const body: TemplateBody = {
        name: title.trim(),
        description: description.trim(),
        categoryId,
        tagIds,
        groupIds,
        sizes: matrix.sizes,
        colors: matrix.colors,
        prices: rowsOf(matrix).map(({ size, color, price }) => ({ size, color, price })),
      };
      return id ? api.admin.updateTemplate(id, body) : api.admin.createTemplate(body);
    }
    const body: Omit<ProductBody, 'saveKey' | 'seenKey'> = {
      title: fields.title.trim(),
      description: fields.description.trim(),
      categoryId: fields.categoryId,
      tagIds: fields.tagIds,
      groupIds: fields.groupIds,
      variants: rowsOf(fields.matrix),
      photos: columnsOf(fields.matrix.colors).flatMap((color) => {
        const photo = fields.photos[color];
        return photo ? [{ color, url: photo.url, thumbUrl: photo.thumbUrl }] : [];
      }),
    };
    // One key per distinct body: the server knows a retry of a lost response from a new save.
    const text = JSON.stringify(body);
    if (attempt.current?.body !== text) attempt.current = { body: text, key: newKey() };
    const keyed = { ...body, saveKey: attempt.current.key, seenKey };
    return id ? api.admin.updateProduct(id, keyed) : api.admin.createProduct(keyed);
  };

  const save = async (next: boolean) => {
    if (blocked || !(await run(() => saving(send())))) return;
    toast('Збережено ✓');
    attempt.current = null;
    if (!next) return leave();
    // Everything else stays from the template: only what differs per product is cleared.
    setFields((f) => ({
      ...f,
      title: '',
      photos: {},
      matrix: {
        ...f.matrix,
        cells: Object.fromEntries(
          Object.entries(f.matrix.cells).map(([key, cell]) => [key, { ...cell, stock: '' }]),
        ),
      },
    }));
    setRound((r) => r + 1);
    setAdded((n) => n + 1);
    setTileStatus({});
    window.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
    void refresh();
  };

  const activate = async () => {
    if (!id) return;
    const ok = await run(() => saving(api.admin.setActive(id, true)));
    if (ok) {
      patch((s) => ({
        ...s,
        products: s.products.map((p) => (p.id === id ? { ...p, isActive: true } : p)),
      }));
    }
  };

  const removeTemplate = async () => {
    if (!id) return;
    if (!(await run(() => saving(api.admin.deleteTemplate(id))))) return;
    toast('Видалено');
    await leave();
  };

  const mainLabel = busy || leaving
    ? 'Зберігаємо...'
    : uploading
      ? 'Фото вантажиться...'
      : isTemplate
        ? 'Зберегти шаблон'
        : source
          ? 'Зберегти і наступний'
          : id
            ? 'Зберегти зміни'
            : 'Створити товар';

  const heading = isTemplate
    ? id
      ? 'Шаблон'
      : 'Новий шаблон'
    : id
      ? 'Редагування'
      : copy
        ? 'Копія товару'
        : 'Новий товар';

  return (
    <div
      className="space-y-6 pb-10"
      // iOS keeps its number pad up on a tap beside a field. Controls are left out: the keyboard
      // going down mid-tap would move them from under the finger and lose the click.
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (document.activeElement instanceof HTMLElement && !target.closest(CONTROLS)) {
          document.activeElement.blur();
        }
      }}
    >
      <ScreenHead back={isTemplate ? 'Шаблони' : undefined} title={heading} />

      {!isTemplate && source && (
        <div className="flex min-h-11 items-center gap-1.5 rounded-2xl border border-brand-purple/30 bg-brand-purple/10 px-4 text-sm">
          <span className="min-w-0 truncate font-bold">Шаблон: {source.name}</span>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="min-h-11 shrink-0 font-extrabold text-brand-cyan"
          >
            змінити
          </button>
        </div>
      )}

      {product && !product.isActive && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 py-1.5 pl-4 pr-1.5">
          <span className="text-sm font-black uppercase tracking-wider text-amber-200/90">
            Архів
          </span>
          <button type="button" disabled={busy} onClick={activate} className={SECONDARY}>
            Активувати
          </button>
        </div>
      )}

      {!isTemplate && (
        <Section title="Фото товару">
          <div className="grid grid-cols-2 gap-2.5">
            {tiles.map((color) => (
              <PhotoTile
                key={`${round}:${color}`}
                color={color}
                value={fields.photos[color] ?? null}
                wide={tiles.length === 1}
                onStatus={(status) => setTileStatus((all) => ({ ...all, [color]: status }))}
                onChange={(photo) =>
                  setFields((f) => {
                    const photos = { ...f.photos };
                    if (photo) photos[color] = photo;
                    else delete photos[color];
                    return { ...f, photos };
                  })
                }
              />
            ))}
          </div>
        </Section>
      )}

      <div className="space-y-4">
        <Input
          ref={titleRef}
          label={isTemplate ? 'Назва шаблону' : 'Назва товару'}
          placeholder={isTemplate ? 'Футболка кураторська' : 'Футболка FICE'}
          maxLength={isTemplate ? 100 : 255}
          value={fields.title}
          onChange={(e) => set({ title: e.target.value })}
          onFocus={scrollOnFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          enterKeyHint="done"
        />
        <div className="space-y-1.5">
          <Textarea
            label="Опис"
            placeholder="Опис товару..."
            rows={described ? 5 : 2}
            maxLength={isTemplate ? 5000 : 10_000}
            value={fields.description}
            onChange={(e) => set({ description: e.target.value })}
            onFocus={(e) => {
              setDescribed(true);
              scrollOnFocus(e);
            }}
            className={described ? undefined : 'min-h-0 resize-none'}
          />
          {!described && (
            <button
              type="button"
              onClick={() => setDescribed(true)}
              className="min-h-11 px-1 text-sm font-bold text-brand-cyan"
            >
              Розгорнути
            </button>
          )}
        </div>
      </div>

      <Section title="Варіанти товару">
        <button
          type="button"
          aria-expanded={matrixOpen}
          onClick={() => setMatrixOpen((open) => !open)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 text-left transition-all hover:border-brand-cyan/50 active:scale-[0.99]"
        >
          <span className="min-w-0 text-sm font-bold">{matrixLine(fields.matrix)}</span>
          {matrixOpen ? (
            <Icon d={ICONS.chevron} className="size-4 shrink-0 -rotate-90 text-brand-cyan" />
          ) : (
            <span className="shrink-0 text-sm font-extrabold text-brand-cyan">Змінити</span>
          )}
        </button>
        {matrixOpen && (
          <VariantMatrix value={fields.matrix} onChange={setMatrix} withStock={!isTemplate} />
        )}
      </Section>

      {state.categories.length > 0 && (
        <Section title="Категорія">
          <div className="flex flex-wrap gap-2">
            <Chip
              kind="option"
              active={fields.categoryId === null}
              onClick={() => set({ categoryId: null })}
            >
              Без категорії
            </Chip>
            {state.categories.map((c) => (
              <Chip
                key={c.id}
                kind="option"
                active={fields.categoryId === c.id}
                onClick={() => set({ categoryId: c.id })}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {state.tags.length > 0 && (
        <Section title="Теги">
          <div className="flex flex-wrap gap-2">
            {state.tags.map((t) => (
              <Chip
                key={t.id}
                kind="option"
                active={fields.tagIds.includes(t.id)}
                onClick={() => set({ tagIds: toggled(fields.tagIds, t.id) })}
              >
                {t.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {state.groups.length > 0 && (
        <Section title="Хто бачить товар">
          <div className="space-y-2">
            {state.groups.map((g) => {
              const on = fields.groupIds.includes(g.id);
              return (
                <label
                  key={g.id}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2 text-sm font-bold transition-colors',
                    on ? 'border-brand-cyan bg-brand-cyan/10' : 'border-border bg-surface',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => set({ groupIds: toggled(fields.groupIds, g.id) })}
                    className="size-5 shrink-0 accent-brand-cyan"
                  />
                  <span className="min-w-0 truncate">
                    👥 {g.name} ({g.members.length})
                  </span>
                </label>
              );
            })}
          </div>
          <p className={HINT_CLASS}>
            Якщо нічого не обрано — товар бачать усі. Якщо обрано групи — лише їхні учасники.
          </p>
        </Section>
      )}

      {deadGroups.length > 0 && (
        <Banner tone="hint">
          <div className="flex items-center justify-between gap-3">
            <span>Група з цього шаблону більше не існує. Перевірте, хто бачить товар.</span>
            <button
              type="button"
              onClick={() =>
                set({ groupIds: fields.groupIds.filter((g) => !deadGroups.includes(g)) })
              }
              className={cn(SECONDARY, 'shrink-0 px-3')}
            >
              Зрозуміло
            </button>
          </div>
        </Banner>
      )}

      {isTemplate && <p className={HINT_CLASS}>Зміни в шаблоні не торкаються вже створених товарів.</p>}

      {isTemplate && id !== undefined && (
        <button
          type="button"
          disabled={busy}
          onClick={() => removal.tap('template', removeTemplate)}
          className={cn(DANGER_CLASS, 'min-h-11 w-full')}
        >
          {removal.armed ? 'Натисніть ще раз для підтвердження' : 'Видалити шаблон'}
        </button>
      )}

      {/* Fixed, so it covers the tab bar on form screens and `bottom` lifts it above the iOS keyboard. */}
      <div
        style={{ bottom: keyboard }}
        className="fixed left-1/2 z-50 mb-0 w-full max-w-md -translate-x-1/2 space-y-2 border-t border-border/80 bg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
      >
        {error && <Banner tone="error">{error}</Banner>}
        {!error && (problem || added > 0) && (
          <p className={cn(HINT_CLASS, 'flex justify-between gap-3')}>
            <span>{problem}</span>
            {added > 0 && (
              <span className="shrink-0 font-bold text-brand-green">Додано: {added}</span>
            )}
          </p>
        )}
        <div className="flex gap-2">
          {source && (
            <Button
              variant="outline"
              disabled={blocked}
              onClick={() => void save(false)}
              className="shrink-0 rounded-2xl px-4 py-4 text-[15px] font-extrabold"
            >
              Зберегти
            </Button>
          )}
          <Button
            disabled={blocked}
            onClick={() => void save(!!source)}
            className="min-w-0 flex-1 rounded-2xl px-2 py-4 text-[15px] font-extrabold"
          >
            {mainLabel}
          </Button>
        </div>
      </div>

      {!isTemplate && (
        <Sheet
          open={picking}
          onClose={() => {
            setPicking(false);
            setReplacing(null);
          }}
          title={replacing ? 'Замінити введені дані?' : 'Обрати шаблон'}
        >
          {replacing ? (
            <div className="flex gap-2 p-1">
              <button
                type="button"
                onClick={() => setReplacing(null)}
                className={cn(SECONDARY, 'flex-1')}
              >
                Скасувати
              </button>
              <Button className="flex-1 rounded-xl" onClick={() => applyTemplate(replacing)}>
                Замінити
              </Button>
            </div>
          ) : (
            <TemplatePicker
              templates={state.templates}
              onPick={(picked) => askTemplate(picked ?? 'blank')}
            />
          )}
        </Sheet>
      )}
    </div>
  );
}
