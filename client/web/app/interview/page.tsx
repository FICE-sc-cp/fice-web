'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useTelegram } from '@/lib/telegram';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn, plural } from '@/lib/utils';
import {
  STATUS_LABEL,
  byDay,
  candidateName,
  fmtDay,
  fmtDayTitle,
  fmtTime,
  interviewApi,
  kyivDate,
  type ApplicantRow,
  type Candidacy,
  type Candidate,
  type InterviewApi,
  type InterviewMe,
  type InterviewStatus,
  type SlotTime,
  type StaffDepartment,
} from '@/lib/interview';

type Tg = ReturnType<typeof useTelegram>;
interface Ctx {
  me: InterviewMe;
  api: InterviewApi;
  reload: () => Promise<void>;
  tg: Tg;
  /** When `me` was loaded; "now" for past/upcoming checks. */
  now: number;
}

// Mirrors the server's BOOKING_LEAD_MS: no booking or moving within an hour of the start.
const LEAD_MS = 60 * 60_000;
const SLOT_LENGTHS = [10, 15, 20, 30, 40, 45, 60, 90];

const STATUS_STYLE: Record<InterviewStatus, string> = {
  PENDING: 'border-white/15 bg-white/5 text-muted',
  PASSED: 'border-brand-green/40 bg-brand-green/15 text-brand-green',
  FAILED: 'border-red-500/40 bg-red-500/15 text-red-400',
  NO_SHOW: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
};

const ICONS = {
  calendar:
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  users:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  team: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  chart:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  ticket:
    'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
};

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : 'Щось пішло не так, спробуй ще раз';

const deptLabel = (d?: StaffDepartment) => d?.shortName ?? d?.name ?? '';

function openTelegram(url: string) {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.openTelegramLink) webApp.openTelegramLink(url);
  else window.open(url, '_blank');
}

/** Runs one mutation at a time with an error message and haptics. */
function useAction(tg: Tg) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      tg.hapticNotify('success');
      return true;
    } catch (err) {
      setError(errorText(err));
      tg.hapticNotify('error');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

// ---- Building blocks ---------------------------------------------------------

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
    </div>
  );
}

function Notice({
  icon,
  title,
  text,
  children,
}: {
  icon: string;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <Image
        src="/logo_white.png"
        alt="Студрада ФІОТ"
        width={160}
        height={55}
        priority
        className="mb-6 h-12 w-auto object-contain"
      />
      <div className="max-w-xs space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 text-2xl">
          {icon}
        </div>
        <h1 className="text-lg font-black">{title}</h1>
        <p className="text-sm leading-relaxed text-muted">{text}</p>
        {children}
      </div>
    </div>
  );
}

function Shell({
  nav,
  children,
}: {
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative min-h-screen',
        nav && 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]',
      )}
    >
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-bg/95 px-4 py-3 backdrop-blur-xl">
        <Image
          src="/logo_white.png"
          alt="Студрада ФІОТ"
          width={130}
          height={40}
          priority
          className="h-8 w-auto object-contain"
        />
        <span className="text-xs font-black uppercase tracking-wider text-brand-cyan">
          Співбесіди
        </span>
      </header>
      <main className="space-y-4 p-4">{children}</main>
      {nav}
    </div>
  );
}

function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <h2 className="text-base font-black uppercase tracking-wider text-muted">
        {children}
      </h2>
      {aside}
    </div>
  );
}

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'space-y-3 rounded-3xl border border-border bg-surface p-4',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-black uppercase tracking-wider text-muted">
      {children}
    </h3>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: 'error' | 'ok';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3 text-xs font-semibold',
        kind === 'error'
          ? 'border-red-500/30 bg-red-500/10 text-red-400'
          : 'border-brand-green/40 bg-brand-green/10 text-brand-green',
      )}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50',
        active
          ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
          : 'border-border bg-surface text-muted hover:text-fg',
        className,
      )}
      {...props}
    />
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{children}</div>
  );
}

function StatusBadge({ status }: { status: InterviewStatus }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function TagForm({
  label,
  busy,
  onAdd,
}: {
  label: string;
  busy: boolean;
  onAdd: (tag: string) => Promise<boolean>;
}) {
  const [tag, setTag] = useState('');
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onAdd(tag)) setTag('');
      }}
    >
      <Input
        label={label}
        placeholder="@username"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
      />
      <Button
        type="submit"
        disabled={busy || !tag.trim()}
        className="mb-0.5 shrink-0"
      >
        Додати
      </Button>
    </form>
  );
}

