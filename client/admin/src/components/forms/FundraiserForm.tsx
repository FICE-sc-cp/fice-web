'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { RichTextArea } from '../RichTextArea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { FormError } from '@/components/ui/FormError';
import { api } from '@/lib/api';
import { ApiError, describeDetail, errorText } from '@/lib/errors';
import { useFormErrors } from '@/lib/formErrors';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { timeAgo } from '@/lib/utils';
import { ImageUpload } from '../ImageUpload';
import { useMainButton } from '@/lib/telegram';

const urlField = (example: string) =>
  z
    .union([z.string().url(`Невалідне посилання, приклад: ${example}`), z.literal('')])
    .optional();

const WIDGET_LINK_RE =
  /^https:\/\/([a-z0-9-]+\.)*monobank\.ua\/\S*[?&]jar=[A-Za-z0-9_-]{16,64}(&|$)/;
const WIDGET_LINK_MESSAGE =
  'Потрібне посилання саме на віджет банки — воно містить jar=…, напр. https://send.monobank.ua/widget.html?jar=…';
const PREVIEW_DELAY_MS = 600;

const schema = z
  .object({
    name: z.string().min(1, 'Вкажи назву').max(120, 'Максимум 120 символів'),
    status: z.enum(['ACTIVE', 'CLOSED'], { error: 'Обери статус зі списку' }),
    imageUrl: z.string().nullable().optional(),
    description: z.string().min(1, 'Вкажи короткий опис').max(255, 'Максимум 255 символів'),
    story: z.string().optional(),
    location: z.string().max(100, 'Максимум 100 символів').optional(),
    jarWidgetUrl: z
      .string()
      .max(500, 'Максимум 500 символів')
      .refine((v) => !v.trim() || WIDGET_LINK_RE.test(v.trim()), {
        message: WIDGET_LINK_MESSAGE,
      })
      .optional(),
    goalAmount: z.string().optional(),
    currentAmount: z.string().optional(),
    cardNumber: z.string().max(25, 'Максимум 25 символів').optional(),
    jarUrl: urlField('https://send.monobank.ua/jar/abc123'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    detailsLink: urlField('https://example.com'),
  })
  .refine((v) => !!v.jarWidgetUrl?.trim() || !!v.goalAmount?.trim(), {
    message: 'Вкажи ціль',
    path: ['goalAmount'],
  })
  .refine((v) => !v.endDate || !!v.startDate, {
    message: 'Вкажи дату початку — без неї не можна задати завершення',
    path: ['startDate'],
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'Завершення не може бути раніше за початок',
    path: ['endDate'],
  });

export type FundraiserFormValues = z.infer<typeof schema>;

export interface FundraiserJarState {
  jarWidgetUrl: string | null;
  jarHasGoal: boolean;
  jarSyncedAt: string | null;
  jarSyncError: string | null;
  currentAmount: string;
  goalAmount: string;
  jarUrl: string | null;
}

type JarInfo =
  | { state: 'none' }
  | { state: 'checking' }
  | {
      state: 'known';
      source: 'saved' | 'preview';
      goal: string | null;
      current: string;
      jarUrl: string | null;
      closed: boolean;
    }
  | { state: 'unknown'; reason: string }
  | { state: 'invalid'; message: string };

function useJarInfo(link: string, saved?: FundraiserJarState): JarInfo {
  const debounced = useDebouncedValue(link, PREVIEW_DELAY_MS);
  const settled = debounced === link;
  const looksValid = WIDGET_LINK_RE.test(link);
  const savedKnown = !!saved && saved.jarWidgetUrl === link && !!saved.jarSyncedAt;

  const preview = useQuery({
    queryKey: ['jar-preview', link],
    queryFn: () => api.previewJar(link),
    enabled: settled && looksValid && !savedKnown,
    retry: false,
    staleTime: 60_000,
  });

  if (!link) return { state: 'none' };
  if (saved && savedKnown) {
    return {
      state: 'known',
      source: 'saved',
      goal: saved.jarHasGoal ? saved.goalAmount : null,
      current: saved.currentAmount,
      jarUrl: saved.jarUrl,
      closed: false,
    };
  }
  if (!looksValid) {
    return settled
      ? { state: 'invalid', message: WIDGET_LINK_MESSAGE }
      : { state: 'checking' };
  }
  if (preview.data?.status === 'ok') {
    return {
      state: 'known',
      source: 'preview',
      goal: preview.data.goalAmount,
      current: preview.data.currentAmount,
      jarUrl: preview.data.jarUrl,
      closed: preview.data.closed,
    };
  }
  if (preview.data?.status === 'unavailable') {
    return { state: 'unknown', reason: preview.data.reason };
  }
  if (preview.error) {
    const err = preview.error;
    if (err instanceof ApiError && err.status === 400 && err.details.length > 0) {
      return { state: 'invalid', message: describeDetail(err.details[0]).message };
    }
    return { state: 'unknown', reason: errorText(err) };
  }
  return { state: 'checking' };
}

const uah = (value: string) => Number(value).toLocaleString('uk-UA');

export function FundraiserForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  error,
  jar,
}: {
  defaultValues?: Partial<FundraiserFormValues>;
  onSubmit: (values: FundraiserFormValues) => void;
  submitting: boolean;
  submitLabel: string;
  error?: unknown;
  jar?: FundraiserJarState;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FundraiserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      status: 'ACTIVE',
      imageUrl: null,
      description: '',
      story: '',
      location: '',
      jarWidgetUrl: '',
      goalAmount: '',
      currentAmount: '',
      cardNumber: '',
      jarUrl: '',
      startDate: '',
      endDate: '',
      detailsLink: '',
      ...defaultValues,
    },
  });

  const imageUrl = watch('imageUrl');
  const story = watch('story');
  const status = watch('status');
  const widgetLink = watch('jarWidgetUrl')?.trim() ?? '';
  const linked = widgetLink.length > 0;
  const savedLinkShown = !!jar?.jarWidgetUrl && jar.jarWidgetUrl === widgetLink;
  const info = useJarInfo(widgetLink, jar);
  const jarGoal = info.state === 'known' ? info.goal : null;
  const goalLocked = jarGoal !== null || info.state === 'checking';

  useEffect(() => {
    if (jarGoal !== null) {
      setValue('goalAmount', String(Number(jarGoal)), { shouldValidate: true });
    }
  }, [jarGoal, setValue]);

  const { formRef, onInvalid, serverMessages } = useFormErrors(
    error,
    setError,
    Object.keys(schema.shape),
  );

  const submit = handleSubmit(onSubmit, onInvalid);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  const goalLabel = !linked
    ? 'Ціль, ₴'
    : jarGoal !== null
      ? 'Ціль, ₴ · з банки'
      : info.state === 'known'
        ? 'Ціль, ₴ (у банці цілі немає)'
        : 'Ціль, ₴';

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Назва" {...register('name')} error={errors.name?.message} />
      <Select
        label="Статус"
        options={[
          { value: 'ACTIVE', label: 'Активний' },
          { value: 'CLOSED', label: 'Закритий' },
        ]}
        {...register('status')}
        error={errors.status?.message}
      />
      <ImageUpload
        label="Головне фото"
        value={imageUrl}
        onChange={(url) => setValue('imageUrl', url, { shouldDirty: true })}
      />
      <Textarea
        label="Короткий опис (під заголовком)"
        {...register('description')}
        error={errors.description?.message}
      />
      <RichTextArea
        label="Повний опис «Про збір» (необовʼязково)"
        placeholder="Розгорнута історія збору…"
        value={story ?? ''}
        onChange={(v) => setValue('story', v, { shouldDirty: true })}
      />
      <Input
        label="Локація (необовʼязково)"
        placeholder="Напр. Запорізький напрямок"
        {...register('location')}
        error={errors.location?.message}
      />

      <div className="rounded-xl border border-border bg-bg-soft p-3">
        <p className="mb-3 text-xs text-subtle">
          Автооновлення суми. Встав посилання на віджет банки monobank — сайт сам
          підтягуватиме зібрану суму, ціль і посилання на банку кожні ~5 хв.
          Звичайне посилання send.monobank.ua/jar/… тут не підійде: потрібен саме
          віджет (його посилання містить jar=…).
        </p>
        <Input
          label="Посилання на віджет банки (необовʼязково)"
          placeholder="https://send.monobank.ua/widget.html?jar=…"
          {...register('jarWidgetUrl')}
          error={
            errors.jarWidgetUrl?.message ??
            (info.state === 'invalid' ? info.message : undefined)
          }
        />
        {jar && savedLinkShown && (jar.jarSyncedAt || jar.jarSyncError) ? (
          <JarSyncStatus jar={jar} />
        ) : (
          <JarPreviewStatus info={info} closingActive={status === 'ACTIVE'} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <Input
            label={goalLabel}
            type="number"
            min="0"
            readOnly={linked && goalLocked}
            placeholder={info.state === 'checking' ? 'перевіряю банку…' : undefined}
            className={linked && goalLocked ? 'cursor-not-allowed opacity-70' : undefined}
            {...register('goalAmount')}
            error={errors.goalAmount?.message}
          />
        </div>
        <div className="min-w-0">
          {linked ? (
            <Input
              label="Зібрано, ₴ · з банки"
              value={info.state === 'known' ? String(Number(info.current)) : ''}
              placeholder={
                info.state === 'checking' ? 'перевіряю банку…' : 'підтягнеться автоматично'
              }
              readOnly
              className="cursor-not-allowed opacity-70"
            />
          ) : (
            <Input
              label="Зібрано, ₴"
              type="number"
              min="0"
              {...register('currentAmount')}
              error={errors.currentAmount?.message}
            />
          )}
        </div>
      </div>
      {linked && <GoalHint info={info} />}

      <div className="rounded-xl border border-border bg-bg-soft p-3">
        <p className="mb-3 text-xs text-subtle">
          Реквізити для донату. Кнопка «Задонатити» на сайті веде в банку monobank.
        </p>
        <div className="flex flex-col gap-3">
          <Input
            label="Номер картки"
            placeholder="0000 0000 0000 0000"
            {...register('cardNumber')}
            error={errors.cardNumber?.message}
          />
          {linked ? (
            <Input
              label="Посилання на банку monobank · з віджета"
              value={info.state === 'known' ? (info.jarUrl ?? '') : ''}
              placeholder="підставиться автоматично"
              readOnly
              className="cursor-not-allowed opacity-70"
            />
          ) : (
            <Input
              label="Посилання на банку monobank"
              placeholder="https://send.monobank.ua/jar/…"
              {...register('jarUrl')}
              error={errors.jarUrl?.message}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <Input
            label="Початок (необовʼязково)"
            type="date"
            className="w-full min-w-0"
            {...register('startDate')}
            error={errors.startDate?.message}
          />
        </div>
        <div className="min-w-0">
          <Input
            label="Завершення (необовʼязково)"
            type="date"
            className="w-full min-w-0"
            {...register('endDate')}
            error={errors.endDate?.message}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-subtle">
        Без дати завершення збір триває, доки його не закриють вручну або доки не
        закриють банку. Дату завершення можна вказати лише разом із датою початку.
      </p>
      <Input
        label="Посилання на звітність (необовʼязково)"
        placeholder="https://…"
        {...register('detailsLink')}
        error={errors.detailsLink?.message}
      />
      <FormError messages={serverMessages} />
      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}

function GoalHint({ info }: { info: JarInfo }) {
  let text: string | null = null;
  if (info.state === 'known' && info.goal !== null) {
    text =
      'Ціль задана в банці, тому змінити її тут не можна — вона оновлюється автоматично разом із банкою.';
  } else if (info.state === 'known') {
    text =
      'У банці цілі немає — вкажи її тут або залиш порожнім. Якщо власник додасть ціль у банці, вона замінить це значення.';
  } else if (info.state === 'unknown' || info.state === 'invalid') {
    text =
      'Поки банку не перевірено, ціль можна вказати тут. Якщо в банці є своя ціль, після збереження вона замінить це значення.';
  }
  if (!text) return null;
  return <p className="-mt-2 text-xs text-subtle">{text}</p>;
}

function JarPreviewStatus({
  info,
  closingActive,
}: {
  info: JarInfo;
  closingActive: boolean;
}) {
  if (info.state === 'checking') {
    return <p className="mt-2 text-xs text-subtle">Перевіряю банку…</p>;
  }
  if (info.state === 'unknown') {
    return (
      <p className="mt-2 text-xs text-brand-orange">
        Monobank зараз не відповідає ({info.reason}). Посилання збережеться, а суму
        сервер підтягне пізніше.
      </p>
    );
  }
  if (info.state !== 'known') return null;
  return (
    <div className="mt-2 flex flex-col gap-1 text-xs">
      <p className="text-brand-green">
        ✓ Банку знайдено: зібрано {uah(info.current)} ₴
        {info.goal !== null ? ` з ${uah(info.goal)} ₴` : ', цілі в банці немає'}
      </p>
      {info.closed && closingActive && (
        <p className="font-medium text-brand-red">
          Цю банку вже закрито — збір збережеться як завершений.
        </p>
      )}
    </div>
  );
}

function JarSyncStatus({ jar }: { jar: FundraiserJarState }) {
  if (jar.jarSyncError) {
    return (
      <p className="mt-2 rounded-lg bg-brand-red/10 px-3 py-2 text-xs font-medium text-brand-red">
        Автооновлення зупинено: {jar.jarSyncError}. Виправ посилання й збережи —
        сервер перевірить банку ще раз.
      </p>
    );
  }
  if (!jar.jarSyncedAt) {
    return (
      <p className="mt-2 text-xs text-subtle">
        Очікує першої синхронізації — зазвичай до 5 хв.
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-brand-green">
      ✓ Суму оновлено {timeAgo(jar.jarSyncedAt)}
    </p>
  );
}
