'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type EventInput, type EventQuestionType } from '@/lib/api';
import { Input } from '../ui/Input';
import { RichTextArea } from '../RichTextArea';
import { Button } from '../ui/Button';
import { FormError } from '@/components/ui/FormError';
import { focusFirstOf, useFormErrors } from '@/lib/formErrors';
import { ImageUpload } from '../ImageUpload';
import { useMainButton } from '@/lib/telegram';

export const FACULTY_OPTIONS = [
  { value: 'ФІОТ', label: 'ФІОТ (Факультет інформатики та обчислювальної техніки)' },
  { value: 'ФПМ', label: 'ФПМ (Факультет прикладної математики)' },
  { value: 'ННІПСА', label: 'ННІПСА (ННІ прикладного системного аналізу)' },
  { value: 'ФЛ', label: 'ФЛ (Факультет лінгвістики)' },
  { value: 'ІХФ', label: 'ІХФ (Інженерно-хімічний факультет)' },
  { value: 'ФСП', label: 'ФСП (Факультет соціології і права)' },
  { value: 'ФБМІ', label: 'ФБМІ (Факультет біомедичної інженерії)' },
  { value: 'ФБТ', label: 'ФБТ (Факультет біотехнології і біотехніки)' },
  { value: 'ФЕЛ', label: 'ФЕЛ (Факультет електроніки)' },
  { value: 'ФЕА', label: 'ФЕА (Факультет електроенерготехніки та автоматики)' },
  { value: 'РТФ', label: 'РТФ (Радіотехнічний факультет)' },
  { value: 'ННФТІ', label: 'ННФТІ (Фізико-технічний інститут)' },
  { value: 'ПБФ', label: 'ПБФ (Приладобудівний факультет)' },
  { value: 'ХТФ', label: 'ХТФ (Хіміко-технологічний факультет)' },
  { value: 'ННВПІ', label: 'ННВПІ (Видавничо-поліграфічний інститут)' },
  { value: 'ННІАТ', label: 'ННІАТ (ННІ аерокосмічних технологій)' },
  { value: 'ННІЕЕ', label: 'ННІЕЕ (ННІ енергозбереження та енергоменеджменту)' },
  { value: 'ННММІ', label: 'ННММІ (Механіко-машинобудівний інститут)' },
  { value: 'ННІМЗ', label: 'ННІМЗ (ННІ матеріалознавства та зварювання)' },
  { value: 'ФМФ', label: 'ФМФ (Фізико-математичний факультет)' },
  { value: 'ННІАТЕ', label: 'ННІАТЕ (ННІ атомної та теплової енергетики)' },
  { value: 'ФММ', label: 'ФММ (Факультет менеджменту та маркетингу)' },
  { value: 'ННІТС', label: 'ННІТС (ННІ телекомунікаційних систем)' },
];

const schema = z.object({
  name: z.string().min(1, 'Вкажи назву').max(50, 'Максимум 50 символів'),
  date: z.string().min(1, 'Вкажи дату'),
  hasTime: z.boolean().optional(),
  time: z.string().optional(),
  photoUrl: z.string().nullable().optional(),
  description: z.string().optional(),
  isAbitfest: z.boolean().optional(),
  noRegistration: z.boolean().optional(),
  isDraft: z.boolean().optional(),
  location: z.string().max(120, 'Максимум 120 символів').optional(),
  locationNote: z.string().optional(),
  timeNote: z.string().max(120, 'Максимум 120 символів').optional(),
  registrationCloseDate: z.string().optional(),
  photoAlbumUrl: z.string().optional(),
  feeAmount: z.string().optional(),
  feeAtEventAmount: z.string().optional(),
  feeRequisites: z.string().max(255, 'Максимум 255 символів').optional(),
  moneyCollected: z.string().optional(),
  charityAmount: z.string().optional(),
  visitorsAmount: z.string().optional(),
});