// ---- Entry -------------------------------------------------------------------

export default function InterviewPage() {
  const tg = useTelegram();
  const api = useMemo(
    () => interviewApi(tg.initData, tg.user),
    [tg.initData, tg.user],
  );
  const [me, setMe] = useState<InterviewMe | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Outside Telegram only the AUTH_DISABLED dev user (?tgUserId=&tgTag=) can get in.
  const canCall = tg.isTelegram || !!tg.user;

  const reload = useCallback(
    () =>
      api.me().then(
        (data) => {
          setMe(data);
          setLoadedAt(Date.now());
          setLoadError(null);
        },
        (err) => setLoadError(errorText(err)),
      ),
    [api],
  );

  useEffect(() => {
    if (tg.ready && canCall) void reload();
  }, [tg.ready, canCall, reload]);

  if (!tg.ready) return <Spinner />;
  if (!canCall) {
    return (
      <Notice
        icon="✈️"
        title="Відкрий через Telegram"
        text="Запис на співбесіду працює лише в Telegram — відкрий бота, якого тобі надіслали."
      />
    );
  }
  if (!me && loadError) {
    return (
      <Notice icon="⚠️" title="Не вдалося завантажити" text={loadError}>
        <Button className="w-full" onClick={() => void reload()}>
          Спробувати ще раз
        </Button>
      </Notice>
    );
  }
  if (!me) return <Spinner />;
  if (!me.departments.length && !me.candidacies.length) {
    return (
      <Notice
        icon="🔒"
        title="Тебе ще не внесли в систему"
        text={
          me.user.username
            ? `Попроси голову департаменту додати тебе за тегом @${me.user.username}, а потім відкрий бота знову.`
            : 'У тебе в Telegram не встановлено username. Додай його в налаштуваннях і попроси голову департаменту внести тебе в систему.'
        }
      />
    );
  }

  const ctx: Ctx = { me, api, reload, tg, now: loadedAt };
  if (!me.departments.length) {
    return (
      <Shell>
        <CandidateView {...ctx} />
      </Shell>
    );
  }
  return <StaffApp {...ctx} />;
}

// ---- Candidate ---------------------------------------------------------------

function CandidateView({ me, api, reload, tg, now }: Ctx) {
  const many = me.candidacies.length > 1;
  const [pickedId, setPickedId] = useState<string | null>(
    many ? null : (me.candidacies[0]?.id ?? null),
  );
  const [changing, setChanging] = useState(false);
  const candidacy = me.candidacies.find((c) => c.id === pickedId);

  useEffect(() => {
    if (changing) tg.showBackButton(() => setChanging(false));
    else if (many && pickedId) tg.showBackButton(() => setPickedId(null));
    else tg.hideBackButton();
    return () => tg.hideBackButton();
  }, [changing, many, pickedId, tg]);

  if (!candidacy) {
    return (
      <>
        <SectionTitle>Твої співбесіди</SectionTitle>
        <p className="px-1 text-sm text-muted">
          Тебе запросили у два департаменти — запишись на кожну співбесіду
          окремо.
        </p>
        {me.candidacies.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              tg.haptic('light');
              setPickedId(c.id);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-3xl border border-border bg-surface p-4 text-left transition-colors hover:border-brand-cyan/60 active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block font-black">{c.department.name}</span>
              <span
                className={cn(
                  'mt-1 block text-sm',
                  c.slot ? 'text-brand-green' : 'text-muted',
                )}
              >
                {c.slot
                  ? `✓ ${fmtDay(c.slot.startsAt)} о ${fmtTime(c.slot.startsAt)}`
                  : 'Час ще не обрано'}
              </span>
            </span>
            <span className="shrink-0 text-sm font-bold text-brand-cyan">
              {c.slot ? 'Деталі →' : 'Обрати →'}
            </span>
          </button>
        ))}
      </>
    );
  }

  if (candidacy.slot && !changing) {
    return (
      <BookedCard
        candidacy={candidacy}
        slot={candidacy.slot}
        now={now}
        onChange={() => setChanging(true)}
      />
    );
  }
  return (
    <SlotPicker
      key={candidacy.id}
      api={api}
      tg={tg}
      candidacy={candidacy}
      onBooked={async () => {
        await reload();
        setChanging(false);
      }}
    />
  );
}

