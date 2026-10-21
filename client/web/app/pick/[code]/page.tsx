'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ApiError, fice, mediaUrl, type PartnerPickCandidate, type PartnerPickData } from '@/lib/api';

// A partner's personal page: pick the winner of their special award among the
// nomination's candidates. The pick stays sealed until the ceremony.

const CSS = `
.sheet{animation:sheet .35s cubic-bezier(.2,.8,.2,1) both}
@keyframes sheet{from{transform:translateY(100%)}to{transform:none}}
.fade{animation:fade .3s ease both}
@keyframes fade{from{opacity:0}to{opacity:1}}
.pop{animation:pop .6s cubic-bezier(.3,1.6,.5,1) both}
@keyframes pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.sheet,.fade,.pop{animation:none}}
`;

function Thumb({ c }: { c: PartnerPickCandidate }) {
  const src = mediaUrl(c.photoUrl);
  return (
    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
      {src ? (
        <>
          <img src={src} alt="" aria-hidden="true" className="absolute -left-[14%] -top-[14%] h-[128%] w-[128%] object-cover blur-[10px] brightness-[.55]" />
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain" />
        </>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-muted">
          {c.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function Who({ c }: { c: PartnerPickCandidate }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-base font-extrabold text-white">{c.name}</span>
      {c.description && <span className="text-xs font-bold tracking-[0.1em] text-[#8a8a93]">{c.description}</span>}
    </span>
  );
}

const LockIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default function PartnerPickPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<PartnerPickData | null>(null);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [screen, setScreen] = useState<'list' | 'confirm' | 'done'>('list');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const show = useCallback((d: PartnerPickData) => {
    setData(d);
    setSelected(d.candidateId);
    setScreen(d.candidateId || d.locked ? 'done' : 'list');
  }, []);

  const load = useCallback(() => {
    setLoadError(null);
    fice
      .partnerPick(code)
      .then(show)
      .catch((e: unknown) =>
        setLoadError({
          status: e instanceof ApiError ? e.status : 0,
          message: e instanceof Error ? e.message : 'Не вдалося завантажити сторінку',
        }),
      );
  }, [code, show]);

  useEffect(load, [load]);

  useEffect(() => {
    if (screen !== 'confirm') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setScreen('list');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      show(await fice.setPartnerPick(code, selected));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Не вдалося зберегти вибір');
      // The voting may have closed meanwhile: reload to show the real state.
      if (e instanceof ApiError && e.status === 403) load();
    } finally {
      setSaving(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <main className="min-h-dvh bg-[#0a0a0c] text-white">
      <style>{CSS}</style>
      <div className="relative mx-auto flex min-h-dvh max-w-[420px] flex-col">{children}</div>
    </main>
  );

  if (loadError) {
    const invalid = loadError.status === 404;
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-black">{invalid ? 'Посилання недійсне' : 'Не вдалося завантажити'}</h1>
        <p className="text-[15px] leading-relaxed text-[#d3d3d3]">
          {invalid ? 'Перевірте посилання або попросіть організаторів надіслати нове.' : loadError.message}
        </p>
        {!invalid && (
          <button type="button" onClick={load} className="min-h-11 rounded-xl border border-border px-5 text-sm font-extrabold">
            Спробувати ще раз
          </button>
        )}
      </div>,
    );
  }

  if (!data) {
    return shell(
      <p className="flex flex-1 items-center justify-center text-sm font-bold text-[#8a8a93]" role="status">
        Завантаження…
      </p>,
    );
  }

  const sel = data.candidates.find((c) => c.id === selected) ?? null;
  const logo = mediaUrl(data.partnerLogo);

  if (screen === 'done') {
    const mine = data.candidates.find((c) => c.id === data.candidateId);
    return shell(
      <div className="fade flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-10 pt-6 text-center">
        <div className="pop flex size-[120px] items-center justify-center rounded-full bg-gradient-main text-black">
          <LockIcon size={56} />
        </div>
        {mine ? (
          <>
            <h1 className="text-[28px] font-black leading-tight">Вибір запечатано</h1>
            <p className="text-[15px] leading-relaxed text-[#d3d3d3]">
              Ми оголосимо його на великому екрані під час церемонії. Дякуємо, що ви з нами!
            </p>
            <div className="flex w-full items-center justify-between gap-3 rounded-[14px] border border-border bg-surface p-3.5">
              <span className="text-sm font-bold text-[#d3d3d3]">Ваш вибір</span>
              <span className="text-[15px] font-extrabold">{mine.name}</span>
            </div>
            {data.locked ? (
              <p className="text-[13px] text-[#8a8a93]">Голосування завершено — вибір уже не змінити.</p>
            ) : (
              <button type="button" onClick={() => setScreen('list')} className="min-h-11 px-4 text-sm font-extrabold text-brand-cyan">
                Змінити вибір
              </button>
            )}
          </>
        ) : (
          <>
            <h1 className="text-[28px] font-black leading-tight">Голосування завершено</h1>
            <p className="text-[15px] leading-relaxed text-[#d3d3d3]">
              Вибір уже не приймається. Якщо ви ще не встигли обрати — напишіть організаторам.
            </p>
          </>
        )}
      </div>,
    );
  }

  return shell(
    <>
      <div className="flex flex-col gap-4 px-4 pb-32 pt-6">
        <div className="flex items-center gap-2.5">
          <img src="/logo_white.png" alt="FICE" className="block h-6 w-auto" />
          <span aria-hidden="true" className="font-bold text-[#8a8a93]">
            ×
          </span>
          <span className="flex h-8 items-center rounded-lg bg-white px-3 text-xs font-extrabold text-[#55555e]">
            {logo ? <img src={logo} alt={data.partnerName} className="h-5 w-auto max-w-[140px] object-contain" /> : data.partnerName}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-black leading-tight">Оберіть свого переможця</h1>
          <p className="text-sm leading-relaxed text-[#d3d3d3]">
            Номінація «{data.voting.title}». Голосів тут немає — обирайте на власний смак.
          </p>
        </div>

        {data.candidates.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-[#d3d3d3]">
            Кандидатів ще немає. Загляньте сюди трохи згодом.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.candidates.map((c) => {
              const on = selected === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected(c.id)}
                    className={`w-full rounded-2xl p-0.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan ${on ? 'bg-gradient-main' : 'bg-border'}`}
                  >
                    <span className={`flex min-h-[72px] items-center gap-3 rounded-[14px] py-2 pl-2 pr-3 ${on ? 'bg-[#121216]' : 'bg-surface'}`}>
                      <Thumb c={c} />
                      <span className="flex-1">
                        <Who c={c} />
                      </span>
                      <span
                        aria-hidden="true"
                        className={`size-6 shrink-0 rounded-full border-2 ${on ? 'border-brand-green bg-brand-green' : 'border-[#3f3f46]'}`}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[420px] -translate-x-1/2 bg-gradient-to-b from-transparent via-[#0a0a0c] via-30% to-[#0a0a0c] px-4 pb-7 pt-3.5">
        <button
          type="button"
          disabled={!sel}
          onClick={() => {
            setSaveError(null);
            setScreen('confirm');
          }}
          className={`min-h-[52px] w-full rounded-[14px] text-base font-black ${sel ? 'bg-gradient-main text-black' : 'bg-surface-2 text-[#8a8a93]'}`}
        >
          {sel ? `Обрати: ${sel.name}` : 'Оберіть кандидата'}
        </button>
      </div>

      {screen === 'confirm' && sel && (
        <>
          <div className="fade fixed inset-0 bg-black/60" onClick={() => setScreen('list')} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pick-confirm-title"
            className="sheet fixed bottom-0 left-1/2 flex w-full max-w-[420px] -translate-x-1/2 flex-col gap-4 rounded-t-3xl border-t border-border bg-surface px-5 pb-8 pt-6"
          >
            <div aria-hidden="true" className="h-1 w-10 self-center rounded-full bg-[#3f3f46]" />
            <h2 id="pick-confirm-title" className="text-[22px] font-black">
              Підтвердити вибір?
            </h2>
            <div className="flex items-center gap-3 rounded-[14px] bg-surface-2 p-2.5">
              <Thumb c={sel} />
              <Who c={sel} />
            </div>
            <p className="text-sm leading-relaxed text-[#d3d3d3]">
              Вибір запечатається — до церемонії його не побачить навіть ведучий. Змінити можна, поки голосування не
              завершилося.
            </p>
            {saveError && (
              <p role="alert" className="rounded-xl border border-brand-red/40 bg-brand-red/10 px-3 py-2 text-sm text-brand-red">
                {saveError}
              </p>
            )}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setScreen('list')}
                className="min-h-[52px] flex-1 rounded-[14px] border border-border text-[15px] font-extrabold"
              >
                Назад
              </button>
              <button
                type="button"
                autoFocus
                disabled={saving}
                onClick={confirm}
                className="min-h-[52px] flex-[2] rounded-[14px] bg-gradient-main text-[15px] font-black text-black disabled:opacity-60"
              >
                {saving ? 'Зберігаємо…' : 'Підтвердити'}
              </button>
            </div>
          </div>
        </>
      )}
    </>,
  );
}
