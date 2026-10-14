'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  COUNCIL_EMAIL,
  SHARI_WORDS,
  errorText,
  teacherApi,
  type TeacherShara,
  type TeacherView,
} from '@/lib/shari';
import { plural } from '@/lib/utils';
import { Banner, Chip, ErrorText, Panel, Spinner, inputClass, useAction } from '../../ui';

type Api = ReturnType<typeof teacherApi>;
interface Props {
  view: TeacherView;
  api: Api;
  onChange: (view: TeacherView) => void;
}

const OTHER = '__other__';
// The most common shari of the last years; a tap fills the field to edit.
const PRESETS = [
  '+5 балів до рейтингу',
  '+10 балів до рейтингу',
  '+3 бали на екзамені',
  '+1 літера на заліку',
  '+1 літера на екзамені',
  'Закриття лабораторної роботи на максимальний бал',
  'Автомат на екзамен',
];

/** "Коваленко Петро Іванович" → "Петро Іванович". */
const addressOf = (fullName: string) => {
  const parts = fullName.split(' ');
  return parts.length >= 3 ? parts.slice(1).join(' ') : fullName;
};

const clampQuantity = (value: string) =>
  Math.min(50, Math.max(1, Math.trunc(Number(value)) || 1));

/** "іп 61", "ІП–61", "Iп-61" all find "ІП-61". */
const groupKey = (value: string) =>
  value.toLowerCase().replace(/[\s‐-―−-]/g, '').replace(/i/g, 'і');

const Contact = () => (
  <a href={`mailto:${COUNCIL_EMAIL}`} className="font-semibold underline">
    {COUNCIL_EMAIL}
  </a>
);

export function TeacherApp({ token }: { token: string }) {
  const api = useMemo(() => teacherApi(token), [token]);
  const [view, setView] = useState<TeacherView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.view().then(setView, (err) => setLoadError(errorText(err)));
  }, [api]);

  if (loadError) {
    return (
      <Banner tone="warn">
        {loadError} Пошта Студради: <Contact />
      </Banner>
    );
  }
  if (!view) return <Spinner />;

  const props = { view, api, onChange: setView };
  return (
    <>
      <p className="text-xl">
        Вітаємо, <b>{addressOf(view.fullName)}</b>!
      </p>
      <Panel title="Як це працює">
        <ol className="list-decimal space-y-2 pl-5 text-muted">
          <li>
            Оберіть предмет і групи, опишіть шару та скільки їх отримує кожна
            група. Тим самим групам можна додати кілька різних шар.
          </li>
          <li>
            Староста групи розіграє шари й впише, кому дісталась кожна, — і
            одразу отримає для студента сертифікат із QR-кодом.
          </li>
          <li>
            Коли студент покаже сертифікат, відскануйте QR-код: відкриється
            сторінка на сайті Студради з даними шари. Якщо сторінка не
            відкривається або дані інші — сертифікат підроблений.
          </li>
        </ol>
      </Panel>
      {!view.open && (
        <Banner tone="warn">
          Прийом шар завершено. Якщо треба щось змінити — напишіть нам:{' '}
          <Contact />
        </Banner>
      )}
      <Contacts {...props} />
      {view.open && <AddShari {...props} />}
      <MyShari {...props} />
    </>
  );
}

function Contacts({ view, api, onChange }: Props) {
  const [email, setEmail] = useState(view.email ?? '');
  const [telegram, setTelegram] = useState(view.telegram ?? '');
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const dirty =
    email !== (view.email ?? '') || telegram !== (view.telegram ?? '');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      onChange(await api.setContacts({ email, telegram }));
      setSaved(true);
    });
  };

  return (
    <Panel title="Ваші контакти">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input
          label="Пошта"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@kpi.ua"
          maxLength={255}
        />
        <Input
          label="Telegram"
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
          placeholder="@username"
          maxLength={120}
        />
        <Button type="submit" disabled={busy || !dirty} className="py-3">
          Зберегти
        </Button>
      </form>
      <p className="mt-3 text-sm text-subtle">
        Пошта або Telegram — щоб ми могли звʼязатися з вами щодо шар.
      </p>
      <ErrorText>{error}</ErrorText>
      {saved && !dirty && <p className="mt-2 text-sm text-brand-green">Збережено</p>}
    </Panel>
  );
}