function BookedCard({
  candidacy,
  slot,
  now,
  onChange,
}: {
  candidacy: Candidacy;
  slot: SlotTime;
  now: number;
  onChange: () => void;
}) {
  const startsIn = new Date(slot.startsAt).getTime() - now;
  const past = startsIn < 0;
  return (
    <Card className="space-y-4 border-brand-green/40">
      <div>
        <span className="text-xs font-black uppercase tracking-wider text-brand-green">
          {past ? 'Співбесіда минула' : 'Ти записаний'}
        </span>
        <h1 className="mt-1 text-xl font-black leading-snug">
          {candidacy.department.name}
        </h1>
      </div>
      <div className="rounded-2xl border border-border bg-bg/60 p-4">
        <div className="text-sm text-muted">{fmtDayTitle(slot.startsAt)}</div>
        <div className="text-3xl font-black text-brand-cyan">
          {fmtTime(slot.startsAt)}–{fmtTime(slot.endsAt)}
        </div>
      </div>
      {past ? (
        <p className="text-sm text-muted">Дякуємо за співбесіду!</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted">
            Посилання на зустріч надішле рекрутер у Telegram. Будь на звʼязку за
            кілька хвилин до початку.
          </p>
          {startsIn <= LEAD_MS ? (
            <p className="text-xs text-muted">
              Змінити час уже не можна — до співбесіди менше години. Якщо щось
              трапилось, напиши голові департаменту.
            </p>
          ) : (
            <Button variant="outline" className="w-full" onClick={onChange}>
              Змінити час
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function SlotPicker({
  api,
  tg,
  candidacy,
  onBooked,
}: {
  api: InterviewApi;
  tg: Tg;
  candidacy: Candidacy;
  onBooked: () => Promise<void>;
}) {
  const [slots, setSlots] = useState<SlotTime[] | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [picked, setPicked] = useState<SlotTime | null>(null);
  const { busy, error, setError, run } = useAction(tg);

  const load = useCallback(
    () =>
      api
        .freeSlots(candidacy.id)
        .then(setSlots)
        .catch((err) => {
          setSlots([]);
          setError(errorText(err));
        }),
    [api, candidacy.id, setError],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => byDay(slots ?? []), [slots]);
  const day = days[Math.min(dayIndex, days.length - 1)] ?? [];

  const book = async () => {
    if (!picked) return;
    if (await run(() => api.book(candidacy.id, picked.id))) {
      await onBooked();
    } else {
      setPicked(null);
      void load();
    }
  };

  return (
    <>
      <div className="px-1">
        <span className="text-xs font-black uppercase tracking-wider text-brand-purple">
          {candidacy.department.name}
        </span>
        <h1 className="mt-0.5 text-xl font-black">
          {candidacy.slot ? 'Обери новий час' : 'Обери час співбесіди'}
        </h1>
        {candidacy.slot && (
          <p className="mt-1 text-sm text-muted">
            Зараз: {fmtDay(candidacy.slot.startsAt)} о{' '}
            {fmtTime(candidacy.slot.startsAt)}. Рекрутер отримає сповіщення про
            зміну часу.
          </p>
        )}
      </div>
      {error && <Banner kind="error">{error}</Banner>}
      {slots === null ? (
        <div className="py-12 text-center text-sm text-muted">
          Шукаємо вільний час…
        </div>
      ) : !days.length ? (
        <Empty>
          Поки що вільного часу немає. Зазирни трохи згодом — рекрутери ще
          додають слоти.
        </Empty>
      ) : (
        <>
          <ChipRow>
            {days.map((d, i) => (
              <Chip
                key={d[0].id}
                active={d === day}
                onClick={() => {
                  tg.haptic('light');
                  setDayIndex(i);
                  setPicked(null);
                }}
              >
                {fmtDayTitle(d[0].startsAt)}
              </Chip>
            ))}
          </ChipRow>
          <div className="grid grid-cols-3 gap-2">
            {day.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  tg.haptic('light');
                  setPicked(s);
                }}
                className={cn(
                  'rounded-2xl border py-3 text-sm font-black transition-colors',
                  picked?.id === s.id
                    ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
                    : 'border-border bg-surface hover:border-brand-cyan/50',
                )}
              >
                {fmtTime(s.startsAt)}
              </button>
            ))}
          </div>
          <Button
            className="w-full py-3.5 font-black"
            disabled={!picked || busy}
            onClick={book}
          >
            {busy
              ? 'Записуємо…'
              : picked
                ? `${candidacy.slot ? 'Перенести на' : 'Записатися на'} ${fmtTime(picked.startsAt)}, ${fmtDay(picked.startsAt)}`
                : 'Обери час'}
          </Button>
        </>
      )}
    </>
  );
}

// ---- Staff -------------------------------------------------------------------

type Tab = 'schedule' | 'candidates' | 'team' | 'stats' | 'mine';

function StaffApp(ctx: Ctx) {
  const { me, tg } = ctx;
  const [tab, setTab] = useState<Tab>('schedule');
  const [openId, setOpenId] = useState<string | null>(null);
  const open = me.candidates.find((c) => c.id === openId);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'schedule', label: 'Розклад', icon: ICONS.calendar },
    { id: 'candidates', label: 'Кандидати', icon: ICONS.users },
  ];
  if (me.departments.some((d) => d.role === 'HEAD')) {
    tabs.push({ id: 'team', label: 'Команда', icon: ICONS.team });
  }
  if (me.isAdmin)
    tabs.push({ id: 'stats', label: 'Статистика', icon: ICONS.chart });
  if (me.candidacies.length) {
    tabs.push({ id: 'mine', label: 'Мій запис', icon: ICONS.ticket });
  }

  const nav = (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-border/80 bg-bg/95 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
      <div className="flex items-center justify-around">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              tg.haptic('light');
              setTab(t.id);
            }}
            className={cn(
              'flex flex-col items-center gap-1.5 py-1 text-xs font-bold transition-colors',
              tab === t.id ? 'text-brand-cyan' : 'text-muted hover:text-fg',
            )}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={t.icon}
              />
            </svg>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );

  return (
    <Shell nav={nav}>
      {tab === 'schedule' && <ScheduleTab {...ctx} onOpen={setOpenId} />}
      {tab === 'candidates' && <CandidatesTab {...ctx} onOpen={setOpenId} />}
      {tab === 'team' && <TeamTab {...ctx} />}
      {tab === 'stats' && <StatsTab me={me} now={ctx.now} />}
      {tab === 'mine' && <CandidateView {...ctx} />}
      {open && (
        <CandidateSheet
          {...ctx}
          candidate={open}
          onClose={() => setOpenId(null)}
        />
      )}
    </Shell>
  );
}

