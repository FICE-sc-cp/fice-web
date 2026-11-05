'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AdminSlot } from '@/lib/merch-types';
import { cn } from '@/lib/utils';
import { Banner, DANGER_CLASS, Empty, PANEL_CLASS, useAction, useSurface } from '../ui';
import { Gate, LIST_CLASS, ScreenHead, failText, saving, useTwoTap } from './kit';
import { useAdminState } from './useAdminState';

const DAY = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'long',
  weekday: 'short',
  timeZone: 'UTC',
});

const dayText = (date: string) => {
  const text = DAY.format(new Date(`${date}T00:00:00Z`));
  return text[0].toUpperCase() + text.slice(1);
};

export function SlotsScreen() {
  const { api, toast } = useSurface();
  const { state, error, refresh } = useAdminState();
  const { busy, error: createError, setError, run } = useAction();
  const removal = useTwoTap();
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const create = async () => {
    if (end <= start) {
      setError('Кінець має бути пізніше за початок.');
      return;
    }
    const body = { date, startTime: start, endTime: end };
    if (await run(() => saving(api.admin.createSlot(body)))) {
      // The day stays: slots usually come in a row on one date.
      setStart('');
      setEnd('');
      await refresh();
    }
  };

  const remove = async (slot: AdminSlot) => {
    try {
      const { deactivated } = await api.admin.deleteSlot(slot.id);
      toast(deactivated ? 'Слот вимкнено: на ньому є замовлення' : 'Видалено');
      await refresh();
    } catch (err) {
      toast(failText(err));
    }
  };

  return (
    <div className="space-y-5">
      <ScreenHead title="Слоти видачі" />
      {!state ? (
        <Gate error={error} refresh={refresh} />
      ) : (
        <>
          {error && <Banner tone="error">{error}</Banner>}
          <form
            className={cn(PANEL_CLASS, 'space-y-3')}
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Input
              label="Дата"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="[color-scheme:dark]"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label="Початок"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="[color-scheme:dark]"
              />
              <Input
                label="Кінець"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="[color-scheme:dark]"
              />
            </div>
            {createError && <Banner tone="error">{createError}</Banner>}
            <Button
              type="submit"
              disabled={busy || !date || !start || !end}
              className="w-full rounded-2xl py-3.5 font-extrabold"
            >
              {busy ? 'Додаємо...' : 'Додати слот'}
            </Button>
          </form>

          {!state.slots.length ? (
            <Empty icon="🗓" title="Немає жодного слота" />
          ) : (
            <ul className={LIST_CLASS}>
              {state.slots.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={cn('min-w-0 flex-1', !s.isActive && 'opacity-60')}>
                    <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-extrabold leading-snug">
                      {dayText(s.date)}
                      {!s.isActive && (
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                          Вимкнено
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] font-semibold tabular-nums text-muted">
                      {s.startTime} - {s.endTime}
                    </p>
                    <p className="text-xs text-subtle">Замовлень: {s.orders}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removal.tap(s.id, () => void remove(s))}
                    className={cn(
                      DANGER_CLASS,
                      'min-h-11 shrink-0 px-3.5',
                      removal.armed === s.id && 'max-w-[10.5rem] leading-tight',
                    )}
                  >
                    {removal.armed === s.id ? 'Натисніть ще раз для підтвердження' : 'Видалити'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
