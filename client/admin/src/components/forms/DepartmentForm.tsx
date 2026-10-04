'use client';

import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { FormError } from '../ui/FormError';
import { ImageUpload } from '../ImageUpload';
import { useFormErrors } from '@/lib/formErrors';
import { useMainButton } from '@/lib/telegram';
import { api } from '@/lib/api';

export const DEPARTMENT_PAGES = [
  { slug: 'projects', label: 'Проєктний департамент' },
  { slug: 'media', label: 'Департамент медіа' },
  { slug: 'partnerships', label: 'Департамент партнерств' },
  { slug: 'merch', label: 'Департамент мерчу' },
  { slug: 'education', label: 'Департамент якості освіти' },
  { slug: 'applicants', label: 'Департамент по роботі з абітурієнтами' },
];

const schema = z.object({
  name: z.string().min(1, 'Вкажи назву').max(50, 'Максимум 50 символів'),
  shortName: z.string().max(50, 'Максимум 50 символів').optional(),
  slug: z.string().optional(),
  memberCount: z.string().optional(),
  telegramChatId: z
    .string()
    .max(64, 'Максимум 64 символи')
    .refine(
      (v) => {
        const id = v.replace(/\s+/g, '');
        return id === '' || /^-\d+(\/\d+)?$/.test(id);
      },
      {
        message:
          'Вкажи числовий ID групи, напр. -1001234567890, або -1001234567890/12 для однієї гілки',
      },
    )
    .optional(),
  headFirstName: z.string().max(30, 'Максимум 30 символів').optional(),
  headLastName: z.string().max(30, 'Максимум 30 символів').optional(),
  headTelegramTag: z.string().max(50, 'Максимум 50 символів').optional(),
  headPhoto: z.string().nullable().optional(),
});

export type DepartmentFormValues = z.infer<typeof schema>;

export function DepartmentForm({
  departmentId,
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  error,
}: {
  departmentId?: string;
  defaultValues?: Partial<DepartmentFormValues>;
  onSubmit: (values: DepartmentFormValues) => void;
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
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      shortName: '',
      slug: '',
      memberCount: '',
      telegramChatId: '',
      headFirstName: '',
      headLastName: '',
      headTelegramTag: '',
      headPhoto: null,
      ...defaultValues,
    },
  });

  const photo = watch('headPhoto');
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.departments(),
  });
  const pageOptions = [
    { value: '', label: '— не привʼязано —' },
    ...DEPARTMENT_PAGES.map((p) => {
      const owner = departments?.find(
        (d) => d.slug === p.slug && d.id !== departmentId,
      );
      return {
        value: p.slug,
        label: owner ? `${p.label} (зайнято: ${owner.name})` : p.label,
        disabled: !!owner,
      };
    }),
  ];
  const { formRef, onInvalid, serverMessages } = useFormErrors(
    error,
    setError,
    Object.keys(schema.shape),
  );

  const submit = handleSubmit(onSubmit, onInvalid);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Назва" {...register('name')} error={errors.name?.message} />
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          label="Коротка назва"
          placeholder="напр. Мерч"
          {...register('shortName')}
          error={errors.shortName?.message}
        />
        <p className="break-words text-xs text-subtle">
          Показується там, де перед назвою вже стоїть слово «департамент», напр.
          «Голова департаменту «Мерч»». Якщо порожньо — повна назва.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Select
          label="Сторінка на сайті"
          options={pageOptions}
          {...register('slug')}
          error={errors.slug?.message}
        />
        <p className="break-words text-xs text-subtle">
          Сторінка департаменту бере звідси керівника, кількість учасників і
          «сердечко». Привʼязка не зникає, якщо перейменувати департамент.
        </p>
      </div>
      <Input
        label="Кількість учасників"
        type="number"
        min="0"
        placeholder="напр. 45"
        {...register('memberCount')}
        error={errors.memberCount?.message}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          label="Telegram chat ID (для «сердечка»)"
          placeholder="-1001234567890 або -1001234567890/12"
          {...register('telegramChatId')}
          error={errors.telegramChatId?.message}
        />
        <p className="break-words text-xs text-subtle">
          Чат, звідки бот збирає людей департаменту. Лише ID групи — люди з усіх
          гілок; ID/номер гілки — лише з однієї гілки. Бот має бути адміном чату.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-bg-soft p-4">
        <p className="mb-3 text-sm font-semibold text-muted">Керівник</p>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Імʼя"
              {...register('headFirstName')}
              error={errors.headFirstName?.message}
            />
            <Input
              label="Прізвище"
              {...register('headLastName')}
              error={errors.headLastName?.message}
            />
          </div>
          <Input
            label="Telegram (необовʼязково)"
            placeholder="@username"
            {...register('headTelegramTag')}
            error={errors.headTelegramTag?.message}
          />
          <ImageUpload
            label="Фото"
            value={photo}
            onChange={(url) => setValue('headPhoto', url, { shouldDirty: true })}
          />
        </div>
      </div>

      <FormError messages={serverMessages} />

      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
