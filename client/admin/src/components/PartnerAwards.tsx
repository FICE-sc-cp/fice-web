'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openTelegramLink } from '@telegram-apps/sdk';
import {
  api,
  mediaUrl,
  type EventPartner,
  type EventVoting,
  type PartnerAward,
  type PartnerAwardInput,
} from '@/lib/api';
import { hapticNotify } from '@/lib/telegram';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { FormError } from './ui/FormError';

// Special awards inside a nomination: a partner picks a winner on their own
// (by a personal link, or the organizer enters it), revealed after 1st place.

const PODIUM = [
  { n: '3', label: '3 місце', bg: 'linear-gradient(90deg, #ff8904 0%, #fb2c36 100%)' },
  { n: '2', label: '2 місце', bg: 'linear-gradient(90deg, #00e3f3 0%, #2b7fff 100%)' },
  { n: '1', label: 'Переможець', bg: 'linear-gradient(90deg, #2eff97 -19.71%, #36dfff 48.48%, #ad46ff 116.67%)' },
];

function partnerLabel(ep: EventPartner) {
  return ep.name ?? ep.partner?.name ?? 'Партнер';
}

function LogoTile({ src, name, className }: { src: string | null; name: string; className: string }) {
  const url = mediaUrl(src);
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ${className}`}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain p-1" />
      ) : (
        <span className="text-[10px] font-extrabold text-[#55555e]">{name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export function PartnerAwards({
  eventId,
  voting,
  partners,
}: {
  eventId: string;
  voting: EventVoting;
  partners: EventPartner[];
}) {
  const qc = useQueryClient();
  // null = closed, 'new' = create form, award = edit form
  const [form, setForm] = useState<'new' | PartnerAward | null>(null);
  const awards = voting.partnerAwards ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['event-votings', eventId] });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.reorderPartnerAwards(voting.id, ids),
    onSuccess: invalidate,
  });

  const move = (idx: number, d: -1 | 1) => {
    const ids = awards.map((a) => a.id);
    [ids[idx], ids[idx + d]] = [ids[idx + d], ids[idx]];
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Спецвідзнаки від партнерів ({awards.length})
        </span>
        <p className="text-[11px] leading-relaxed text-subtle">
          Партнер сам обирає переможця серед кандидатів цієї номінації. Голоси для цього не
          потрібні й ніде не показуються. На екрані — окремий крок церемонії після 1 місця.
        </p>
      </div>

      {awards.map((a) =>
        form !== 'new' && form?.id === a.id ? (
          <AwardForm
            key={a.id}
            voting={voting}
            partners={partners}
            award={a}
            onDone={() => setForm(null)}
          />
        ) : (
          <AwardCard key={a.id} award={a} voting={voting} onEdit={() => setForm(a)} />
        ),
      )}

      {form === 'new' ? (
        <AwardForm voting={voting} partners={partners} onDone={() => setForm(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setForm('new')}
          className="min-h-12 w-full rounded-xl border-[1.5px] border-dashed border-[#3f3f46] text-sm font-extrabold text-brand-cyan transition-colors hover:border-brand-cyan"
        >
          + Додати спецвідзнаку
        </button>
      )}

      {awards.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-bg/40 p-3">
          <div>
            <div className="text-xs font-bold text-fg">Сценарій церемонії</div>
            <p className="text-[11px] text-subtle">Порядок кроків на пульті екрана.</p>
          </div>
          <ol className="flex flex-col gap-1.5">
            {PODIUM.map((p) => (
              <li key={p.n} className="flex min-h-11 items-center gap-2.5 rounded-xl bg-surface-2 px-3">
                <span className="flex size-[22px] items-center justify-center rounded-md text-xs font-black text-black" style={{ background: p.bg }}>
                  {p.n}
                </span>
                <span className="flex-1 text-sm font-bold">{p.label}</span>
              </li>
            ))}
            {awards.map((a, idx) => (
              <li
                key={a.id}
                className={`flex min-h-11 items-center gap-2.5 rounded-xl border bg-surface-2 px-3 ${
                  a.candidateId ? 'border-brand-green/30' : 'border-brand-orange/35'
                }`}
              >
                <LogoTile src={a.partnerLogo} name={a.partnerName} className="size-[22px] rounded-md" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">Вибір {a.partnerName}</span>
                {!a.candidateId && <span className="text-[11px] font-extrabold text-brand-orange">чекаємо</span>}
                <button
                  type="button"
                  aria-label={`Перемістити «${a.partnerName}» вище`}
                  disabled={idx === 0 || reorder.isPending}
                  onClick={() => move(idx, -1)}
                  className="flex size-9 items-center justify-center rounded-lg text-muted hover:text-fg disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Перемістити «${a.partnerName}» нижче`}
                  disabled={idx === awards.length - 1 || reorder.isPending}
                  onClick={() => move(idx, 1)}
                  className="flex size-9 items-center justify-center rounded-lg text-muted hover:text-fg disabled:opacity-30"
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-subtle">Відзнаку без вибору екран пропустить.</p>
          <FormError error={reorder.error} />
        </div>
      )}
    </div>
  );
}

