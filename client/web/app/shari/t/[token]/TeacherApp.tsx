'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { GradientText } from '@/components/ui/GradientText';
import { ChevronIcon } from '@/components/ui/icons';
import {
  COUNCIL_EMAIL,
  SHARI_WORDS,
  errorText,
  teacherApi,
  type TeacherShara,
  type TeacherView,
} from '@/lib/shari';
import { cn, plural } from '@/lib/utils';
import { SPHERES, Sphere, Ticket, confetti, sharaColor, type SphereColor } from '../../decor';
import {
  Banner,
  Chip,
  ErrorText,
  Panel,
  QuantityStepper,
  Spinner,
  Step,
  inputClass,
  useAction,
} from '../../ui';

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

const STEPS: { color: SphereColor; title: string; text: string }[] = [
  { color: 'green', title: 'Оберіть групи', text: 'Предмет і групи, яким даруєте шари.' },
  {
    color: 'cyan',
    title: 'Опишіть шару',
    text: 'Що отримає студент і скільки таких шар на кожну групу. Тим самим групам можна дати кілька різних.',
  },
  {
    color: 'purple',
    title: 'Старости розіграють',
    text: 'Студент отримає сертифікат із QR-кодом. Скануйте його: справжній відкриє сторінку Студради з даними шари.',
  },
];

