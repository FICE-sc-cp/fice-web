'use client';

import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type ScreenCommand,
  type ScreenMode,
  type ScreenState,
  type ScreenTheme,
  type ScreenView,
} from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { FormError } from '@/components/ui/FormError';
import { Spinner } from '@/components/ui/Spinner';
import { haptic, hapticNotify } from '@/lib/telegram';

// Remote for the stage screen: the screen polls this state about once a second,
// so the operator never has to touch the screen (or its mouse).

const MODES: [ScreenMode, string][] = [
  ['live', 'Голосування'],
  ['closed', 'Підсумок'],
  ['ceremony', 'Церемонія'],
];
const THEMES: [ScreenTheme, string, string][] = [
  ['fice', 'FICE', 'linear-gradient(90deg, #2eff97 -19.71%, #36dfff 48.48%, #ad46ff 116.67%)'],
  ['ny', 'Новий рік', 'linear-gradient(135deg, #0f2748, #ffc24d)'],
  ['hw', 'Хелловін', 'linear-gradient(135deg, #2a1640, #ff7a1a)'],
  ['ball', 'Бал', 'linear-gradient(90deg, #b8893a, #f1d594 50%, #b8893a)'],
];
const VIEWS: [ScreenView, string][] = [
  ['auto', 'Авто'],
  ['grid', 'Сітка'],
  ['show', 'По одному'],
];
// The screen's ceremony steps (the podium); partner awards are shown separately.
const STEP_NAMES = ['вступ', 'інтрига · 3 місце', '3 місце', 'інтрига · 2 місце', '2 місце', 'інтрига · переможець', 'переможець'];
const STEP_ACTIONS = ['вступ', 'інтрига 3 місця', 'відкрити 3 місце', 'інтрига 2 місця', 'відкрити 2 місце', 'інтрига переможця', 'відкрити переможця'];

const seg = (on: boolean) =>
  `min-h-12 rounded-xl px-2 text-sm font-extrabold transition-colors ${on ? 'bg-gradient-main text-black' : 'text-muted hover:text-fg'}`;
const pad =
  'min-h-14 rounded-2xl border border-border bg-surface text-sm font-extrabold text-fg transition-colors hover:border-white/30 disabled:opacity-40';

