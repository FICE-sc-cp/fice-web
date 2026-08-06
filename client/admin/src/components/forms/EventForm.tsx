'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type EventInput, type EventQuestionType } from '@/lib/api';
import { Input } from '../ui/Input';
import { RichTextArea } from '../RichTextArea';
import { Button } from '../ui/Button';
import { FormError } from '@/components/ui/FormError';
import { ImageUpload } from '../ImageUpload';
import { useMainButton } from '@/lib/telegram';

const schema = z.object({
  name: z.string().min(1, 'Вкажи назву').max(50, 'Максимум 50 символів'),
  date: z.string().min(1, 'Вкажи дату'),
  photoUrl: z.string().nullable().optional(),
  description: z.string().optional(),
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

export type EventFormValues = ScalarValues & {
  program: ProgramItem[];
  questions: QuestionItem[];
};

export function eventValuesToInput(v: EventFormValues): EventInput {
  return {
    name: v.name,
    date: new Date(v.date).toISOString(),
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
}: {
  defaultValues?: Partial<EventFormValues>;
  onSubmit: (values: EventFormValues) => void;
  submitting: boolean;
  submitLabel: string;
  error?: unknown;
}) {
  const {
    program: dfProgram,
    questions: dfQuestions,
    ...scalarDefaults
  } = defaultValues ?? {};

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ScalarValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      date: '',
      photoUrl: null,
      description: '',
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
  const [questionItems, setQuestionItems] = useState<QuestionItem[]>(
    dfQuestions ?? [],
  );

  const photo = watch('photoUrl');
  const description = watch('description');
  const submit = handleSubmit((scalars) =>
    onSubmit({ ...scalars, program: programItems, questions: questionItems }),
  );
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

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

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Назва" {...register('name')} error={errors.name?.message} />
      <Input
        label="Дата і час"
        type="datetime-local"
        {...register('date')}
        error={errors.date?.message}
      />
      <ImageUpload
        label="Обкладинка"
        value={photo}
        onChange={(url) => setValue('photoUrl', url, { shouldDirty: true })}
      />
      <RichTextArea
        label="Опис (про захід)"
        value={description ?? ''}
        onChange={(v) => setValue('description', v, { shouldDirty: true })}
      />

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

      <div className="rounded-2xl border border-border bg-bg-soft p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold text-muted">Програма</p>
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
                  value={item.time}
                  onChange={(e) => updateProgram(i, 'time', e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  label="Пункт"
                  value={item.title}
                  onChange={(e) => updateProgram(i, 'title', e.target.value)}
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

      <div className="rounded-2xl border border-border bg-bg-soft p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold text-muted">Питання реєстрації</p>
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
                    value={q.label}
                    onChange={(e) => updateQuestion(i, { label: e.target.value })}
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
              Базові поля (ПІБ, Telegram, група, дата народження) збираються завжди.
              Додай свої питання за потреби.
            </p>
          )}
        </div>
      </div>

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

      {hasErrors && (
        <p className="rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          Перевір поля, виділені червоним, і спробуй ще раз.
        </p>
      )}

      <FormError error={error} />

      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
