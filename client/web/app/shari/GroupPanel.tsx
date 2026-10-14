'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { GradientText } from '@/components/ui/GradientText';
import {
  SHARI_WORDS,
  canShareFiles,
  certificateName,
  deliver,
  errorText,
  type GroupShara,
  type GroupView,
  type StaffApi,
} from '@/lib/shari';
import { cn, plural } from '@/lib/utils';
import { ProgressRing, Sphere, Ticket, confetti, sharaColor } from './decor';
import { Banner, ErrorText, Panel, Spinner, inputClass, useAction } from './ui';

/** An award whose certificate can be taken, and the file name for it. */
type Issued = { id: string; name: string };

const STUDENTS_LIST = 'shari-students';

/** A group's shari: the starosta (or presidium) writes who gets each place and takes the certificates. */
export function GroupPanel({ api, group }: { api: StaffApi; group: string }) {
  const [view, setView] = useState<GroupView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.group(group).then(setView, (err) => setError(errorText(err)));
  }, [api, group]);

  if (!view) return error ? <Banner tone="warn">{error}</Banner> : <Spinner />;

  const awards: Issued[] = view.shari.flatMap((s) =>
    s.awards.map((a) => ({ id: a.id, name: certificateName(a.studentName, s.discipline) })),
  );
  const total = view.shari.reduce((n, s) => n + s.quantity, 0);

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-subtle">Група</p>
            <p className="text-5xl font-black tracking-tight sm:text-6xl">
              <GradientText>{view.group}</GradientText>
            </p>
            <p className="mt-2 text-sm text-muted">
              {total > 0
                ? `Від викладачів: ${plural(total, SHARI_WORDS)}`
                : 'Поки що викладачі не подарували шар цій групі.'}
              {view.starosta && ` · староста ${view.starosta}`}
            </p>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-4">
              <ProgressRing value={awards.length} total={total} />
              <div className="flex flex-col items-start gap-2">
                <span className="text-sm font-semibold text-muted">розподілено</span>
                {awards.length > 0 && (
                  <CertificatesButton awards={awards} label={`Усі сертифікати (${awards.length})`} api={api} />
                )}
              </div>
            </div>
          )}
        </div>
        <p className="mt-6 text-sm leading-relaxed text-subtle">
          🎲 Розіграй шари в групі чесно. Щойно ти збережеш ПІБ, зʼявиться
          сертифікат — завантаж його і надішли студенту. Викладач перевірить
          його за QR-кодом.
        </p>
        {total > 0 && awards.length === total && (
          <div className="mt-4">
            <Banner tone="ok">🎉 Усі шари розподілено! Лишилось роздати сертифікати.</Banner>
          </div>
        )}
        {!view.canEdit && (
          <div className="mt-4">
            <Banner tone="warn">Розподіл шар завершено — отримувачів уже не змінити.</Banner>
          </div>
        )}
      </Panel>

      {view.shari.map((shara) => (
        <SharaCard
          // Remount when this shara changes, keeping unsaved edits of the others.
          key={`${shara.id}:${shara.quantity}:${shara.awards.map((a) => a.id).join()}`}
          shara={shara}
          view={view}
          api={api}
          onChange={setView}
        />
      ))}
      <datalist id={STUDENTS_LIST}>
        {view.students.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}

