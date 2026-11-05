'use client';

import { Fragment, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { CONTROL, useSurface } from '../ui';
import {
  BARE_INPUT,
  HINT_CLASS,
  ICONS,
  Icon,
  NO_SIZE,
  ROUND_BUTTON,
  Segmented,
  Sheet,
  scrollOnFocus,
} from './kit';

export interface MatrixCell {
  price: string;
  stock: string;
  stockSeen?: number | null;
}

export interface MatrixValue {
  sizes: string[]; // [NO_SIZE] for «Без розмірів»
  colors: string[]; // [] for no colours
  cells: Record<string, MatrixCell>; // key `${size}|${color}`
}

type Axis = 'sizes' | 'colors';
type Layer = 'price' | 'stock';

export const cellKey = (size: string, color: string) => `${size}|${color}`;
export const columnsOf = (colors: string[]) => (colors.length ? colors : ['']);

/** One empty cell: a sticker needs nothing but a price, and a first size replaces NO_SIZE. */
export const blankMatrix = (): MatrixValue => ({ sizes: [NO_SIZE], colors: [], cells: {} });

/**
 * New cells copy the neighbour's price, so adding a size or a colour never means retyping.
 * Cells already in state win: a removed name that comes back restores its values.
 */
function withAxes(m: MatrixValue, sizes: string[], colors: string[]): MatrixValue {
  const cells = { ...m.cells };
  const lastColor = columnsOf(m.colors).at(-1) ?? '';
  const lastSize = m.sizes.at(-1) ?? NO_SIZE;
  for (const size of sizes) {
    for (const color of columnsOf(colors)) {
      cells[cellKey(size, color)] ??= {
        price:
          cells[cellKey(size, lastColor)]?.price || cells[cellKey(lastSize, color)]?.price || '',
        stock: '',
      };
    }
  }
  return { sizes, colors, cells };
}

/** Spaces and commas split; a comma in colours keeps "Темно синій, Білий" as two names. */
function parseNames(axis: Axis, raw: string) {
  const parts = axis === 'colors' && raw.includes(',') ? raw.split(',') : raw.split(/[\s,]+/);
  return parts
    .map((s) => (axis === 'sizes' ? s.trim().toUpperCase().slice(0, 20) : s.trim().slice(0, 30)))
    .filter((s) => s && s !== NO_SIZE);
}

/** An override replaces the number at once, with no backspacing on a phone keyboard. */
const selectOnFocus = (e: FocusEvent<HTMLInputElement>) => {
  e.currentTarget.select();
  scrollOnFocus(e);
};

const clean = (layer: Layer, raw: string) =>
  layer === 'price' ? raw.replace(',', '.').replace(/[^\d.]/g, '') : raw.replace(/\D/g, '');

const LAYERS = [
  ['price', 'Ціни'],
  ['stock', 'Залишки'],
] as const;

const AXIS_TEXT = {
  sizes: {
    title: 'Розміри',
    add: 'Додати розміри',
    example: 'S M L XL XXL',
    quick: ['S M L XL XXL'],
  },
  colors: {
    title: 'Кольори',
    add: 'Додати кольори',
    example: 'Білий Чорний',
    quick: ['Білий Чорний'],
  },
};

const CHIP_CLASS =
  'inline-flex min-h-11 max-w-full items-center rounded-full border border-border bg-surface-2 pl-4 pr-0.5 text-sm font-extrabold';

function AddSheet({
  axis,
  onClose,
  onAdd,
}: {
  axis: Axis | null;
  onClose(): void;
  onAdd(raw: string): void;
}) {
  const shown = axis ?? 'sizes';
  return (
    <Sheet open={axis !== null} onClose={onClose} title={AXIS_TEXT[shown].add}>
      <AddForm axis={shown} onClose={onClose} onAdd={onAdd} />
    </Sheet>
  );
}

/** Mounts with each opening of the sheet, so text left unconfirmed goes with it. */
function AddForm({
  axis,
  onClose,
  onAdd,
}: {
  axis: Axis;
  onClose(): void;
  onAdd(raw: string): void;
}) {
  const [text, setText] = useState('');
  const words = AXIS_TEXT[axis];
  const finish = (raw: string) => {
    onAdd(raw);
    onClose();
  };
  return (
    <>
      <form
        className="flex gap-2 px-1 pb-1"
        onSubmit={(e) => {
          e.preventDefault();
          finish(text);
        }}
      >
        <input
          data-autofocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={words.example}
          aria-label={words.add}
          enterKeyHint="done"
          autoCapitalize={axis === 'sizes' ? 'characters' : 'sentences'}
          autoCorrect="off"
          className={BARE_INPUT}
        />
        <Button type="submit" disabled={!text.trim()} className="shrink-0 rounded-xl">
          Додати
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
        {words.quick.map((set) => (
          <button
            key={set}
            type="button"
            onClick={() => finish(set)}
            className={cn(
              'min-h-11 rounded-full border border-brand-purple/40 bg-brand-purple/10 px-4 text-sm font-extrabold transition-all active:scale-95',
              CONTROL,
            )}
          >
            {set}
          </button>
        ))}
      </div>
      <p className={cn(HINT_CLASS, 'px-2 pt-2')}>Можна кілька одразу, через пробіл або кому.</p>
    </>
  );
}

function NameChips({
  axis,
  names,
  onRemove,
  onAdd,
  children,
}: {
  axis: Axis;
  names: string[];
  onRemove(name: string): void;
  onAdd(): void;
  children?: React.ReactNode;
}) {
  const { title, add } = AXIS_TEXT[axis];
  return (
    <div className="space-y-1.5">
      <h3 className="px-1 text-xs font-black uppercase tracking-wider text-muted">{title}</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {names.map((name) => (
          <span key={name} className={CHIP_CLASS}>
            <span className="truncate">{name}</span>
            <button
              type="button"
              aria-label={`Прибрати ${name}`}
              onClick={() => onRemove(name)}
              className={cn(ROUND_BUTTON, 'h-11 w-9 rounded-full')}
            >
              <Icon d={ICONS.close} className="size-4" />
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label={add}
          onClick={onAdd}
          className={cn(
            'flex size-11 items-center justify-center rounded-full border border-dashed border-brand-cyan/60 text-brand-cyan transition-all hover:bg-brand-cyan/10 active:scale-90',
            CONTROL,
          )}
        >
          <Icon d={ICONS.plus} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function VariantMatrix({
  value,
  onChange,
  withStock,
}: {
  value: MatrixValue;
  onChange(v: MatrixValue): void;
  withStock: boolean;
}) {
  const { tg } = useSurface();
  const [adding, setAdding] = useState<Axis | null>(null);
  const [layer, setLayer] = useState<Layer>('price');
  const [fill, setFill] = useState({ price: '', stock: '' });
  const grid = useRef<HTMLDivElement>(null);
  const sizesBefore = useRef<string[]>([]);

  const noSize = value.sizes[0] === NO_SIZE;
  const shownSizes = noSize ? [] : value.sizes;
  const cols = columnsOf(value.colors);
  const stockLayer = withStock && layer === 'stock';
  const shown: Layer = stockLayer ? 'stock' : 'price';
  const cellCount = value.sizes.length * cols.length;

  const cellAt = (size: string, color: string) =>
    value.cells[cellKey(size, color)] ?? { price: '', stock: '' };

  // ponytail: names keep the order they were added in; removing and re-adding is how XS gets
  // in front of S. Up and down arrows on the chips are the upgrade if that gets annoying.
  const add = (axis: Axis, raw: string) => {
    const names = parseNames(axis, raw);
    if (!names.length) return; // only separators, or the reserved '-'
    if (axis === 'sizes') {
      onChange(withAxes(value, [...new Set([...shownSizes, ...names])], value.colors));
    } else {
      onChange(withAxes(value, value.sizes, [...new Set([...value.colors, ...names])]));
    }
  };

  const removeSize = (name: string) => {
    const left = value.sizes.filter((s) => s !== name);
    onChange(withAxes(value, left.length ? left : [NO_SIZE], value.colors));
  };

  const toggleNoSize = (on: boolean) => {
    if (on) {
      sizesBefore.current = shownSizes;
      onChange(withAxes(value, [NO_SIZE], value.colors));
    } else if (sizesBefore.current.length) {
      onChange(withAxes(value, sizesBefore.current, value.colors));
    } else {
      setAdding('sizes'); // the box stays ticked until there is a size to show
    }
  };

  const setCell = (size: string, color: string, text: string) =>
    onChange({
      ...value,
      cells: {
        ...value.cells,
        [cellKey(size, color)]: { ...cellAt(size, color), [shown]: clean(shown, text) },
      },
    });

  const fillAll = () => {
    const cells = { ...value.cells };
    for (const size of value.sizes) {
      for (const color of cols) {
        const cell = cellAt(size, color);
        // No price means no variant, so there is nothing to count.
        if (shown === 'price' || cell.price) {
          cells[cellKey(size, color)] = { ...cell, [shown]: fill[shown] };
        }
      }
    }
    onChange({ ...value, cells });
    tg?.haptic('light');
  };

  /** Down the column, then to the top of the next one; empty stock cells are skipped. */
  const focusNext = (row: number, col: number, field: HTMLInputElement) => {
    for (let c = col, r = row + 1; c < cols.length; c++, r = 0) {
      for (; r < value.sizes.length; r++) {
        const next = grid.current?.querySelector<HTMLInputElement>(`[data-cell="${r}:${c}"]`);
        if (next) return next.focus();
      }
    }
    field.blur();
  };

  const onEnter = (row: number, col: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    focusNext(row, col, e.currentTarget);
  };

  const columnTitle = (color: string) => color || (shown === 'price' ? 'Ціна' : 'Залишок');
  const canFill = shown === 'stock' || !!fill.price;

  return (
    <div className="space-y-4">
      <NameChips
        axis="sizes"
        names={shownSizes}
        onRemove={removeSize}
        onAdd={() => setAdding('sizes')}
      >
        <label className="ml-1 flex min-h-11 cursor-pointer items-center gap-2.5 px-1 text-sm font-bold text-muted">
          <input
            type="checkbox"
            checked={noSize}
            onChange={(e) => toggleNoSize(e.target.checked)}
            className="size-5 accent-brand-cyan"
          />
          Без розмірів
        </label>
      </NameChips>

      <NameChips
        axis="colors"
        names={value.colors}
        onRemove={(name) =>
          onChange(
            withAxes(
              value,
              value.sizes,
              value.colors.filter((c) => c !== name),
            ),
          )
        }
        onAdd={() => setAdding('colors')}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {(withStock || cellCount > 1) && (
          <div className="space-y-2.5 p-3">
            {withStock && (
              <Segmented value={shown} options={LAYERS} onChange={(next) => setLayer(next)} />
            )}
            {cellCount > 1 && (
              <div className="flex items-center gap-2">
                <label htmlFor="matrix-fill" className="shrink-0 text-sm font-bold text-muted">
                  Для всіх
                </label>
                <input
                  id="matrix-fill"
                  value={fill[shown]}
                  onChange={(e) => setFill({ ...fill, [shown]: clean(shown, e.target.value) })}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    // Done on an empty field only closes the keyboard: «Заповнити» is how to clear.
                    if (fill[shown]) fillAll();
                    e.currentTarget.blur();
                  }}
                  onFocus={selectOnFocus}
                  inputMode={shown === 'price' ? 'decimal' : 'numeric'}
                  enterKeyHint="done"
                  placeholder={shown === 'price' ? '500' : '∞'}
                  size={1}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 text-center text-base font-bold tabular-nums text-fg outline-none transition-colors placeholder:text-subtle/60 focus:border-brand-cyan"
                />
                <button
                  type="button"
                  disabled={!canFill}
                  onClick={fillAll}
                  className={cn(
                    'min-h-11 shrink-0 rounded-xl bg-brand-cyan/15 px-4 text-sm font-extrabold text-brand-cyan transition-all hover:bg-brand-cyan/25 active:scale-95 disabled:pointer-events-none disabled:opacity-40',
                    CONTROL,
                  )}
                >
                  Заповнити
                </button>
              </div>
            )}
          </div>
        )}

        <div
          ref={grid}
          className="scroll-pl-14 overflow-x-auto overscroll-x-contain border-t border-border/70 first:border-t-0"
        >
          <div
            className="grid w-max min-w-full"
            style={{
              gridTemplateColumns: `${noSize ? '' : '3.5rem '}repeat(${cols.length}, minmax(5.5rem, 1fr))`,
            }}
          >
            {!noSize && <span className="sticky left-0 z-10 bg-surface" />}
            {cols.map((color) => (
              <span
                key={color}
                title={columnTitle(color)}
                className="truncate border-l border-border/70 px-2 py-2 text-center text-[11px] font-black uppercase tracking-wide text-muted first:border-l-0"
              >
                {columnTitle(color)}
              </span>
            ))}
            {value.sizes.map((size, row) => (
              <Fragment key={size}>
                {!noSize && (
                  <span className="sticky left-0 z-10 flex items-center justify-center truncate border-t border-border/70 bg-surface px-1 text-sm font-black">
                    {size}
                  </span>
                )}
                {cols.map((color, col) => {
                  const cell = cellAt(size, color);
                  const dead = shown === 'stock' && !cell.price;
                  const name = [noSize ? '' : size, color].filter(Boolean).join(', ');
                  return (
                    <span
                      key={color}
                      className={cn(
                        'flex border-t border-border/70',
                        (!noSize || col > 0) && 'border-l',
                      )}
                    >
                      {dead ? (
                        <span
                          aria-label={`${name}: такого варіанту немає`}
                          className="flex min-h-11 w-full items-center justify-center text-subtle/50"
                        >
                          —
                        </span>
                      ) : (
                        <input
                          data-cell={`${row}:${col}`}
                          value={cell[shown]}
                          onChange={(e) => setCell(size, color, e.target.value)}
                          onKeyDown={onEnter(row, col)}
                          onFocus={selectOnFocus}
                          inputMode={shown === 'price' ? 'decimal' : 'numeric'}
                          enterKeyHint="next"
                          placeholder={shown === 'price' ? '—' : '∞'}
                          aria-label={`${shown === 'price' ? 'Ціна' : 'Залишок'}${name ? `, ${name}` : ''}`}
                          size={1}
                          className="min-h-11 w-full min-w-0 bg-transparent px-1 text-center text-base font-bold tabular-nums text-fg outline-none transition-colors placeholder:font-medium placeholder:text-subtle/50 focus:bg-brand-cyan/10 focus:ring-2 focus:ring-inset focus:ring-brand-cyan"
                        />
                      )}
                    </span>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <p className={HINT_CLASS}>
        {shown === 'price'
          ? 'Порожня ціна: такого варіанту немає.'
          : 'Порожня клітинка — Без обмежень'}
      </p>

      <AddSheet
        axis={adding}
        onClose={() => setAdding(null)}
        onAdd={(raw) => adding && add(adding, raw)}
      />
    </div>
  );
}