function AwardCard({ award: a, voting, onEdit }: { award: PartnerAward; voting: EventVoting; onEdit: () => void }) {
  const qc = useQueryClient();
  const [reveal, setReveal] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualId, setManualId] = useState('');
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  const picked = voting.candidates.find((c) => c.id === a.candidateId);
  const approved = voting.candidates.filter((c) => (c.status ?? 'APPROVED') === 'APPROVED');

  const done = () => {
    qc.invalidateQueries({ queryKey: ['event-votings', voting.eventId] });
    hapticNotify('success');
  };
  const update = useMutation({
    mutationFn: (candidateId: string | null) => api.updatePartnerAward(a.id, { candidateId }),
    onSuccess: () => {
      done();
      setManual(false);
      setReveal(false);
    },
  });
  const remove = useMutation({ mutationFn: () => api.deletePartnerAward(a.id), onSuccess: done });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(a.pickUrl);
      hapticNotify('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      linkRef.current?.select();
    }
  };

  const sendToTelegram = () => {
    const text = `Оберіть переможця спецвідзнаки «${a.title}» у номінації «${voting.title}»`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(a.pickUrl)}&text=${encodeURIComponent(text)}`;
    if (openTelegramLink.isAvailable()) openTelegramLink(url);
    else window.open(url, '_blank', 'noopener');
  };

  const linkId = `pick-link-${a.id}`;
  const manualSelectId = `pick-manual-${a.id}`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-3.5">
      <div className="flex items-center gap-3">
        <LogoTile src={a.partnerLogo} name={a.partnerName} className="h-10 w-14" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 break-words">
          <span className="text-[15px] font-extrabold">{a.partnerName}</span>
          <span className="text-xs text-muted">
            {a.title}
            {a.prize ? ` · Приз: ${a.prize}` : ''}
          </span>
        </div>
      </div>

      {a.candidateId ? (
        <>
          <div className="flex items-center gap-2 rounded-[10px] border border-brand-green/30 bg-brand-green/10 px-3 py-2.5 text-[13px] font-extrabold text-brand-green">
            <LockIcon />
            <span>{reveal && picked ? `Вибір: ${picked.name}` : 'Обрано · запечатано до церемонії'}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-[13px] font-bold text-fg hover:border-white/30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>{reveal ? 'Сховати вибір' : 'Показати вибір'}</span>
            </button>
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => {
                if (confirm('Скинути вибір партнера? Партнер зможе обрати знову.')) update.mutate(null);
              }}
              className="min-h-11 rounded-xl px-3.5 text-[13px] font-bold text-muted hover:text-fg"
            >
              Скинути
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-[10px] border border-brand-orange/35 bg-brand-orange/10 px-3 py-2.5 text-[13px] font-extrabold text-brand-orange">
            <ClockIcon />
            <span>{a.partnerPicks ? 'Чекаємо на вибір партнера' : 'Внесіть вибір, який назвав партнер'}</span>
          </div>

          {a.partnerPicks && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={linkId} className="text-xs font-bold text-muted">
                Особисте посилання для партнера
              </label>
              <div className="flex gap-2">
                <input
                  id={linkId}
                  ref={linkRef}
                  readOnly
                  value={a.pickUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 text-[13px] text-fg outline-none focus:border-brand-cyan"
                />
                <button
                  type="button"
                  onClick={copy}
                  aria-label="Копіювати посилання"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-fg hover:border-brand-cyan"
                >
                  {copied ? (
                    <span className="text-brand-green" aria-hidden="true">✓</span>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="12" height="12" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                  )}
                </button>
              </div>
              <span className="sr-only" aria-live="polite">{copied ? 'Посилання скопійовано' : ''}</span>
            </div>
          )}

          {manual ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={manualSelectId} className="text-xs font-bold text-muted">
                Кого обрав партнер
              </label>
              <select
                id={manualSelectId}
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-brand-cyan"
              >
                <option value="">Оберіть кандидата</option>
                {approved.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.description ? ` · ${c.description}` : ''}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setManual(false)} className="min-h-11 px-3 text-[13px] font-bold text-muted">
                  Скасувати
                </button>
                <Button
                  type="button"
                  disabled={!manualId || update.isPending}
                  onClick={() => update.mutate(manualId)}
                  className="min-h-11 px-4 py-0 text-[13px]"
                >
                  Зберегти вибір
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {a.partnerPicks && (
                <Button type="button" onClick={sendToTelegram} className="min-h-11 flex-1 px-3 py-0 text-[13px] font-extrabold">
                  Надіслати в Telegram
                </Button>
              )}
              <button
                type="button"
                onClick={() => setManual(true)}
                className={`min-h-11 rounded-xl border border-border px-3.5 text-[13px] font-bold text-fg hover:border-white/30 ${a.partnerPicks ? '' : 'flex-1'}`}
              >
                Внести вручну
              </button>
            </div>
          )}
        </>
      )}
      <FormError error={update.error ?? remove.error} />
      <div className="-mb-1 flex justify-end gap-1 border-t border-border pt-1.5">
        <button type="button" onClick={onEdit} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-brand-cyan hover:underline">
          Змінити
        </button>
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm(`Видалити спецвідзнаку від «${a.partnerName}»?`)) remove.mutate();
          }}
          className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-red-400 hover:text-red-300"
        >
          Видалити
        </button>
      </div>
    </div>
  );
}

function AwardForm({
  voting,
  partners,
  award,
  onDone,
}: {
  voting: EventVoting;
  partners: EventPartner[];
  award?: PartnerAward;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const taken = new Set((voting.partnerAwards ?? []).map((a) => a.eventPartnerId));
  const [partnerId, setPartnerId] = useState(
    award?.eventPartnerId ?? partners.find((p) => !taken.has(p.id))?.id ?? '',
  );
  const [title, setTitle] = useState(award?.title ?? 'Вибір партнера');
  const [prize, setPrize] = useState(award?.prize ?? '');
  const [partnerPicks, setPartnerPicks] = useState(award?.partnerPicks ?? true);
  const [showLogo, setShowLogo] = useState(award?.showLogo ?? true);

  const save = useMutation({
    mutationFn: () => {
      const body: Omit<PartnerAwardInput, 'eventPartnerId'> = {
        title: title.trim(),
        prize: prize.trim(),
        partnerPicks,
        showLogo,
      };
      return award
        ? api.updatePartnerAward(award.id, { ...body, prize: body.prize || null })
        : api.createPartnerAward(voting.id, { ...body, eventPartnerId: partnerId, prize: body.prize || undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-votings', voting.eventId] });
      hapticNotify('success');
      onDone();
    },
    onError: () => hapticNotify('error'),
  });

  const idBase = award?.id ?? `new-${voting.id}`;
  const whoOption = (value: boolean, head: string, text: string) => (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl p-3 ${
        partnerPicks === value ? 'border-[1.5px] border-brand-green bg-brand-green/5' : 'border border-border bg-surface-2'
      }`}
    >
      <input
        type="radio"
        name={`who-${idBase}`}
        checked={partnerPicks === value}
        onChange={() => setPartnerPicks(value)}
        className="mt-0.5 accent-brand-green"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-extrabold">{head}</span>
        <span className="text-xs leading-relaxed text-muted">{text}</span>
      </span>
    </label>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="flex flex-col gap-4 rounded-2xl border border-brand-cyan bg-surface p-4"
    >
      <h4 className="text-[15px] font-black">{award ? `Спецвідзнака: ${award.partnerName}` : 'Нова спецвідзнака'}</h4>

      {!award && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-bold">Партнер заходу</legend>
          {partners.length === 0 ? (
            <p className="text-xs text-muted">
              У заходу ще немає партнерів.{' '}
              <Link href={`/events/${voting.eventId}`} className="font-semibold text-brand-cyan hover:underline">
                Додайте їх у налаштуваннях заходу
              </Link>
              , тоді поверніться сюди.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {partners.map((p) => {
                  const busy = taken.has(p.id);
                  const on = partnerId === p.id;
                  return (
                    <label
                      key={p.id}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-[13px] font-bold ${
                        busy
                          ? 'border border-border bg-surface-2 text-subtle'
                          : on
                            ? 'border-[1.5px] border-brand-green bg-brand-green/10 text-fg'
                            : 'border border-border bg-surface-2 text-fg'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`partner-${idBase}`}
                        disabled={busy}
                        checked={on}
                        onChange={() => setPartnerId(p.id)}
                        className="accent-brand-green"
                      />
                      <span>
                        {partnerLabel(p)}
                        {busy ? ' · вже є' : ''}
                      </span>
                    </label>
                  );
                })}
              </div>
              <span className="text-xs text-subtle">Список — з партнерів, доданих до заходу</span>
            </>
          )}
        </fieldset>
      )}

      <Input id={`award-title-${idBase}`} label="Назва відзнаки" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} required />
      <Input
        id={`award-prize-${idBase}`}
        label="Приз (необовʼязково)"
        placeholder="Що отримає переможець"
        value={prize}
        maxLength={160}
        onChange={(e) => setPrize(e.target.value)}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-bold">Хто обирає переможця</legend>
        {whoOption(true, 'Партнер — за посиланням', 'Бачить лише кандидатів, без голосів. Вибір запечатується до церемонії.')}
        {whoOption(false, 'Організатор — вношу сам', 'Коли партнер повідомив вибір усно чи в месенджері.')}
      </fieldset>

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-bold">Логотип на екрані голосування</span>
          <span className="text-xs text-muted">«+ спецвідзнака від партнера» під QR-кодом</span>
        </span>
        <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} className="size-[22px] shrink-0 accent-brand-green" />
      </label>

      <FormError error={save.error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="min-h-11 px-4 text-sm font-bold text-muted">
          Скасувати
        </button>
        <Button type="submit" disabled={save.isPending || !title.trim() || (!award && !partnerId)} className="min-h-11 px-5 py-0">
          {save.isPending ? 'Зберігаємо…' : award ? 'Зберегти' : 'Створити'}
        </Button>
      </div>
    </form>
  );
}
