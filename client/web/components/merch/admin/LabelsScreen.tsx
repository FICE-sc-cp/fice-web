'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { AdminLabel, AdminState, LabelKind } from '@/lib/merch-types';
import { cn } from '@/lib/utils';
import { Banner, SectionTitle, useAction, useSurface } from '../ui';
import {
  BARE_INPUT,
  Gate,
  HINT_CLASS,
  ICONS,
  Icon,
  LIST_CLASS,
  MoveButtons,
  ROUND_BUTTON,
  ScreenHead,
  failText,
  moved,
  saving,
  scrollOnFocus,
  useLatestOrder,
  useTwoTap,
  type Move,
} from './kit';
import { sending, useAdminState } from './useAdminState';

// w-9: five controls and a name share one row of a 360 px phone. Height stays 44 px.
const NARROW = 'h-11 w-9';

function NameList({
  kind,
  title,
  rows,
  placeholder,
  empty,
  asks,
  refresh,
  patch,
}: {
  kind: LabelKind;
  title: string;
  rows: AdminLabel[];
  placeholder: string;
  empty: string;
  asks(name: string): string;
  refresh(): Promise<void>;
  patch(change: (s: AdminState) => AdminState): void;
}) {
  const { api, tg, toast } = useSurface();
  const { busy, error, run } = useAction();
  const removal = useTwoTap();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<number | null>(null);

  const reorder = useLatestOrder(
    (ids) => sending(api.admin.reorderLabels(kind, ids)),
    (err) => {
      toast(failText(err));
      void refresh();
    },
  );

  const move = (id: number, direction: Move) => {
    tg?.haptic('light');
    const ids = moved(
      rows.map((r) => r.id),
      id,
      direction,
    );
    const key = kind === 'category' ? 'categories' : 'tags';
    patch((s) => ({ ...s, [key]: ids.flatMap((x) => s[key].filter((r) => r.id === x)) }));
    void reorder(ids);
  };

  const add = async () => {
    const name = text.trim();
    if (!name) return;
    if (await run(() => saving(api.admin.createLabel(kind, name)))) {
      setText('');
      await refresh();
    }
  };

  const rename = async (row: AdminLabel, raw: string) => {
    setEditing(null);
    const name = raw.trim();
    if (!name || name === row.name) return;
    if (await run(() => saving(api.admin.renameLabel(kind, row.id, name)))) await refresh();
  };

  const remove = async (row: AdminLabel) => {
    if (await run(() => saving(api.admin.deleteLabel(kind, row.id)))) {
      toast('Видалено');
      await refresh();
    }
  };

  return (
    <section className="space-y-2.5">
      <SectionTitle>{title}</SectionTitle>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          maxLength={50}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={scrollOnFocus}
          enterKeyHint="done"
          className={BARE_INPUT}
        />
        <Button type="submit" disabled={busy || !text.trim()} className="shrink-0 rounded-xl">
          + Додати
        </Button>
      </form>
      {error && <Banner tone="error">{error}</Banner>}
      {!rows.length ? (
        <p className={cn(HINT_CLASS, 'py-2 text-sm')}>{empty}</p>
      ) : (
        <ul className={LIST_CLASS}>
          {rows.map((row, index) => (
            <li key={row.id}>
              <div className="flex items-center gap-1 py-1 pl-4 pr-1">
                {editing === row.id ? (
                  <input
                    autoFocus
                    aria-label={`Нова назва: ${row.name}`}
                    defaultValue={row.name}
                    maxLength={50}
                    enterKeyHint="done"
                    onBlur={(e) => void rename(row, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-brand-cyan bg-bg px-2.5 py-2 text-base font-bold outline-none"
                  />
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-extrabold leading-snug [overflow-wrap:anywhere]">
                      {row.name}
                    </p>
                    <p className="text-xs text-subtle">Товарів: {row.products}</p>
                  </div>
                )}
                <MoveButtons
                  first={index === 0}
                  last={index === rows.length - 1}
                  label={row.name}
                  onMove={(direction) => move(row.id, direction)}
                  className={NARROW}
                />
                <button
                  type="button"
                  aria-label={`Перейменувати: ${row.name}`}
                  onClick={() => setEditing(row.id)}
                  className={cn(ROUND_BUTTON, NARROW)}
                >
                  <Icon d={ICONS.pencil} />
                </button>
                <button
                  type="button"
                  aria-label={`Видалити: ${row.name}`}
                  onClick={() => removal.tap(row.id, () => void remove(row))}
                  className={cn(
                    ROUND_BUTTON,
                    NARROW,
                    removal.armed === row.id ? 'bg-brand-red/15 text-brand-red' : 'hover:text-brand-red',
                  )}
                >
                  <Icon d={ICONS.close} />
                </button>
              </div>
              {removal.armed === row.id && (
                <p role="alert" className="px-4 pb-2.5 text-[13px] font-bold text-brand-red">
                  {asks(row.name)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LabelsScreen() {
  const { state, error, refresh, patch } = useAdminState();
  return (
    <div className="space-y-6">
      <ScreenHead title="Категорії і теги" />
      {!state ? (
        <Gate error={error} refresh={refresh} />
      ) : (
        <>
          <NameList
            kind="category"
            title="Категорії"
            rows={state.categories}
            placeholder="Нова категорія"
            empty="Категорій ще немає."
            asks={(name) => `Видалити «${name}»? Товари залишаться без категорії.`}
            refresh={refresh}
            patch={patch}
          />
          <NameList
            kind="tag"
            title="Теги"
            rows={state.tags}
            placeholder="Новий тег"
            empty="Тегів ще немає."
            asks={(name) => `Видалити «${name}»? Тег зникне з товарів.`}
            refresh={refresh}
            patch={patch}
          />
        </>
      )}
    </div>
  );
}
