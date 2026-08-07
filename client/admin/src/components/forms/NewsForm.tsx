'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ImageUpload } from '../ImageUpload';
import { RichTextArea } from '../RichTextArea';
import { FormError } from '@/components/ui/FormError';
import { api } from '@/lib/api';
import { useFormErrors } from '@/lib/formErrors';
import { useMainButton } from '@/lib/telegram';

const CATEGORY_OPTIONS = [
  { value: '', label: '— Без категорії —' },
  { value: 'EVENTS', label: 'Події' },
  { value: 'EDUCATION', label: 'Освіта' },
  { value: 'PARTNERS', label: 'Партнерства' },
  { value: 'CHARITY', label: 'Благодійність' },
  { value: 'ACHIEVEMENTS', label: 'Досягнення' },
];

const linkSchema = z.string().url();

const isLink = (value?: string) =>
  !value || value.startsWith('/') || linkSchema.safeParse(value).success;

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const schema = z
  .object({
    title: z.string().min(1, 'Вкажи заголовок').max(50, 'Максимум 50 символів'),
    details: z.string().optional(),
    image: z.string().nullable().optional(),
    category: z
      .enum(['', 'EVENTS', 'EDUCATION', 'PARTNERS', 'CHARITY', 'ACHIEVEMENTS'], {
        error: 'Обери категорію зі списку',
      })
      .optional(),
    isEvent: z.boolean().optional(),
    eventDate: z.string().optional(),
    eventLocation: z.string().optional(),
    registrationLink: z.string().optional(),
  })
  .refine((v) => !v.isEvent || !!v.eventDate?.trim(), {
    message: 'Вкажи дату й час заходу',
    path: ['eventDate'],
  })
  .refine((v) => !v.isEvent || !v.eventDate || !Number.isNaN(Date.parse(v.eventDate)), {
    message: 'Невалідна дата й час заходу',
    path: ['eventDate'],
  })
  .refine((v) => !v.isEvent || (v.eventLocation?.trim().length ?? 0) <= 100, {
    message: 'Максимум 100 символів',
    path: ['eventLocation'],
  })
  .refine((v) => !v.isEvent || isLink(v.registrationLink?.trim()), {
    message: 'Невалідне посилання, приклад: https://example.com або /events/…',
    path: ['registrationLink'],
  });

export type NewsFormValues = z.infer<typeof schema>;

export function NewsForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  error,
}: {
  defaultValues?: Partial<NewsFormValues>;
  onSubmit: (values: NewsFormValues) => void;
  submitting: boolean;
  submitLabel: string;
  error?: unknown;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<NewsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      details: '',
      image: null,
      category: '',
      isEvent: false,
      eventDate: '',
      eventLocation: '',
      registrationLink: '',
      ...defaultValues,
    },
  });

  const image = watch('image');
  const isEvent = watch('isEvent');
  const details = watch('details');
  const { formRef, onInvalid, serverMessages } = useFormErrors(
    error,
    setError,
    Object.keys(schema.shape),
  );

  const [pickedEventId, setPickedEventId] = useState('');
  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.events(1, 50),
    enabled: !!isEvent,
  });

  const eventOptions = [
    { value: '', label: '— не обрано —' },
    ...(events?.items ?? []).map((e) => ({
      value: e.id,
      label: `${e.name} · ${new Date(e.date).toLocaleDateString('uk-UA')}`,
    })),
  ];

  function pickEvent(id: string) {
    setPickedEventId(id);
    const event = events?.items.find((e) => e.id === id);
    if (!event) return;
    const opts = { shouldDirty: true, shouldValidate: true } as const;
    setValue('eventDate', toLocalInput(event.date), opts);
    setValue('eventLocation', event.location ?? '', opts);
    setValue(
      'registrationLink',
      event.noRegistration ? '' : `/events/${event.id}#register`,
      opts,
    );
  }

  const submit = handleSubmit(onSubmit, onInvalid);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Заголовок"
        placeholder="Назва новини"
        {...register('title')}
        error={errors.title?.message}
      />
      <Select
        label="Категорія"
        options={CATEGORY_OPTIONS}
        className="min-w-0"
        {...register('category')}
        error={errors.category?.message}
      />
      <RichTextArea
        label="Текст"
        placeholder="Деталі новини…"
        value={details ?? ''}
        onChange={(v) => setValue('details', v, { shouldDirty: true })}
      />
      <ImageUpload
        label="Обкладинка"
        value={image}
        onChange={(url) => setValue('image', url, { shouldDirty: true })}
      />

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-bg-soft px-4 py-3">
        <input
          type="checkbox"
          {...register('isEvent')}
          className="size-5 shrink-0 accent-brand-cyan"
        />
        <span className="min-w-0 text-sm font-semibold text-muted">
          Це оголошення про захід
        </span>
      </label>

      {isEvent && (
        <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-brand-cyan/40 bg-brand-cyan/5 p-4">
          <div className="flex min-w-0 flex-col gap-1">
            <Select
              label="Обрати захід"
              options={eventOptions}
              className="min-w-0"
              value={pickedEventId}
              onChange={(e) => pickEvent(e.target.value)}
            />
            <p className="break-words text-xs text-subtle">
              Поля нижче заповняться автоматично — їх можна змінити вручну.
            </p>
          </div>
          <Input
            label="Дата й час заходу"
            type="datetime-local"
            className="min-w-0"
            {...register('eventDate')}
            error={errors.eventDate?.message}
          />
          <Input
            label="Локація"
            placeholder="Напр. КПІ, корпус 18"
            {...register('eventLocation')}
            error={errors.eventLocation?.message}
          />
          <Input
            label="Посилання на реєстрацію"
            placeholder="https://…"
            {...register('registrationLink')}
            error={errors.registrationLink?.message}
          />
        </div>
      )}

      <FormError messages={serverMessages} />

      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