function AddShari({ view, api, onChange }: Props) {
  const disciplines = view.courses.map((c) => c.discipline);
  const [discipline, setDiscipline] = useState(disciplines[0] ?? OTHER);
  const [otherDiscipline, setOtherDiscipline] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [extraGroups, setExtraGroups] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [bonus, setBonus] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, setError, run } = useAction();

  const courseGroups =
    view.courses.find((c) => c.discipline === discipline)?.groups ?? [];
  const shown = [
    ...courseGroups,
    ...extraGroups.filter((g) => !courseGroups.includes(g)),
  ];
  const allChosen = shown.length > 0 && shown.every((g) => chosen.includes(g));

  const pickDiscipline = (value: string) => {
    setDiscipline(value);
    setChosen([]);
    setExtraGroups([]);
  };
  const toggle = (group: string) =>
    setChosen((list) =>
      list.includes(group) ? list.filter((g) => g !== group) : [...list, group],
    );
  const addExtra = () => {
    const wanted = groupKey(extra);
    const group = view.groups.find((g) => groupKey(g) === wanted);
    if (!group) {
      setError('Такої групи немає у списку груп ФІОТ');
      return;
    }
    setError(null);
    setExtra('');
    setExtraGroups((list) => (list.includes(group) ? list : [...list, group]));
    setChosen((list) => (list.includes(group) ? list : [...list, group]));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setDone(null);
    const title = discipline === OTHER ? otherDiscipline.trim() : discipline;
    if (!title) return setError('Вкажіть предмет');
    if (!chosen.length) return setError('Оберіть хоча б одну групу');
    if (!bonus.trim()) return setError('Опишіть шару');
    run(async () => {
      onChange(
        await api.add({ discipline: title, groups: chosen, bonus, condition, quantity }),
      );
      setDone(
        `Додано: ${plural(quantity, SHARI_WORDS)} «${bonus.trim()}» на кожну з обраних груп (${chosen.length}).`,
      );
      setBonus('');
      setCondition('');
      setQuantity(1);
    });
  };

  return (
    <Panel title="Додати шари">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Select
            label="Предмет"
            value={discipline}
            onChange={(e) => pickDiscipline(e.target.value)}
            options={[
              ...disciplines.map((d) => ({ value: d, label: d })),
              { value: OTHER, label: 'Інший предмет' },
            ]}
          />
          {discipline === OTHER && (
            <Input
              label="Назва предмета"
              value={otherDiscipline}
              onChange={(e) => setOtherDiscipline(e.target.value)}
              maxLength={255}
            />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-muted">Групи</span>
          {shown.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {shown.map((group) => (
                <Chip key={group} active={chosen.includes(group)} onClick={() => toggle(group)}>
                  {group}
                </Chip>
              ))}
              {shown.length > 1 && (
                <Chip
                  className="border-dashed"
                  onClick={() => setChosen(allChosen ? [] : shown)}
                >
                  {allChosen ? 'Зняти всі' : 'Обрати всі'}
                </Chip>
              )}
            </div>
          ) : (
            <p className="text-sm text-subtle">
              За розкладом у вас немає груп з цього предмета — додайте групу нижче.
            </p>
          )}
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addExtra();
                }
              }}
              list="shari-all-groups"
              placeholder="Інша група, наприклад ІП-61"
            />
            <datalist id="shari-all-groups">
              {view.groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <Button type="button" variant="outline" onClick={addExtra} disabled={!extra.trim()}>
              Додати
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Input
            label="Шара"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            placeholder="Наприклад: +5 балів до рейтингу"
            maxLength={300}
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Chip key={preset} active={bonus === preset} onClick={() => setBonus(preset)}>
                {preset}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Input
            label="Скільки на кожну групу"
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(e) => setQuantity(clampQuantity(e.target.value))}
          />
          <Input
            label="Умова (необовʼязково)"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="Наприклад: за умови допуску до екзамену"
            maxLength={300}
          />
        </div>

        <ErrorText>{error}</ErrorText>
        {done && <Banner tone="ok">{done}</Banner>}
        <Button type="submit" size="lg" disabled={busy} className="self-start">
          Додати шари
        </Button>
      </form>
    </Panel>
  );
}

function MyShari({ view, api, onChange }: Props) {
  const byDiscipline = new Map<string, TeacherShara[]>();
  for (const shara of view.shari) {
    byDiscipline.set(shara.discipline, [...(byDiscipline.get(shara.discipline) ?? []), shara]);
  }
  const total = view.shari.reduce((n, s) => n + s.quantity, 0);

  return (
    <Panel
      title="Ваші шари"
      aside={total > 0 && <span className="text-sm text-subtle">Разом: {plural(total, SHARI_WORDS)}</span>}
    >
      {view.shari.length === 0 ? (
        <p className="text-subtle">Поки що ви не додали жодної шари.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...byDiscipline].map(([discipline, list]) => (
            <div key={discipline}>
              <h3 className="mb-2 font-bold">{discipline}</h3>
              <ul className="divide-y divide-border/70">
                {list.map((shara) => (
                  <SharaRow key={shara.id} shara={shara} open={view.open} api={api} onChange={onChange} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SharaRow({
  shara,
  open,
  api,
  onChange,
}: {
  shara: TeacherShara;
  open: boolean;
  api: Api;
  onChange: (view: TeacherView) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [bonus, setBonus] = useState(shara.bonus);
  const [condition, setCondition] = useState(shara.condition ?? '');
  const [quantity, setQuantity] = useState(shara.quantity);
  const { busy, error, run } = useAction();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      onChange(await api.update(shara.id, { bonus, condition, quantity }));
      setEditing(false);
    });
  };
  const remove = () => {
    if (!window.confirm(`Видалити шари «${shara.bonus}» для ${shara.group}?`)) return;
    run(async () => onChange(await api.remove(shara.id)));
  };

  if (editing) {
    return (
      <li className="py-4">
        <form onSubmit={save} className="flex flex-col gap-3">
          <span className="font-bold text-brand-cyan">{shara.group}</span>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <input className={inputClass} value={bonus} onChange={(e) => setBonus(e.target.value)} maxLength={300} aria-label="Шара" />
            <input
              className={inputClass}
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(clampQuantity(e.target.value))}
              aria-label="Кількість"
            />
          </div>
          <input
            className={inputClass}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="Умова (необовʼязково)"
            maxLength={300}
            aria-label="Умова"
          />
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Зберегти
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Скасувати
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <span className="w-24 shrink-0 font-bold text-brand-cyan">{shara.group}</span>
      <span className="min-w-[12rem] flex-1">
        <b>{shara.quantity} ×</b> {shara.bonus}
        {shara.condition && (
          <span className="block text-sm text-subtle">Умова: {shara.condition}</span>
        )}
      </span>
      {open && (
        <span className="flex gap-1">
          <Button variant="outline" className="px-4 py-1.5" onClick={() => setEditing(true)}>
            Змінити
          </Button>
          <Button variant="ghost" className="px-3 py-1.5" onClick={remove} disabled={busy}>
            Видалити
          </Button>
        </span>
      )}
      {error && (
        <span className="w-full">
          <ErrorText>{error}</ErrorText>
        </span>
      )}
    </li>
  );
}