function ScheduleTab({
  me,
  api,
  reload,
  tg,
  now,
  onOpen,
}: Ctx & { onOpen: (id: string) => void }) {
  const [adding, setAdding] = useState(false);
  const { busy, error, run } = useAction(tg);
  const mine = me.slots.filter((s) => s.hostTelegramId === me.user.id);
  const booked = mine.filter((s) => s.candidateId).length;
  const multi = me.departments.length > 1;

  return (
    <>
      <SectionTitle
        aside={
          mine.length > 0 && (
            <span className="text-sm font-bold text-brand-cyan">
              {booked}/{mine.length} зайнято
            </span>
          )
        }
      >
        Мій розклад
      </SectionTitle>
      {adding ? (
        <AddSlotsForm
          me={me}
          api={api}
          reload={reload}
          tg={tg}
          now={now}
          onClose={() => setAdding(false)}
        />
      ) : (
        <Button className="w-full" onClick={() => setAdding(true)}>
          + Додати вільний час
        </Button>
      )}
      {error && <Banner kind="error">{error}</Banner>}
      {!mine.length ? (
        <Empty>
          Ти ще не додав вільного часу. Обери день і проміжок — система сама
          поділить його на слоти.
        </Empty>
      ) : (
        byDay(mine).map((day) => (
          <Card key={day[0].id}>
            <h3 className="text-sm font-black text-brand-cyan">
              {fmtDayTitle(day[0].startsAt)}
            </h3>
            <div className="divide-y divide-border/60">
              {day.map((s) => {
                const c = me.candidates.find((x) => x.id === s.candidateId);
                const past = new Date(s.endsAt).getTime() < now;
                const dept = multi
                  ? ` · ${deptLabel(me.departments.find((d) => d.id === s.departmentId))}`
                  : '';
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-3 py-2.5',
                      past && 'opacity-50',
                    )}
                  >
                    <span className="w-[6.5rem] shrink-0 text-sm font-black">
                      {fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}
                    </span>
                    {c ? (
                      <button
                        type="button"
                        onClick={() => onOpen(c.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-sm font-bold">
                          {candidateName(c)}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {c.telegramTag}
                          {dept}
                        </span>
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm text-muted">
                        Вільно{dept}
                      </span>
                    )}
                    {!c && !past && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          if (await run(() => api.deleteSlot(s.id))) {
                            await reload();
                          }
                        }}
                        className="shrink-0 rounded-xl border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                      >
                        Видалити
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}
    </>
  );
}

function AddSlotsForm({
  me,
  api,
  reload,
  tg,
  onClose,
}: Ctx & { onClose: () => void }) {
  const [departmentId, setDepartmentId] = useState(me.departments[0].id);
  const [date, setDate] = useState(kyivDate());
  const [from, setFrom] = useState('14:00');
  const [to, setTo] = useState('16:00');
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useAction(tg);
  const dept = me.departments.find((d) => d.id === departmentId)!;
  const minutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const count = Math.max(
    0,
    Math.floor((minutes(to) - minutes(from)) / dept.slotMinutes),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone(null);
    let result = { created: 0, skipped: 0 };
    const ok = await run(async () => {
      result = await api.createSlots({ departmentId, date, from, to });
    });
    if (!ok) return;
    setDone(
      `Додано: ${plural(result.created, ['слот', 'слоти', 'слотів'])}` +
        (result.skipped
          ? `. Пропущено ${result.skipped} — у цей час у тебе вже є слот.`
          : ''),
    );
    await reload();
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-3xl border border-brand-cyan/40 bg-surface p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-black">Новий вільний час</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-muted hover:text-fg"
          aria-label="Закрити"
        >
          ✕
        </button>
      </div>
      {me.departments.length > 1 && (
        <Select
          label="Департамент"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          options={me.departments.map((d) => ({ value: d.id, label: d.name }))}
        />
      )}
      <Input
        label="День"
        type="date"
        value={date}
        min={kyivDate()}
        onChange={(e) => setDate(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="З"
          type="time"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          required
        />
        <Input
          label="До"
          type="time"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Один слот триває {dept.slotMinutes} хв (задає голова департаменту) —{' '}
        {count
          ? `буде ${plural(count, ['слот', 'слоти', 'слотів'])}.`
          : 'у цей проміжок не вміщується жоден слот.'}
      </p>
      {error && <Banner kind="error">{error}</Banner>}
      {done && <Banner kind="ok">{done}</Banner>}
      <Button type="submit" className="w-full" disabled={busy || !count}>
        {busy ? 'Додаємо…' : 'Додати'}
      </Button>
    </form>
  );
}

function CandidatesTab({
  me,
  api,
  reload,
  tg,
  now,
  onOpen,
}: Ctx & { onOpen: (id: string) => void }) {
  const [deptId, setDeptId] = useState('all');
  const [adding, setAdding] = useState(false);
  const heads = me.departments.filter((d) => d.role === 'HEAD');
  const multi = me.departments.length > 1;
  const list = me.candidates.filter(
    (c) => deptId === 'all' || c.departmentId === deptId,
  );

  return (
    <>
      <SectionTitle
        aside={
          <span className="text-sm font-bold text-brand-cyan">
            {list.length}
          </span>
        }
      >
        Кандидати
      </SectionTitle>
      {multi && (
        <Select
          label="Департамент"
          placeholder="Обери департамент"
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          options={[
            { value: 'all', label: 'Усі департаменти' },
            ...me.departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
      )}
      {heads.length > 0 &&
        (adding ? (
          <AddCandidateForm
            me={me}
            api={api}
            reload={reload}
            tg={tg}
            now={now}
            heads={heads}
            onClose={() => setAdding(false)}
          />
        ) : (
          <Button className="w-full" onClick={() => setAdding(true)}>
            + Додати кандидата
          </Button>
        ))}
      {!list.length ? (
        <Empty>
          {heads.length
            ? 'Додай кандидатів за Telegram-тегом або із заявок із сайту.'
            : 'Голова департаменту ще не додав кандидатів.'}
        </Empty>
      ) : (
        list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              tg.haptic('light');
              onOpen(c.id);
            }}
            className="w-full space-y-1.5 rounded-3xl border border-border bg-surface p-4 text-left transition-colors hover:border-brand-cyan/60 active:scale-[0.99]"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate font-black">
                  {candidateName(c)}
                </span>
                <span className="block truncate text-xs text-muted">
                  {[
                    candidateName(c) !== c.telegramTag && c.telegramTag,
                    multi &&
                      deptLabel(
                        me.departments.find((d) => d.id === c.departmentId),
                      ),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {c.status !== 'PENDING' && <StatusBadge status={c.status} />}
            </span>
            <span
              className={cn(
                'block text-sm font-semibold',
                c.slot ? 'text-brand-cyan' : 'text-muted',
              )}
            >
              {c.slot
                ? `🕒 ${fmtDay(c.slot.startsAt)}, ${fmtTime(c.slot.startsAt)} · ${c.slot.hostName}`
                : c.telegramId
                  ? 'Ще не обрав час'
                  : 'Ще не відкрив бота'}
            </span>
          </button>
        ))
      )}
    </>
  );
}

function AddCandidateForm({
  me,
  api,
  reload,
  tg,
  heads,
  onClose,
}: Ctx & { heads: StaffDepartment[]; onClose: () => void }) {
  const [departmentId, setDepartmentId] = useState(heads[0].id);
  const [loaded, setLoaded] = useState<{
    departmentId: string;
    rows: ApplicantRow[];
  } | null>(null);
  const { busy, error, run } = useAction(tg);
  // Rows of another department (while switching) count as still loading.
  const applicants = loaded?.departmentId === departmentId ? loaded.rows : null;

  const loadApplicants = useCallback(() => {
    api
      .applicants(departmentId)
      .then((rows) => setLoaded({ departmentId, rows }))
      .catch(() => setLoaded({ departmentId, rows: [] }));
  }, [api, departmentId]);
  useEffect(loadApplicants, [loadApplicants]);

  const add = async (telegramTag: string) => {
    const ok = await run(() => api.addCandidate(departmentId, telegramTag));
    if (ok) {
      loadApplicants();
      await reload();
    }
    return ok;
  };

  return (
    <div className="space-y-3 rounded-3xl border border-brand-cyan/40 bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black">Новий кандидат</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-muted hover:text-fg"
          aria-label="Закрити"
        >
          ✕
        </button>
      </div>
      {heads.length > 1 && (
        <Select
          label="Департамент"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          options={heads.map((d) => ({ value: d.id, label: d.name }))}
        />
      )}
      <TagForm label="Telegram-тег кандидата" busy={busy} onAdd={add} />
      {error && <Banner kind="error">{error}</Banner>}
      <div className="space-y-2">
        <CardTitle>Заявки з сайту</CardTitle>
        {applicants === null ? (
          <p className="text-xs text-muted">Завантаження…</p>
        ) : !applicants.length ? (
          <p className="text-xs text-muted">
            Нових заявок у цей департамент немає.
          </p>
        ) : (
          applicants.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-bg/60 px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {a.lastName} {a.firstName}
                </span>
                <span className="block truncate text-xs text-muted">
                  {a.telegramTag} · {a.group}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void add(a.telegramTag)}
                className="shrink-0 rounded-xl bg-brand-cyan px-3 py-1.5 text-xs font-black text-black transition-opacity disabled:opacity-50"
              >
                Запросити
              </button>
            </div>
          ))
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Після додавання надішли кандидату посилання на бота
        {me.botUsername ? `: t.me/${me.botUsername}` : ''}. Він сам обере
        зручний час.
      </p>
    </div>
  );
}

function CandidateSheet({
  me,
  api,
  reload,
  tg,
  candidate: c,
  onClose,
}: Ctx & { candidate: Candidate; onClose: () => void }) {
  const dept = me.departments.find((d) => d.id === c.departmentId);
  const [note, setNote] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { busy, error, run } = useAction(tg);
  const answer = c.applicant?.applicantDepartments.find(
    (d) => d.departmentId === c.departmentId,
  )?.question;

  useEffect(() => {
    tg.showBackButton(onClose);
    return () => tg.hideBackButton();
  }, [tg, onClose]);

  const act = async (action: () => Promise<unknown>) => {
    const ok = await run(action);
    if (ok) await reload();
    return ok;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-black uppercase tracking-wider text-brand-purple">
              {dept?.name}
            </span>
            <h2 className="text-xl font-black leading-snug">
              {candidateName(c)}
            </h2>
            <button
              type="button"
              onClick={() =>
                openTelegram(`https://t.me/${c.telegramTag.replace(/^@/, '')}`)
              }
              className="text-sm font-semibold text-brand-cyan"
            >
              {c.telegramTag} · написати
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-border bg-white/5 p-2 text-muted hover:text-fg"
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>

        <Card>
          <CardTitle>Співбесіда</CardTitle>
          {c.slot ? (
            <div>
              <p className="text-lg font-black text-brand-cyan">
                {fmtDayTitle(c.slot.startsAt)}, {fmtTime(c.slot.startsAt)}–
                {fmtTime(c.slot.endsAt)}
              </p>
              <p className="text-xs text-muted">Проводить: {c.slot.hostName}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {c.telegramId
                ? 'Кандидат ще не обрав час.'
                : 'Кандидат ще не відкривав бота.'}
            </p>
          )}
        </Card>

        <Card>
          <CardTitle>Результат</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(STATUS_LABEL) as InterviewStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => void act(() => api.setStatus(c.id, s))}
                className={cn(
                  'rounded-2xl border px-3 py-2.5 text-xs font-bold transition-colors',
                  c.status === s
                    ? STATUS_STYLE[s]
                    : 'border-border text-muted hover:text-fg',
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted">
            Кандидат не бачить результату й нотаток.
          </p>
        </Card>

        {c.applicant && (
          <Card>
            <CardTitle>Заявка з сайту</CardTitle>
            <dl className="space-y-2 text-sm">
              {[
                [
                  'ПІБ',
                  `${c.applicant.lastName} ${c.applicant.firstName} ${c.applicant.middleName}`,
                ],
                ['Група', c.applicant.group],
                ['Телефон', c.applicant.phoneNumber],
                ['Мотивація', c.applicant.motivation],
                ['Досвід', c.applicant.experience],
                ['Відповідь для департаменту', answer],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="whitespace-pre-wrap">{value}</dd>
                  </div>
                ))}
            </dl>
          </Card>
        )}

        <Card>
          <CardTitle>Нотатки та відгуки</CardTitle>
          {c.notes.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border border-border bg-bg/60 p-3"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                <span className="font-bold text-fg">{n.authorName}</span>
                <span>
                  {fmtDay(n.createdAt)}, {fmtTime(n.createdAt)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.text}</p>
              {n.authorTelegramId === me.user.id && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => api.deleteNote(n.id))}
                  className="mt-1 text-[11px] text-muted hover:text-red-400"
                >
                  Видалити
                </button>
              )}
            </div>
          ))}
          <Textarea
            placeholder="Як пройшла співбесіда, сильні сторони, сумніви…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            className="min-h-[90px]"
          />
          <Button
            className="w-full"
            disabled={busy || !note.trim()}
            onClick={async () => {
              if (await act(() => api.addNote(c.id, note))) setNote('');
            }}
          >
            Додати нотатку
          </Button>
        </Card>

        {error && <Banner kind="error">{error}</Banner>}

        {dept?.role === 'HEAD' &&
          (confirmRemove ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmRemove(false)}
              >
                Скасувати
              </Button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await act(() => api.removeCandidate(c.id))) onClose();
                }}
                className="flex-1 rounded-full bg-red-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Так, прибрати
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="w-full rounded-2xl border border-red-500/30 py-2.5 text-xs font-bold text-red-400"
            >
              Прибрати кандидата
            </button>
          ))}
      </div>
    </div>
  );
}