type ScalarValues = z.infer<typeof schema>;

export interface ProgramItem {
  time: string;
  title: string;
}

export interface QuestionItem {
  id?: string;
  label: string;
  type: EventQuestionType;
  required: boolean;
  optionsText: string;
}

export interface BaseQuestionConfig {
  enabled: boolean;
  required: boolean;
  label: string;
}

export interface BaseQuestionsConfig {
  fullName: BaseQuestionConfig;
  telegramTag: BaseQuestionConfig;
  group: BaseQuestionConfig;
  birthDate: BaseQuestionConfig;
  phone: BaseQuestionConfig;
}

export const DEFAULT_BASE_QUESTIONS: BaseQuestionsConfig = {
  fullName: { enabled: true, required: true, label: 'ПІБ' },
  telegramTag: { enabled: true, required: true, label: 'Telegram-тег' },
  group: { enabled: true, required: true, label: 'Академічна група' },
  birthDate: { enabled: true, required: false, label: 'Дата народження' },
  phone: { enabled: false, required: false, label: 'Номер телефону' },
};

export interface PartnerItem {
  name: string;
  logoImage?: string | null;
  websiteLink?: string;
}

export type EventFormValues = ScalarValues & {
  program: ProgramItem[];
  questions: QuestionItem[];
  allowedFaculties: string[];
  baseQuestionsConfig: BaseQuestionsConfig;
  checkInStaffTags?: string[];
  partners?: PartnerItem[];
};

export function eventValuesToInput(v: EventFormValues): EventInput {
  let isoDate: string;
  if (v.hasTime !== false && v.time?.trim()) {
    isoDate = new Date(`${v.date}T${v.time.trim()}`).toISOString();
  } else {
    isoDate = new Date(`${v.date}T00:00:00`).toISOString();
  }

  return {
    name: v.name,
    date: isoDate,
    hasTime: v.hasTime !== false && !!v.time?.trim(),
    time: v.hasTime !== false && v.time?.trim() ? v.time.trim() : undefined,
    photoUrl: v.photoUrl ?? undefined,
    description: v.description?.trim() || undefined,
    location: v.location?.trim() || undefined,
    locationNote: v.locationNote?.trim() || undefined,
    timeNote: v.timeNote?.trim() || undefined,
    registrationCloseDate: v.registrationCloseDate
      ? new Date(v.registrationCloseDate).toISOString()
      : undefined,
    photoAlbumUrl: v.photoAlbumUrl?.trim() || undefined,
    feeAmount: v.feeAmount ? Number(v.feeAmount) : undefined,
    feeAtEventAmount: v.feeAtEventAmount ? Number(v.feeAtEventAmount) : undefined,
    feeRequisites: v.feeRequisites?.trim() || undefined,
    isAbitfest: v.isAbitfest ?? false,
    noRegistration: v.noRegistration ?? false,
    isDraft: v.isDraft ?? false,
    allowedFaculties: v.allowedFaculties ?? [],
    checkInStaffTags: v.checkInStaffTags ?? [],
    baseQuestionsConfig: v.baseQuestionsConfig ?? DEFAULT_BASE_QUESTIONS,
    program: v.program
      .filter((p) => p.time.trim() || p.title.trim())
      .map((p, i) => ({ time: p.time, title: p.title, order: i })),
    questions: v.questions
      .filter((q) => q.label.trim())
      .map((q, i) => ({
        id: q.id,
        label: q.label,
        type: q.type,
        required: q.required,
        options:
          q.type === 'SINGLE_CHOICE'
            ? (q.optionsText ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        order: i,
      })),
    partners: v.partners
      ?.filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        logoImage: p.logoImage ?? undefined,
        websiteLink: p.websiteLink?.trim() || undefined,
      })),
  };
}

