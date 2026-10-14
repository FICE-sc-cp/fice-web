'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import {
  SHARI_WORDS,
  errorText,
  teacherLink,
  type AdminTeacher,
  type AdminView,
  type ImportResult,
  type ShariSettings,
  type StaffApi,
  type StaffMe,
} from '@/lib/shari';
import { cn, plural } from '@/lib/utils';
import { GroupPanel } from './GroupPanel';
import { Banner, Chip, ErrorText, Panel, Spinner, inputClass, useAction } from './ui';

const TABS = [
  ['overview', 'Огляд'],
  ['groups', 'Групи'],
  ['teachers', 'Викладачі'],
  ['import', 'Імпорт'],
] as const;
/** "mine": the group of a presidium member who is also a starosta. */
type Tab = (typeof TABS)[number][0] | 'mine';

const FILTERS = [
  ['all', 'Усі'],
  ['unopened', 'Не відкривали посилання'],
  ['empty', 'Без шар'],
  ['given', 'Внесли шари'],
] as const;
type Filter = (typeof FILTERS)[number][0];

const fileButton =
  'inline-flex cursor-pointer items-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-brand-cyan hover:text-brand-cyan';

type Reload = () => Promise<void>;

/** Presidium: stages, progress, teacher links, imports and any group. */
export function AdminPanel({ api, me }: { api: StaffApi; me: StaffMe }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [view, setView] = useState<AdminView | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () => api.admin().then(setView, (err) => setError(errorText(err))),
    [api],
  );
  useEffect(() => {
    reload();
  }, [reload]);

  if (group) {
    return (
      <>
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => {
            setGroup(null);
            reload();
          }}
        >
          ← Усі групи
        </Button>
        <GroupPanel api={api} group={group} />
      </>
    );
  }
  if (!view) return error ? <Banner tone="warn">{error}</Banner> : <Spinner />;

  // Fresh numbers on every switch: the starosta tab changes them.
  const open = (next: Tab) => {
    setTab(next);
    reload();
  };

  return (
    <>
      <nav className="flex flex-wrap gap-2">
        {me.group && (
          <Chip active={tab === 'mine'} onClick={() => open('mine')}>
            Моя група {me.group}
          </Chip>
        )}
        {TABS.map(([id, label]) => (
          <Chip key={id} active={tab === id} onClick={() => open(id)}>
            {label}
          </Chip>
        ))}
      </nav>
      {tab === 'mine' && me.group && <GroupPanel api={api} group={me.group} />}
      {tab === 'overview' && <Overview view={view} api={api} reload={reload} />}
      {tab === 'groups' && <Groups view={view} open={setGroup} />}
      {tab === 'teachers' && <Teachers view={view} api={api} reload={reload} />}
      {tab === 'import' && <Imports api={api} reload={reload} />}
    </>
  );
}

const percent = (part: number, whole: number) =>
  whole ? `${Math.round((part / whole) * 100)}%` : '0%';

function Overview({ view, api, reload }: { view: AdminView; api: StaffApi; reload: Reload }) {
  const settings = useAction();
  const exporting = useAction();
  const t = view.totals;
  const toggle = (key: keyof ShariSettings) =>
    settings.run(async () => {
      await api.setSettings({ [key]: !view.settings[key] });
      await reload();
    });
  const stats: [string, number, string][] = [
    ['Викладачів у списку', t.teachers, `відкрили посилання: ${t.teachersOpened}`],
    ['Внесли шари', t.teachersWithShari, `${percent(t.teachersWithShari, t.teachers)} викладачів`],
    ['Шар від викладачів', t.shari, `розподілено: ${t.awarded} (${percent(t.awarded, t.shari)})`],
    ['Груп із шарами', t.groupsWithShari, `з ${t.groups} груп`],
    ['Старост', t.starostas, `входили на сайт: ${t.starostasSignedIn}`],
    ['Студентів у списках', t.students, ''],
  ];

  return (
    <>
      <Panel title="Етапи">
        <div className="flex flex-col gap-3">
          <Toggle
            checked={view.settings.teachersOpen}
            onChange={() => toggle('teachersOpen')}
            disabled={settings.busy}
            label="Викладачі можуть вносити й змінювати шари"
          />
          <Toggle
            checked={view.settings.starostasOpen}
            onChange={() => toggle('starostasOpen')}
            disabled={settings.busy}
            label="Старости можуть вписувати отримувачів"
          />
        </div>
        <p className="mt-3 text-sm text-subtle">
          Президія може змінювати все й тоді, коли етапи закриті.
        </p>
        <ErrorText>{settings.error}</ErrorText>
      </Panel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map(([label, value, note]) => (
          <div key={label} className="rounded-2xl border border-border bg-surface/70 p-5">
            <div className="text-3xl font-black">{value}</div>
            <div className="mt-1 font-semibold">{label}</div>
            {note && <div className="mt-1 text-sm text-subtle">{note}</div>}
          </div>
        ))}
      </div>

      <Panel title="Вивантаження">
        <p className="text-muted">
          Excel: шари з отримувачами, сертифікати з посиланнями на перевірку,
          викладачі з особистими посиланнями (для розсилки й нагадувань) і
          старости.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => exporting.run(api.exportXlsx)} disabled={exporting.busy}>
            {exporting.busy ? 'Готую…' : 'Завантажити Excel'}
          </Button>
          <ErrorText>{exporting.error}</ErrorText>
        </div>
      </Panel>
    </>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        className="size-5 accent-brand-cyan"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}