function SharaCard({
  shara,
  view,
  api,
  onChange,
}: {
  shara: GroupShara;
  view: GroupView;
  api: StaffApi;
  onChange: (view: GroupView) => void;
}) {
  const saved = Array.from(
    { length: shara.quantity },
    (_, slot) => shara.awards.find((a) => a.slot === slot)?.studentName ?? '',
  );
  const [names, setNames] = useState(saved);
  const saveRef = useRef<HTMLButtonElement>(null);
  const { busy, error, run } = useAction();
  const dirty = names.some((name, slot) => name.trim() !== saved[slot]);
  const color = sharaColor(shara.bonus);

  const save = () =>
    run(async () => {
      const next = await api.setAwards(shara.id, names);
      if (names.some((name) => name.trim())) confetti(saveRef.current);
      onChange(next);
    });
  const remove = () => {
    if (!window.confirm(`Видалити шару «${shara.bonus}» (${shara.teacher}) разом з отримувачами?`)) return;
    run(async () => {
      await api.removeShara(shara.id);
      onChange(await api.group(view.group));
    });
  };

  return (
    <Ticket
      color={color}
      stub={
        <>
          <span className="text-3xl font-black leading-none">×{shara.quantity}</span>
          <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.18em]">
            {plural(shara.quantity, SHARI_WORDS).split(' ')[1]}
          </span>
        </>
      }
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-subtle">{shara.discipline}</p>
      <p className="mt-1 text-sm text-muted">{shara.teacher}</p>
      {shara.outsideSchedule && (
        <p className="mt-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
          ⚠ Викладач не веде цю групу за розкладом — уточніть у нього
        </p>
      )}
      <p className="mt-3 text-xl font-extrabold leading-snug">{shara.bonus}</p>
      {shara.condition && <p className="mt-1 text-sm text-muted">Умова: {shara.condition}</p>}

      <ol className="mt-5 flex flex-col gap-2">
        {names.map((name, slot) => {
          const award = shara.awards.find((a) => a.slot === slot);
          const value = name.trim();
          const issued = award && award.studentName === value;
          const unknown = value && view.students.length > 0 && !view.students.includes(value);
          return (
            <li key={slot} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Sphere color={color} size={26} className="text-[0.7rem]">
                  {slot + 1}
                </Sphere>
                <input
                  className={cn(inputClass, issued && 'border-brand-green/50 bg-brand-green/[0.06]')}
                  list={STUDENTS_LIST}
                  value={name}
                  onChange={(e) =>
                    setNames((list) => list.map((n, i) => (i === slot ? e.target.value : n)))
                  }
                  disabled={!view.canEdit || busy}
                  placeholder="ПІБ студента"
                  maxLength={120}
                  aria-label={`Отримувач шари ${slot + 1}`}
                />
                {issued && (
                  <CertificatesButton
                    awards={[{ id: award.id, name: certificateName(value, shara.discipline) }]}
                    label="Сертифікат"
                    api={api}
                    iconOnPhones
                  />
                )}
              </div>
              {unknown && (
                <span className="pl-9 text-xs font-semibold text-amber-300">
                  Немає у списку групи — перевір ПІБ
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {view.canEdit && (
          <Button ref={saveRef} onClick={save} disabled={!dirty || busy}>
            Зберегти
          </Button>
        )}
        {dirty && (
          <Button variant="ghost" onClick={() => setNames(saved)} disabled={busy}>
            Скасувати
          </Button>
        )}
        {view.isAdmin && (
          <Button variant="ghost" className="ml-auto text-brand-red" onClick={remove} disabled={busy}>
            Видалити шару
          </Button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </Ticket>
  );
}

/** Certificates rendered by the site (the same for everyone), then shared or downloaded. */
function CertificatesButton({
  awards,
  label,
  api,
  iconOnPhones,
}: {
  awards: Issued[];
  label: string;
  api: StaffApi;
  /** Narrow screens show just the icon, leaving room for the name. */
  iconOnPhones?: boolean;
}) {
  const [done, setDone] = useState(0);
  const { busy, error, run } = useAction();
  const go = () =>
    run(async () => {
      const files: File[] = [];
      setDone(0);
      // One at a time: each is rendered on the server.
      for (const award of awards) {
        files.push(await api.certificate(award.id, award.name));
        setDone(files.length);
      }
      await deliver(files);
    });
  const progress = awards.length > 1 ? `Готую ${done}/${awards.length}…` : 'Готую…';

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <Button
        variant="outline"
        className="whitespace-nowrap px-4 py-2"
        onClick={go}
        disabled={busy}
        aria-label={label}
        title={label}
      >
        {canShareFiles() ? '↗' : '↓'}
        <span className={cn(iconOnPhones && 'hidden sm:inline')}>{busy ? progress : label}</span>
      </Button>
      <ErrorText>{error}</ErrorText>
    </span>
  );
}