const QUESTION_TYPES: { value: EventQuestionType; label: string }[] = [
  { value: 'SHORT_TEXT', label: 'Коротка відповідь' },
  { value: 'LONG_TEXT', label: 'Розгорнута відповідь' },
  { value: 'SINGLE_CHOICE', label: 'Один з варіантів' },
  { value: 'YES_NO', label: 'Так / Ні' },
];

export function EventForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  error,
  partnersSlot,
  draftKey,
}: {
  defaultValues?: Partial<EventFormValues>;
  onSubmit: (values: EventFormValues) => void;
  submitting: boolean;
  submitLabel: string;
  error?: unknown;
  partnersSlot?: React.ReactNode;
  draftKey?: string;
}) {
  const {
    program: dfProgram,
    questions: dfQuestions,
    allowedFaculties: dfFaculties,
    baseQuestionsConfig: dfBaseQuestions,
    checkInStaffTags: dfCheckInStaffTags,
    partners: dfPartners,
    ...scalarDefaults
  } = defaultValues ?? {};

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ScalarValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      date: '',
      hasTime: true,
      time: '',
      photoUrl: null,
      description: '',
      isAbitfest: false,
      noRegistration: false,
      isDraft: false,
      location: '',
      locationNote: '',
      timeNote: '',
      registrationCloseDate: '',
      photoAlbumUrl: '',
      feeAmount: '',
      feeAtEventAmount: '',
      feeRequisites: '',
      moneyCollected: '',
      charityAmount: '',
      visitorsAmount: '',
      ...scalarDefaults,
    },
  });

  const [programItems, setProgramItems] = useState<ProgramItem[]>(dfProgram ?? []);
  const [questionItems, setQuestionItems] = useState<QuestionItem[]>(dfQuestions ?? []);
  const [allowedFaculties, setAllowedFaculties] = useState<string[]>(dfFaculties ?? []);
  const [baseQuestions, setBaseQuestions] = useState<BaseQuestionsConfig>(
    dfBaseQuestions ?? DEFAULT_BASE_QUESTIONS,
  );
  const [checkInStaffTags, setCheckInStaffTags] = useState<string[]>(
    dfCheckInStaffTags ?? [],
  );
  const [newStaffTag, setNewStaffTag] = useState('');
  const [partners, setPartners] = useState<PartnerItem[]>(dfPartners ?? []);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerLogo, setNewPartnerLogo] = useState<string | null>(null);
  const [newPartnerLink, setNewPartnerLink] = useState('');
  const [hasDraftNotice, setHasDraftNotice] = useState(false);

  // Local storage draft restoration
  useEffect(() => {
    if (!draftKey || typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setHasDraftNotice(true);
      }
    } catch {}
  }, [draftKey]);

  const restoreDraft = () => {
    if (!draftKey || typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.scalars) {
          Object.entries(parsed.scalars).forEach(([k, v]) => {
            setValue(k as any, v as any, { shouldDirty: true });
          });
        }
        if (parsed.program) setProgramItems(parsed.program);
        if (parsed.questions) setQuestionItems(parsed.questions);
        if (parsed.allowedFaculties) setAllowedFaculties(parsed.allowedFaculties);
        if (parsed.baseQuestions) setBaseQuestions(parsed.baseQuestions);
        if (parsed.checkInStaffTags) setCheckInStaffTags(parsed.checkInStaffTags);
        if (parsed.partners) setPartners(parsed.partners);
        setHasDraftNotice(false);
      }
    } catch {}
  };

  const clearDraft = () => {
    if (!draftKey || typeof window === 'undefined') return;
    try {
      localStorage.removeItem(draftKey);
      setHasDraftNotice(false);
    } catch {}
  };

  const photo = watch('photoUrl');
  const description = watch('description');
  const hasTime = watch('hasTime');
  const noRegistration = watch('noRegistration');
  const isDraft = watch('isDraft');

  const { formRef, onInvalid, fieldErrors, serverMessages } = useFormErrors(
    error,
    setError,
    [...Object.keys(schema.shape), 'program', 'questions'],
  );
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const itemError = (key: string) => itemErrors[key] ?? fieldErrors[key];

  const clearItemError = (key: string) =>
    setItemErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const validateItems = () => {
    const found: Record<string, string> = {};
    programItems.forEach((item, i) => {
      if (item.time.trim().length > 20) {
        found[`program.${i}.time`] = 'Максимум 20 символів';
      }
      if (!item.title.trim()) {
        found[`program.${i}.title`] = 'Вкажи назву пункту';
      } else if (item.title.trim().length > 120) {
        found[`program.${i}.title`] = 'Максимум 120 символів';
      }
    });
    questionItems.forEach((q, i) => {
      if (!q.label.trim()) {
        found[`questions.${i}.label`] = 'Вкажи текст питання';
      } else if (q.label.trim().length > 200) {
        found[`questions.${i}.label`] = 'Максимум 200 символів';
      }
    });
    return found;
  };

  const submit = handleSubmit((scalars) => {
    const found = validateItems();
    setItemErrors(found);
    const keys = Object.keys(found);
    if (keys.length > 0) {
      focusFirstOf(formRef.current, keys);
      return;
    }

    if (draftKey && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(draftKey);
      } catch {}
    }

    onSubmit({
      ...scalars,
      program: programItems,
      questions: questionItems,
      allowedFaculties,
      baseQuestionsConfig: baseQuestions,
      checkInStaffTags,
      partners,
    });
  }, onInvalid);

  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  const addStaffTag = () => {
    let tag = newStaffTag.trim();
    if (!tag) return;
    if (!tag.startsWith('@')) tag = `@${tag}`;
    tag = tag.toLowerCase();
    if (!checkInStaffTags.includes(tag)) {
      setCheckInStaffTags([...checkInStaffTags, tag]);
    }
    setNewStaffTag('');
  };

  const removeStaffTag = (tagToRemove: string) => {
    setCheckInStaffTags(checkInStaffTags.filter((t) => t !== tagToRemove));
  };

  const addProgram = () => setProgramItems((p) => [...p, { time: '', title: '' }]);
  const removeProgram = (i: number) =>
    setProgramItems((p) => p.filter((_, idx) => idx !== i));
  const updateProgram = (i: number, field: 'time' | 'title', value: string) =>
    setProgramItems((p) =>
      p.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)),
    );

  const addQuestion = () =>
    setQuestionItems((q) => [
      ...q,
      { label: '', type: 'SHORT_TEXT', required: false, optionsText: '' },
    ]);
  const removeQuestion = (i: number) =>
    setQuestionItems((q) => q.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, patch: Partial<QuestionItem>) =>
    setQuestionItems((q) => q.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const toggleFaculty = (fac: string) => {
    setAllowedFaculties((prev) =>
      prev.includes(fac) ? prev.filter((f) => f !== fac) : [...prev, fac],
    );
  };

  const addInlinePartner = () => {
    if (!newPartnerName.trim()) return;
    setPartners((prev) => [
      ...prev,
      {
        name: newPartnerName.trim(),
        logoImage: newPartnerLogo,
        websiteLink: newPartnerLink.trim() || undefined,
      },
    ]);
    setNewPartnerName('');
    setNewPartnerLogo(null);
    setNewPartnerLink('');
  };

  const removeInlinePartner = (index: number) => {
    setPartners((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5">
      {hasDraftNotice && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-cyan/40 bg-brand-cyan/10 p-4">
          <div className="text-xs text-brand-cyan font-medium">
            📝 Знайдено збережену чернетку цієї форми!
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded-lg bg-brand-cyan px-3 py-1 text-xs font-bold text-black"
            >
              Відновити
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-muted hover:text-fg"
            >
              Очистити
            </button>
          </div>
        </div>
      )}

      {/* 1. Назва */}
      <Input label="Назва" {...register('name')} error={errors.name?.message} />

      {/* 2. Дата і час заходу (розділені) */}
      <div className="rounded-2xl border border-border bg-bg-soft p-4 space-y-3">
        <p className="text-sm font-semibold text-muted">Дата та час проведення</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Дата заходу"
            type="date"
            {...register('date')}
            error={errors.date?.message}
          />
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted">
              Точний час (необовʼязково)
            </label>
            <input
              type="time"
              disabled={hasTime === false}
              {...register('time')}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-fg outline-none transition-colors focus:border-brand-cyan disabled:opacity-40"
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-muted">
          <input
            type="checkbox"
            {...register('hasTime')}
            className="size-4 shrink-0 accent-brand-cyan"
          />
          <span>Вказувати точний час заходу для відвідувачів</span>
        </label>
        {hasTime === false && (
          <p className="text-xs text-amber-400/90 leading-relaxed">
            ⚠️ Безпековий режим: точний час не буде оприлюднено на сторінці заходу.
          </p>
        )}
      </div>

      {/* 3. Обкладинка */}
      <ImageUpload
        label="Обкладинка"
        value={photo}
        onChange={(url) => setValue('photoUrl', url, { shouldDirty: true })}
      />

      {/* 4. Опис */}
      <RichTextArea
        label="Опис (про захід)"
        value={description ?? ''}
        onChange={(v) => setValue('description', v, { shouldDirty: true })}
      />

      {/* 5. Деталі сторінки */}
      <div className="rounded-2xl border border-border bg-bg-soft p-4">
        <p className="mb-3 text-sm font-semibold text-muted">Деталі сторінки</p>
        <div className="flex flex-col gap-4">
          <Input
            label="Локація"
            {...register('location')}
            error={errors.location?.message}
          />
          <Input
            label="Посилання на Google Maps"
            placeholder="https://maps.app.goo.gl/…"
            {...register('locationNote')}
            error={errors.locationNote?.message}
          />
          <Input
            label="Час — уточнення (напр. «Збір з 16:30»)"
            {...register('timeNote')}
            error={errors.timeNote?.message}
          />
          <Input
            label="Закриття реєстрації"
            type="datetime-local"
            {...register('registrationCloseDate')}
            error={errors.registrationCloseDate?.message}
          />
          <Input
            label="Посилання на фотоальбом (після заходу)"
            placeholder="https://…"
            {...register('photoAlbumUrl')}
            error={errors.photoAlbumUrl?.message}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <Input
                label="Внесок онлайн, ₴ (0 = безкоштовно)"
                type="number"
                min="0"
                inputMode="numeric"
                {...register('feeAmount')}
                error={errors.feeAmount?.message}
              />
            </div>
            <div className="min-w-0">
              <Input
                label="Внесок на заході, ₴"
                type="number"
                min="0"
                inputMode="numeric"
                {...register('feeAtEventAmount')}
                error={errors.feeAtEventAmount?.message}
              />
            </div>
          </div>
          <Input
            label="Реквізити для донату (текст або посилання)"
            {...register('feeRequisites')}
            error={errors.feeRequisites?.message}
          />
        </div>
      </div>

      {/* 6. Програма */}
      <div className="rounded-2xl border border-border bg-bg-soft p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold text-muted">Програма заходу</p>
          <button
            type="button"
            onClick={addProgram}
            className="shrink-0 rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold text-brand-cyan"
          >
            + Пункт
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {programItems.map((item, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="w-20 shrink-0 sm:w-24">
                <Input
                  label="Час"
                  placeholder="17:00"
                  className="px-3"
                  name={`program.${i}.time`}
                  value={item.time}
                  error={itemError(`program.${i}.time`)}
                  onChange={(e) => {
                    clearItemError(`program.${i}.time`);
                    updateProgram(i, 'time', e.target.value);
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  label="Пункт"
                  name={`program.${i}.title`}
                  value={item.title}
                  error={itemError(`program.${i}.title`)}
                  onChange={(e) => {
                    clearItemError(`program.${i}.title`);
                    updateProgram(i, 'title', e.target.value);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeProgram(i)}
                className="mb-1 shrink-0 rounded-lg border border-brand-red/40 px-3 py-2.5 text-sm font-bold text-brand-red"
                aria-label="Видалити пункт"
              >
                ✕
              </button>
            </div>
          ))}
          {programItems.length === 0 && (
            <p className="text-sm text-subtle">Поки що немає пунктів програми.</p>
          )}
        </div>
      </div>

      {/* 7. ПЕРЕД ПИТАННЯМИ: Подія не має реєстрації */}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-bg-soft px-4 py-3.5 transition-colors hover:border-white/20">
        <input
          type="checkbox"
          {...register('noRegistration')}
          className="mt-0.5 size-5 shrink-0 accent-brand-cyan"
        />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-fg">
            Подія не має реєстрації
          </span>
          <span className="mt-1 block text-xs text-subtle">
            На сторінці події не буде форми реєстрації. Увімкни, якщо вхід повністю вільний.
          </span>
        </span>
      </label>

      {/* 8. Блоки реєстрації (якщо реєстрація увімкнена) */}
      {!noRegistration && (
        <>
          {/* Обмеження за факультетами */}
          <div className="rounded-2xl border border-border bg-bg-soft p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-muted">
                  Дозволені факультети для реєстрації
                </p>
                <p className="text-xs text-subtle">
                  За замовчуванням дозволено всім факультетам
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAllowedFaculties([])}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-bold ${
                    allowedFaculties.length === 0
                      ? 'border-brand-cyan bg-brand-cyan/20 text-brand-cyan'
                      : 'border-border text-muted hover:text-fg'
                  }`}
                >
                  Всі факультети
                </button>
                <button
                  type="button"
                  onClick={() => setAllowedFaculties(['ФІОТ'])}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-bold ${
                    allowedFaculties.length === 1 && allowedFaculties[0] === 'ФІОТ'
                      ? 'border-brand-green bg-brand-green/20 text-brand-green'
                      : 'border-border text-muted hover:text-fg'
                  }`}
                >
                  Тільки ФІОТ
                </button>
              </div>
            </div>

            {allowedFaculties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {FACULTY_OPTIONS.map((f) => {
                  const active = allowedFaculties.includes(f.value);
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => toggleFaculty(f.value)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        active
                          ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan font-bold'
                          : 'border-border text-muted hover:text-fg bg-surface'
                      }`}
                    >
                      {f.value} {active ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Базові питання */}
          <div className="rounded-2xl border border-border bg-bg-soft p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-muted">Налаштування базових питань</p>
              <p className="text-xs text-subtle">
                Керуй обовʼязковістю та назвами стандартних полів анкети
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                { key: 'fullName', defLabel: 'ПІБ', defaultReq: true },
                { key: 'telegramTag', defLabel: 'Telegram-тег', defaultReq: true },
                { key: 'group', defLabel: 'Академічна група', defaultReq: true },
                { key: 'birthDate', defLabel: 'Дата народження', defaultReq: false },
                { key: 'phone', defLabel: 'Номер телефону', defaultReq: false },
              ].map(({ key, defLabel }) => {
                const cfg = baseQuestions[key as keyof BaseQuestionsConfig];
                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) =>
                          setBaseQuestions((prev) => ({
                            ...prev,
                            [key]: { ...prev[key as keyof BaseQuestionsConfig], enabled: e.target.checked },
                          }))
                        }
                        className="size-4 shrink-0 accent-brand-cyan cursor-pointer"
                      />
                      <input
                        type="text"
                        value={cfg.label}
                        onChange={(e) =>
                          setBaseQuestions((prev) => ({
                            ...prev,
                            [key]: { ...prev[key as keyof BaseQuestionsConfig], label: e.target.value },
                          }))
                        }
                        placeholder={defLabel}
                        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-fg outline-none border-b border-transparent focus:border-brand-cyan"
                      />
                    </div>
                    {cfg.enabled && (
                      <label className="flex items-center gap-2 text-xs text-muted shrink-0 pl-7 sm:pl-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cfg.required}
                          onChange={(e) =>
                            setBaseQuestions((prev) => ({
                              ...prev,
                              [key]: {
                                ...prev[key as keyof BaseQuestionsConfig],
                                required: e.target.checked,
                              },
                            }))
                          }
                          className="size-3.5 accent-brand-green"
                        />
                        <span>Обовʼязкове</span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Питання реєстрації (кастомні) */}
          <div className="rounded-2xl border border-border bg-bg-soft p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-sm font-semibold text-muted">
                Додаткові питання реєстрації
              </p>
              <button
                type="button"
                onClick={addQuestion}
                className="shrink-0 rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold text-brand-cyan"
              >
                + Питання
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {questionItems.map((q, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Input
                        label={`Питання ${i + 1}`}
                        name={`questions.${i}.label`}
                        value={q.label}
                        error={itemError(`questions.${i}.label`)}
                        onChange={(e) => {
                          clearItemError(`questions.${i}.label`);
                          updateQuestion(i, { label: e.target.value });
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(i)}
                      className="mb-1 shrink-0 rounded-lg border border-brand-red/40 px-3 py-2.5 text-sm font-bold text-brand-red"
                      aria-label="Видалити питання"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <label className="text-sm font-semibold text-muted">Тип</label>
                      <select
                        value={q.type}
                        onChange={(e) =>
                          updateQuestion(i, { type: e.target.value as EventQuestionType })
                        }
                        className="w-full rounded-xl border border-border bg-bg-soft px-4 py-3 text-fg outline-none"
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex min-w-0 items-center gap-2 text-sm text-muted sm:mb-3">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-brand-green"
                        checked={q.required}
                        onChange={(e) => updateQuestion(i, { required: e.target.checked })}
                      />
                      Обовʼязкове
                    </label>
                  </div>
                  {q.type === 'SINGLE_CHOICE' && (
                    <Input
                      label="Варіанти (через кому)"
                      placeholder="Так, Ні, Можливо"
                      value={q.optionsText}
                      onChange={(e) => updateQuestion(i, { optionsText: e.target.value })}
                    />
                  )}
                </div>
              ))}
              {questionItems.length === 0 && (
                <p className="text-sm text-subtle">
                  Немає додаткових питань. Будуть збиратися лише базові поля вище.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* 9. Результати */}
      <div className="rounded-2xl border border-border bg-bg-soft p-4">
        <p className="mb-3 text-sm font-semibold text-muted">
          Результати (необовʼязково)
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Input
              label="Зібрано, ₴"
              type="number"
              min="0"
              inputMode="numeric"
              {...register('moneyCollected')}
              error={errors.moneyCollected?.message}
            />
          </div>
          <div className="min-w-0">
            <Input
              label="На благодійність, ₴"
              type="number"
              min="0"
              inputMode="numeric"
              {...register('charityAmount')}
              error={errors.charityAmount?.message}
            />
          </div>
          <div className="min-w-0">
            <Input
              label="Відвідувачів"
              type="number"
              min="0"
              inputMode="numeric"
              {...register('visitorsAmount')}
              error={errors.visitorsAmount?.message}
            />
          </div>
        </div>
      </div>

      {/* 10. ПІСЛЯ ВСІХ БЛОКІВ: Ця подія є Абітфестом */}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-bg-soft px-4 py-3.5 transition-colors hover:border-white/20">
        <input
          type="checkbox"
          {...register('isAbitfest')}
          className="mt-0.5 size-5 shrink-0 accent-brand-cyan"
        />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-fg">
            Ця подія є Абітфестом
          </span>
          <span className="mt-1 block text-xs text-subtle">
            Така подія додатково показується на сторінці департаменту роботи з абітурієнтами.
          </span>
        </span>
      </label>

      {/* 11. ЧЕРНЕТКА */}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-bg-soft px-4 py-3.5 transition-colors hover:border-white/20">
        <input
          type="checkbox"
          {...register('isDraft')}
          className="mt-0.5 size-5 shrink-0 accent-purple-400"
        />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-fg">
            Зберегти як чернетку
          </span>
          <span className="mt-1 block text-xs text-subtle">
            Захід буде прихований від публічного сайту та ботів, поки ви не знімете цей прапорець.
          </span>
        </span>
      </label>

      {/* 11.5 ВІДМІТКА НА ВХОДІ / ЧЕК-ІН */}
      <div className="rounded-2xl border border-border bg-bg-soft p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-fg">📋 Волонтери для відмітки (Check-in)</p>
          <span className="text-xs text-muted">
            {checkInStaffTags.length > 0 ? `${checkInStaffTags.length} додано` : 'Тільки адміни'}
          </span>
        </div>
        <p className="text-xs text-subtle leading-relaxed">
          Усі учасники робочого чату студради автоматично мають доступ до відмітки в боті. 
          Якщо на цьому заході допомагають інші студенти або волонтери — вкажіть їхні Telegram-теги (@username), щоб надати їм доступ до списку чек-іну для цієї події.
        </p>

        {checkInStaffTags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {checkInStaffTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-2.5 py-1 text-xs font-semibold text-brand-cyan"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeStaffTag(tag)}
                  className="rounded-full p-0.5 hover:bg-brand-cyan/20 text-brand-cyan hover:text-white transition-colors"
                  aria-label={`Видалити ${tag}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="@username волонтера"
              value={newStaffTag}
              onChange={(e) => setNewStaffTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addStaffTag();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addStaffTag}
            disabled={!newStaffTag.trim()}
            className="shrink-0 text-xs font-bold px-4"
          >
            + Додати
          </Button>
        </div>
      </div>

      {/* 12. ПЕРЕД КНОПКОЮ ЗБЕРЕГТИ: Партнери заходу */}
      {partnersSlot ? (
        partnersSlot
      ) : (
        <div className="rounded-2xl border border-border bg-bg-soft p-4 space-y-3">
          <p className="text-sm font-semibold text-muted">Партнери заходу</p>
          <p className="text-xs text-subtle">
            Партнери саме для цього заходу. Можна додати логотип та посилання.
          </p>

          {partners.length > 0 && (
            <ul className="flex flex-col gap-2">
              {partners.map((p, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 border border-border"
                >
                  <span className="text-sm font-semibold truncate">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => removeInlinePartner(idx)}
                    className="text-xs text-brand-red font-bold hover:underline"
                  >
                    Видалити
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-border bg-surface p-3 space-y-3">
            <Input
              label="Назва партнера"
              placeholder="Наприклад: Genesis"
              value={newPartnerName}
              onChange={(e) => setNewPartnerName(e.target.value)}
            />
            <ImageUpload
              label="Логотип партнера"
              value={newPartnerLogo}
              onChange={setNewPartnerLogo}
            />
            <Input
              label="Посилання на сайт або соцмережі"
              placeholder="https://..."
              value={newPartnerLink}
              onChange={(e) => setNewPartnerLink(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addInlinePartner}
              disabled={!newPartnerName.trim()}
              className="w-full text-xs font-bold"
            >
              + Додати партнера до заходу
            </Button>
          </div>
        </div>
      )}

      <FormError messages={serverMessages} />

      {/* 13. Кнопка Зберегти / Створити */}
      <Button type="submit" disabled={submitting} className="mt-2 py-4 text-base font-black">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