/** "Коваленко Петро Іванович" → "Петро Іванович". */
const addressOf = (fullName: string) => {
  const parts = fullName.split(' ');
  return parts.length >= 3 ? parts.slice(1).join(' ') : fullName;
};

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
  const total = view.shari.reduce((n, s) => n + s.quantity, 0);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Вітаємо, <GradientText>{addressOf(view.fullName)}</GradientText>!
        </p>
        {total > 0 && (
          <span className="rounded-full border border-brand-green/40 bg-brand-green/10 px-4 py-2 text-sm font-bold text-brand-green">
            🎁 Ви вже подарували {plural(total, SHARI_WORDS)}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={step.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-sm">
            <Sphere color={step.color} size={40} className="text-base">
              {i + 1}
            </Sphere>
            <h3 className="mt-4 text-lg font-extrabold">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p>
          </div>
        ))}
      </div>

      <p className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm leading-relaxed text-muted">
        <span aria-hidden>🔒</span>
        <span>
          Це ваше особисте посилання: не пересилайте його й не відкривайте на чужих
          компʼютерах — з ним можна внести шари від вашого імені. Перевіряючи сертифікат,
          переконайтеся, що QR-код відкрив сторінку на <b>fice-sc.kpi.ua</b>, і звірте дані
          зі студентом.
        </span>
      </p>

      {view.open ? (
        <AddShari {...props} />
      ) : (
        <Banner tone="warn">
          Прийом шар завершено. Якщо треба щось змінити — напишіть нам: <Contact />
        </Banner>
      )}
      <MyShari {...props} />
      <Contacts {...props} />
    </>
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
  const submitRef = useRef<HTMLButtonElement>(null);
  const { busy, error, setError, run } = useAction();

  const courseGroups = view.courses.find((c) => c.discipline === discipline)?.groups ?? [];
  const shown = [...courseGroups, ...extraGroups.filter((g) => !courseGroups.includes(g))];
  const allChosen = shown.length > 0 && shown.every((g) => chosen.includes(g));

  const pickDiscipline = (value: string) => {
    setDiscipline(value);
    setChosen([]);
    setExtraGroups([]);
  };
  const toggle = (group: string) =>
    setChosen((list) => (list.includes(group) ? list.filter((g) => g !== group) : [...list, group]));
  const addExtra = () => {
    const group = view.groups.find((g) => groupKey(g) === groupKey(extra));
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
      onChange(await api.add({ discipline: title, groups: chosen, bonus, condition, quantity }));
      confetti(submitRef.current);
      setDone(
        `Додано: ${plural(quantity, SHARI_WORDS)} «${bonus.trim()}» на кожну з обраних груп (${chosen.length}).`,
      );
      setBonus('');
      setCondition('');
      setQuantity(1);
    });
  };

  return (
    <Panel title="Нова шара" icon={<Sphere color="magenta" size={34} className="text-base">🎁</Sphere>}>
      <form onSubmit={submit} className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Step n={1} color="green">
            Предмет
          </Step>
          <div className="relative">
            <select
              className={cn(inputClass, 'appearance-none pr-11')}
              value={discipline}
              onChange={(e) => pickDiscipline(e.target.value)}
              aria-label="Предмет"
            >
              {disciplines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value={OTHER}>Інший предмет…</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-subtle">
              <ChevronIcon />
            </span>
          </div>
          {discipline === OTHER && (
            <input
              className={inputClass}
              value={otherDiscipline}
              onChange={(e) => setOtherDiscipline(e.target.value)}
              placeholder="Назва предмета"
              maxLength={255}
              aria-label="Назва предмета"
            />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Step n={2} color="cyan">
            Групи
          </Step>
          {shown.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {shown.map((group) => (
                <Chip key={group} active={chosen.includes(group)} onClick={() => toggle(group)}>
                  {chosen.includes(group) && '✓ '}
                  {group}
                </Chip>
              ))}
              {shown.length > 1 && (
                <Chip className="border-dashed" onClick={() => setChosen(allChosen ? [] : shown)}>
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
              aria-label="Інша група"
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
          <Step n={3} color="purple">
            Що отримає студент
          </Step>
          <input
            className={cn(inputClass, 'text-lg font-semibold')}
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            placeholder="Наприклад: +5 балів до рейтингу"
            maxLength={300}
            aria-label="Шара"
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Chip key={preset} active={bonus === preset} onClick={() => setBonus(preset)}>
                <span
                  aria-hidden
                  className="mr-2 inline-block size-2.5 rounded-full align-middle"
                  style={{ background: SPHERES[sharaColor(preset)][1] }}
                />
                {preset}
              </Chip>
            ))}
          </div>
          <div className="mt-2 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-muted">Скільки на кожну групу</span>
              <QuantityStepper value={quantity} onChange={setQuantity} />
            </div>
            <label className="flex flex-col gap-2 text-sm font-semibold text-muted">
              Умова (необовʼязково)
              <input
                className={inputClass}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="Наприклад: за умови допуску до екзамену"
                maxLength={300}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <ErrorText>{error}</ErrorText>
          {done && <Banner tone="ok">{done}</Banner>}
          <Button ref={submitRef} type="submit" size="lg" disabled={busy} className="self-start">
            🎁 Подарувати шари
          </Button>
        </div>
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
      icon={<Sphere color="green" size={34} className="text-sm">{total}</Sphere>}
    >
      {view.shari.length === 0 ? (
        <p className="text-muted">Поки що ви не подарували жодної шари — почніть з форми вище.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {[...byDiscipline].map(([discipline, list]) => (
            <div key={discipline} className="flex flex-col gap-3">
              <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-subtle">{discipline}</h3>
              {list.map((shara) => (
                <SharaTicket key={shara.id} shara={shara} open={view.open} api={api} onChange={onChange} />
              ))}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SharaTicket({
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

  return (
    <Ticket
      color={sharaColor(editing ? bonus : shara.bonus)}
      stub={
        <>
          <span className="text-3xl font-black leading-none">×{editing ? quantity : shara.quantity}</span>
          <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.18em]">{shara.group}</span>
        </>
      }
    >
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-3">
          <input className={inputClass} value={bonus} onChange={(e) => setBonus(e.target.value)} maxLength={300} aria-label="Шара" />
          <input
            className={inputClass}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="Умова (необовʼязково)"
            maxLength={300}
            aria-label="Умова"
          />
          <div className="flex flex-wrap items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} />
            <Button type="submit" disabled={busy}>
              Зберегти
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Скасувати
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[12rem] flex-1">
            <p className="text-lg font-extrabold leading-snug">{shara.bonus}</p>
            {shara.condition && <p className="mt-1 text-sm text-muted">Умова: {shara.condition}</p>}
          </div>
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
        </div>
      )}
    </Ticket>
  );
}

function Contacts({ view, api, onChange }: Props) {
  const [email, setEmail] = useState(view.email ?? '');
  const [telegram, setTelegram] = useState(view.telegram ?? '');
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const dirty = email !== (view.email ?? '') || telegram !== (view.telegram ?? '');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      onChange(await api.setContacts({ email, telegram }));
      setSaved(true);
    });
  };

  return (
    <Panel title="Як з вами звʼязатися" icon={<Sphere color="cyan" size={34} className="text-base">✉</Sphere>}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Пошта, наприклад name@kpi.ua"
          maxLength={255}
          aria-label="Пошта"
        />
        <input
          className={inputClass}
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
          placeholder="Telegram, наприклад @username"
          maxLength={120}
          aria-label="Telegram"
        />
        <Button type="submit" disabled={busy || !dirty}>
          Зберегти
        </Button>
      </form>
      <p className="mt-3 text-sm text-subtle">Пошта або Telegram — щоб ми могли звʼязатися з вами щодо шар.</p>
      <ErrorText>{error}</ErrorText>
      {saved && !dirty && <p className="mt-2 text-sm font-semibold text-brand-green">Збережено ✓</p>}
    </Panel>
  );
}
