'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
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
      <Panel
        title={`Група ${view.group}`}
        aside={
          awards.length > 0 && (
            <CertificatesButton
              awards={awards}
              label={`Усі сертифікати (${awards.length})`}
              api={api}
            />
          )
        }
      >
        <p className="text-muted">
          {total > 0
            ? `Від викладачів: ${plural(total, SHARI_WORDS)}, розподілено ${awards.length}.`
            : 'Поки що викладачі не внесли шар для цієї групи.'}
          {view.starosta && ` Староста: ${view.starosta}.`}
        </p>
        <p className="mt-2 text-sm text-subtle">
          Розіграй шари в групі чесно. Щойно ти збережеш ПІБ, зʼявиться
          сертифікат — завантаж його і надішли студенту. Викладач перевірить
          його за QR-кодом.
        </p>
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
  const { busy, error, run } = useAction();
  const dirty = names.some((name, slot) => name.trim() !== saved[slot]);

  const save = () => run(async () => onChange(await api.setAwards(shara.id, names)));
  const remove = () => {
    if (!window.confirm(`Видалити шару «${shara.bonus}» (${shara.teacher}) разом з отримувачами?`)) return;
    run(async () => {
      await api.removeShara(shara.id);
      onChange(await api.group(view.group));
    });
  };

  return (
    <Panel
      title={<span className="text-lg sm:text-xl">{shara.discipline}</span>}
      aside={<span className="text-sm text-subtle">{shara.teacher}</span>}
    >
      <p className="font-semibold">
        {plural(shara.quantity, SHARI_WORDS)}: {shara.bonus}
      </p>
      {shara.condition && <p className="text-sm text-subtle">Умова: {shara.condition}</p>}

      <ol className="mt-4 flex flex-col gap-2">
        {names.map((name, slot) => {
          const award = shara.awards.find((a) => a.slot === slot);
          const value = name.trim();
          const unknown = value && view.students.length > 0 && !view.students.includes(value);
          return (
            <li key={slot} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-right text-sm text-subtle">{slot + 1}.</span>
                <input
                  className={inputClass}
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
                {award && award.studentName === value && (
                  <CertificatesButton
                    awards={[{ id: award.id, name: certificateName(value, shara.discipline) }]}
                    label="Сертифікат"
                    api={api}
                    iconOnPhones
                  />
                )}
              </div>
              {unknown && (
                <span className="pl-8 text-xs text-amber-300">
                  Немає у списку групи — перевір ПІБ
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {view.canEdit && (
          <Button onClick={save} disabled={!dirty || busy}>
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
    </Panel>
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