function Groups({ view, open }: { view: AdminView; open: (group: string) => void }) {
  const [query, setQuery] = useState('');
  const [problems, setProblems] = useState(false);
  const q = query.replace(/\s+/g, '').toLowerCase();
  const rows = view.groups.filter(
    (g) =>
      g.group.toLowerCase().includes(q) &&
      (!problems || !g.starosta || g.awarded < g.shari),
  );

  return (
    <Panel title="Групи" aside={<span className="text-sm text-subtle">{rows.length}</span>}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className={cn(inputClass, 'max-w-xs')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук групи"
        />
        <Chip active={problems} onClick={() => setProblems(!problems)}>
          Без старости або не все розподілено
        </Chip>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-subtle">
            <tr>
              <th className="py-2 pr-4 font-semibold">Група</th>
              <th className="pr-4 font-semibold">Староста</th>
              <th className="pr-4 font-semibold">Студентів</th>
              <th className="pr-4 font-semibold">Розподілено шар</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rows.map((g) => (
              <tr key={g.group}>
                <td className="py-2.5 pr-4 font-bold">{g.group}</td>
                <td className="pr-4">
                  {g.starosta ? (
                    <span title={g.signedIn ? 'Вхід на сайт уже був' : 'Входу на сайт ще не було'}>
                      {g.starosta}
                      {g.signedIn && <span className="text-brand-green"> ✓</span>}
                    </span>
                  ) : (
                    <span className="text-amber-300">немає</span>
                  )}
                </td>
                <td className="pr-4">{g.students || '—'}</td>
                <td className={cn('pr-4', g.awarded < g.shari && 'text-amber-300')}>
                  {g.shari ? `${g.awarded} з ${g.shari}` : '—'}
                </td>
                <td className="py-1.5 text-right">
                  <Button variant="outline" className="px-4 py-1.5" onClick={() => open(g.group)}>
                    Відкрити
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Teachers({ view, api, reload }: { view: AdminView; api: StaffApi; reload: Reload }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const q = query.trim().toLowerCase();
  const rows = view.teachers.filter(
    (t) =>
      (!q ||
        t.fullName.toLowerCase().includes(q) ||
        (t.email ?? '').toLowerCase().includes(q)) &&
      (filter === 'all' ||
        (filter === 'unopened' && !t.openedAt) ||
        (filter === 'empty' && !t.offers) ||
        (filter === 'given' && t.offers > 0)),
  );

  return (
    <Panel
      title="Викладачі"
      aside={
        <Button variant="outline" onClick={() => setAdding(!adding)}>
          {adding ? 'Сховати форму' : 'Додати викладача'}
        </Button>
      }
    >
      {adding && <AddTeacher api={api} reload={reload} />}
      <p className="mb-4 text-sm text-subtle">
        Особисте посилання — це вхід викладача, надсилайте його лише йому. Якщо
        воно потрапило не туди, видайте нове: старе перестане працювати. Шари,
        які викладач надіслав формою, вносьте через його посилання.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className={cn(inputClass, 'max-w-xs')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук: ПІБ або пошта"
        />
        {FILTERS.map(([id, label]) => (
          <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>
            {label}
          </Chip>
        ))}
        <span className="text-sm text-subtle">{rows.length}</span>
      </div>
      <ul className="divide-y divide-border/70">
        {rows.map((teacher) => (
          <TeacherRow key={teacher.id} teacher={teacher} api={api} reload={reload} />
        ))}
      </ul>
    </Panel>
  );
}

function TeacherRow({ teacher, api, reload }: { teacher: AdminTeacher; api: StaffApi; reload: Reload }) {
  const [copied, setCopied] = useState(false);
  const { busy, error, run } = useAction();
  const link = teacherLink(teacher.token);
  const copy = () =>
    run(async () => {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  const reissue = () => {
    if (!window.confirm(`Нове посилання для ${teacher.fullName}? Старе перестане працювати.`)) return;
    run(async () => {
      await api.reissueLink(teacher.id);
      await reload();
    });
  };
  const status = teacher.quantity
    ? plural(teacher.quantity, SHARI_WORDS)
    : teacher.openedAt
      ? 'відкрито, шар ще немає'
      : 'не відкривали';

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-[14rem] flex-1">
        <div className="font-semibold">{teacher.fullName}</div>
        <div className="text-sm text-subtle">
          {[teacher.email, teacher.telegram].filter(Boolean).join(' · ') || 'без контактів'}
        </div>
      </div>
      <span className={cn('text-sm', teacher.quantity ? 'text-brand-green' : 'text-subtle')}>
        {status}
      </span>
      <span className="flex flex-wrap gap-1">
        <Button variant="outline" className="px-4 py-1.5" onClick={copy} disabled={busy}>
          {copied ? 'Скопійовано' : 'Копіювати посилання'}
        </Button>
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:text-fg"
        >
          Відкрити
        </a>
        <Button variant="ghost" className="px-3 py-1.5" onClick={reissue} disabled={busy}>
          Нове посилання
        </Button>
      </span>
      {error && (
        <span className="w-full">
          <ErrorText>{error}</ErrorText>
        </span>
      )}
    </li>
  );
}

function AddTeacher({ api, reload }: { api: StaffApi; reload: Reload }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const { busy, error, run } = useAction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { token } = await api.addTeacher({ fullName, email, telegram });
      setLink(teacherLink(token));
      setFullName('');
      setEmail('');
      setTelegram('');
      await reload();
    });
  };

  return (
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-3">
      <Input label="ПІБ" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
      <Input label="Пошта" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
      <Input label="Telegram" value={telegram} onChange={(e) => setTelegram(e.target.value)} maxLength={120} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Button type="submit" disabled={busy || !fullName.trim()}>
          Додати
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
      {link && <p className="break-all text-sm text-brand-green sm:col-span-3">Додано. Посилання: {link}</p>}
    </form>
  );
}

function Imports({ api, reload }: { api: StaffApi; reload: Reload }) {
  return (
    <>
      <ImportBox
        title="Викладачі з кампусу"
        hint="CSV з колонками Викладач, Дисципліна, Роль, Групи, Telegram, Пошта (вигрузка fiot_teachers.py). Нових викладачів додає, у наявних оновлює предмети й групи; уже вказаних контактів не чіпає."
        accept=".csv,text/csv"
        send={api.importTeachers}
        reload={reload}
      />
      <ImportBox
        title="Старости"
        hint="Рядок на групу: група і @тег (дві колонки, скопійовані з таблиці). Рядок з групою без тегу прибирає її старосту."
        placeholder={'ІП-61\t@username'}
        send={api.importStarostas}
        reload={reload}
        paste
      />
      <ImportBox
        title="Списки студентів"
        hint="Рядок на студента: група і ПІБ (ПІБ можна в кількох колонках). Списки груп, які є у вставці, замінюються повністю; інші групи лишаються як були."
        placeholder={'ІП-61\tІваненко Іван Іванович'}
        accept=".txt,.tsv,.csv,text/plain"
        send={api.importStudents}
        reload={reload}
        paste
      />
    </>
  );
}

function ImportBox({
  title,
  hint,
  placeholder,
  accept,
  paste,
  send,
  reload,
}: {
  title: string;
  hint: string;
  placeholder?: string;
  accept?: string;
  paste?: boolean;
  send: (text: string) => Promise<ImportResult>;
  reload: Reload;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const { busy, error, run } = useAction();
  const upload = (value: string) =>
    run(async () => {
      setResult(null);
      setResult(await send(value));
      setText('');
      await reload();
    });

  return (
    <Panel title={title}>
      <p className="mb-4 text-sm text-subtle">{hint}</p>
      {paste && (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={6}
          className="font-mono text-sm"
          aria-label={title}
        />
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {paste && (
          <Button onClick={() => upload(text)} disabled={busy || !text.trim()}>
            Зберегти
          </Button>
        )}
        {accept && (
          <label className={cn(fileButton, busy && 'pointer-events-none opacity-50')}>
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) upload(await file.text());
              }}
            />
            {paste ? 'Або завантажити файл' : 'Завантажити CSV'}
          </label>
        )}
        {busy && <span className="text-sm text-subtle">Зберігаю…</span>}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <ErrorText>{error}</ErrorText>
        {result && (
          <Banner tone="ok">
            {result.message}
            {result.skipped.length > 0 && (
              <>
                <span className="block text-amber-200">
                  Пропущено рядків: {result.skipped.length}
                </span>
                <ul className="mt-1 list-disc pl-5 font-mono text-xs text-amber-200">
                  {result.skipped.slice(0, 10).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </>
            )}
          </Banner>
        )}
      </div>
    </Panel>
  );
}