export default function ScreenRemotePage() {
  const { id: eventId, votingId } = useParams<{ id: string; votingId: string }>();
  const qc = useQueryClient();
  const key = ['screen-state', votingId];

  const info = useQuery({
    queryKey: ['voting-screen', votingId],
    queryFn: () => api.votingScreen(votingId),
    refetchInterval: 15_000,
  });
  // Picks up changes from another operator's phone.
  const state = useQuery({
    queryKey: key,
    queryFn: () => api.screenState(votingId),
    refetchInterval: 4_000,
  });

  const send = useMutation({
    mutationFn: (cmd: ScreenCommand) => api.updateScreenState(votingId, cmd),
    onMutate: async (cmd) => {
      haptic('light');
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<ScreenState>(key, (old) => {
        const next = { ...(old ?? { rev: 0 }) };
        if (cmd.mode) next.mode = cmd.mode;
        if (cmd.theme) next.theme = cmd.theme;
        if (cmd.view) next.view = cmd.view;
        if (cmd.step !== undefined) next.step = cmd.step;
        // Same rules as the API: a mode switch puts a shown partner award away.
        if (cmd.award !== undefined) {
          next.award = cmd.award;
          next.awardOpen = cmd.awardOpen ?? false;
        } else if (cmd.mode) {
          next.award = null;
          next.awardOpen = false;
        } else if (cmd.awardOpen !== undefined) next.awardOpen = cmd.awardOpen;
        return next;
      });
    },
    onSuccess: (res) => qc.setQueryData(key, res),
    onError: () => {
      hapticNotify('error');
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const header = <PageHeader title="Пульт екрана" backHref={`/events/${eventId}/voting`} />;
  if (info.error || state.error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6">
        {header}
        <FormError error={info.error ?? state.error} />
      </main>
    );
  }
  if (!info.data || !state.data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6">
        {header}
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </main>
    );
  }

  const st = state.data;
  const v = info.data;
  const places = new Set(v.winners.map((w) => w.place));
  const steps = [0, ...(places.has(3) ? [1, 2] : []), ...(places.has(2) ? [3, 4] : []), ...(places.has(1) ? [5, 6] : [])];
  const idx = Math.max(0, steps.findLastIndex((s) => s <= (st.step ?? 0)));
  const last = idx >= steps.length - 1;
  const mode = st.mode ?? (v.voting.status === 'CLOSED' ? 'closed' : 'live');
  const view = st.view ?? 'auto';
  const awards = v.partnerAwards ?? [];
  const shownAward = mode === 'ceremony' ? st.award : null;
  // Moving the podium on also puts a shown partner award away.
  const toStep = (step: number) => send.mutate(shownAward ? { step, award: null } : { step });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      {header}
      <p className="-mt-3 mb-5 text-sm text-muted">
        {v.voting.title} · {v.voting.eventName}
      </p>

      <section className="mb-5 space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Що на екрані</h2>
        <div role="group" aria-label="Режим екрана" className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface p-1">
          {MODES.map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => send.mutate({ mode: m, step: 0 })} className={seg(mode === m)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {mode === 'live' && (
        <section className="mb-5 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Показ образів</h2>
          <div role="group" aria-label="Показ образів" className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface p-1">
            {VIEWS.map(([w, label]) => (
              <button key={w} type="button" aria-pressed={view === w} onClick={() => send.mutate({ view: w })} className={seg(view === w)}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={v.candidates.length === 0} onClick={() => send.mutate({ nav: -1 })} className={pad}>
              ‹ Попередній образ
            </button>
            <button type="button" disabled={v.candidates.length === 0} onClick={() => send.mutate({ nav: 1 })} className={pad}>
              Наступний образ ›
            </button>
          </div>
          <p className="text-xs text-subtle">
            Авто: сітка 10 с, потім кожен образ по 5 с і по колу. Стрілки показують інший образ і запускають відлік знову.
          </p>
        </section>
      )}

      {mode === 'closed' && (
        <p className="mb-5 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          На екрані «Голоси пораховано» — сітка образів без переможців.
        </p>
      )}

      {mode === 'ceremony' && (
        <section className="mb-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Церемонія</h2>
          <div aria-hidden="true" className="flex gap-1">
            {steps.map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-gradient-main' : 'bg-border'}`} />
            ))}
          </div>
          <p className="text-sm font-bold" aria-live="polite">
            Крок {idx + 1} з {steps.length} · {STEP_NAMES[steps[idx]]}
          </p>
          <button
            type="button"
            disabled={last}
            onClick={() => toStep(steps[idx + 1])}
            className="min-h-16 w-full rounded-2xl bg-gradient-main px-4 text-base font-black text-black disabled:opacity-45"
          >
            {last ? 'Сценарій завершено' : `Далі: ${STEP_ACTIONS[steps[idx + 1]]}`}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" disabled={idx === 0} onClick={() => toStep(steps[idx - 1])} className={pad}>
              ‹ Назад
            </button>
            <button type="button" onClick={() => send.mutate({ salute: true })} className={pad}>
              Салют
            </button>
            <button type="button" onClick={() => toStep(0)} className={pad}>
              З початку
            </button>
          </div>
        </section>
      )}

      {awards.length > 0 && (
        <section className="mb-5 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Спецвідзнаки партнерів</h2>
          <p className="text-xs text-subtle">Показуються окремо від кроків: спершу інтрига, потім вибір партнера. Потім «Сховати» — і екран повертається до церемонії.</p>
          {awards.map((a) => {
            const shown = shownAward === a.id;
            return (
              <div key={a.id} className={`space-y-2 rounded-2xl border p-3 ${shown ? 'border-brand-green bg-brand-green/5' : 'border-border bg-surface'}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-extrabold">{a.partnerName}</span>
                  <span className="truncate text-xs text-muted">{a.title}</span>
                </div>
                {!a.pick ? (
                  <p className="text-xs font-bold text-brand-orange">Партнер ще не обрав</p>
                ) : shown ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={st.awardOpen}
                      onClick={() => send.mutate({ awardOpen: true })}
                      className="min-h-14 rounded-2xl bg-gradient-main px-3 text-sm font-black text-black disabled:opacity-45"
                    >
                      {st.awardOpen ? 'Вибір відкрито' : 'Відкрити вибір'}
                    </button>
                    <button type="button" onClick={() => send.mutate({ award: null })} className={pad}>
                      Сховати
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => send.mutate(mode === 'ceremony' ? { award: a.id } : { mode: 'ceremony', step: 0, award: a.id })}
                    className={`${pad} w-full`}
                  >
                    Показати на екрані
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="mb-5 space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Тема</h2>
        <div role="group" aria-label="Тема екрана" className="grid grid-cols-2 gap-2">
          {THEMES.map(([th, label, swatch]) => (
            <button
              key={th}
              type="button"
              aria-pressed={st.theme === th}
              onClick={() => send.mutate({ theme: th })}
              className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-sm font-bold ${st.theme === th ? 'border-brand-green bg-brand-green/10 text-fg' : 'border-border bg-surface text-muted'}`}
            >
              <span aria-hidden="true" className="size-4 shrink-0 rounded-full" style={{ background: swatch }} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <FormError error={send.error} />

      <p className="mt-6 rounded-2xl border border-border bg-bg/40 p-4 text-xs leading-relaxed text-muted">
        Екран підхоплює зміни приблизно за секунду. Його власний пульт сховано, щоб випадковий рух мишки нічого не
        показав; відкрити його можна клавішею M, на весь екран — F.
      </p>
    </main>
  );
}