function TeamTab({ me, api, reload, tg }: Ctx) {
  const heads = me.departments.filter((d) => d.role === 'HEAD');
  const [deptId, setDeptId] = useState(heads[0].id);
  const [copied, setCopied] = useState(false);
  const { busy, error, run } = useAction(tg);
  const dept = heads.find((d) => d.id === deptId) ?? heads[0];
  const botLink = me.botUsername ? `https://t.me/${me.botUsername}` : null;

  const act = async (action: () => Promise<unknown>) => {
    const ok = await run(action);
    if (ok) await reload();
    return ok;
  };

  return (
    <>
      <SectionTitle>Команда</SectionTitle>
      {heads.length > 1 && (
        <Select
          label="Департамент"
          placeholder="Обери департамент"
          value={dept.id}
          onChange={(e) => setDeptId(e.target.value)}
          options={heads.map((d) => ({ value: d.id, label: d.name }))}
        />
      )}

      {botLink && (
        <Card>
          <CardTitle>Посилання для кандидатів</CardTitle>
          <p className="text-xs text-muted">
            Додай кандидата у вкладці «Кандидати» й надішли йому це посилання.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-xl border border-border bg-bg/60 px-3 py-2 text-sm text-brand-cyan">
              {botLink}
            </code>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(botLink)
                  .then(() => {
                    setCopied(true);
                    tg.hapticNotify('success');
                    setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => {})
              }
              className="shrink-0 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:border-brand-cyan hover:text-brand-cyan"
            >
              {copied ? '✓ Скопійовано' : 'Копіювати'}
            </button>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Тривалість одного слота</CardTitle>
        <div className="flex flex-wrap gap-2">
          {SLOT_LENGTHS.map((m) => (
            <Chip
              key={m}
              active={dept.slotMinutes === m}
              disabled={busy}
              onClick={() => void act(() => api.setSlotMinutes(dept.id, m))}
            >
              {m} хв
            </Chip>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Вільний час рекрутерів ділиться на слоти по {dept.slotMinutes} хв. Уже
          створені слоти не змінюються.
        </p>
      </Card>

      <Card>
        <CardTitle>Рекрутери</CardTitle>
        {!dept.recruiters.length && (
          <p className="text-sm text-muted">Ще нікого не додано.</p>
        )}
        {dept.recruiters.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-bg/60 px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">
                {r.name ?? r.telegramTag}
              </span>
              <span className="block truncate text-xs text-muted">
                {r.telegramTag}
                {r.telegramId ? '' : ' · ще не відкрив бота'}
              </span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => api.removeRecruiter(r.id))}
              className="shrink-0 text-xs text-muted hover:text-red-400"
            >
              Прибрати
            </button>
          </div>
        ))}
        <TagForm
          label="Додати рекрутера"
          busy={busy}
          onAdd={(tag) => act(() => api.addRecruiter(dept.id, tag))}
        />
        <p className="text-xs leading-relaxed text-muted">
          Рекрутер має відкрити цього бота й натиснути «Start», щоб отримувати
          сповіщення про записи та нагадування.
        </p>
      </Card>
      {error && <Banner kind="error">{error}</Banner>}
    </>
  );
}

function StatsTab({ me, now }: { me: InterviewMe; now: number }) {
  const held = (c: Candidate) =>
    !!c.slot && new Date(c.slot.startsAt).getTime() < now;
  const rows = me.departments.map((d) => {
    const cs = me.candidates.filter((c) => c.departmentId === d.id);
    const count = (status: InterviewStatus) =>
      cs.filter((c) => c.status === status).length;
    return {
      dept: d,
      total: cs.length,
      booked: cs.filter((c) => c.slot).length,
      held: cs.filter(held).length,
      awaiting: cs.filter((c) => held(c) && c.status === 'PENDING').length,
      passed: count('PASSED'),
      failed: count('FAILED'),
      noShow: count('NO_SHOW'),
      free: me.slots.filter(
        (s) =>
          s.departmentId === d.id &&
          !s.candidateId &&
          new Date(s.startsAt).getTime() > now,
      ).length,
    };
  });
  const sum = (key: 'total' | 'booked' | 'held' | 'passed') =>
    rows.reduce((acc, r) => acc + r[key], 0);

  return (
    <>
      <SectionTitle>Статистика</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {(
          [
            ['Кандидатів', sum('total')],
            ['Записались', sum('booked')],
            ['Проведено', sum('held')],
            ['Пройшли', sum('passed')],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-3xl border border-border bg-surface p-4"
          >
            <div className="text-3xl font-black text-gradient">{value}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-muted">
              {label}
            </div>
          </div>
        ))}
      </div>
      {rows.map((r) => (
        <Card key={r.dept.id}>
          <h3 className="font-black">{r.dept.name}</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {(
              [
                ['Кандидатів', r.total],
                ['Записались', r.booked],
                ['Проведено', r.held],
                ['Чекають результату', r.awaiting],
                ['Пройшли', r.passed],
                ['Не пройшли', r.failed],
                ['Не зʼявились', r.noShow],
                ['Вільних слотів', r.free],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-muted">{label}</dt>
                <dd className="font-black">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </>
  );
}
