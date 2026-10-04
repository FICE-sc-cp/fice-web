'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { FormError } from '@/components/ui/FormError';
import { useFormErrors } from '@/lib/formErrors';
import { ImageUpload } from '../ImageUpload';
import { useMainButton } from '@/lib/telegram';

const schema = z.object({
  role: z.enum(['HEAD', 'FIRST_DEPUTY', 'SECRETARY', 'DEPUTY', 'HR'], {
    error: 'Обери роль зі списку',
  }),
  firstName: z.string().min(1, 'Вкажи імʼя').max(30, 'Максимум 30 символів'),
  lastName: z.string().min(1, 'Вкажи прізвище').max(30, 'Максимум 30 символів'),
  specialization: z.string().max(100, 'Максимум 100 символів').optional(),
  title: z.string().max(100, 'Максимум 100 символів').optional(),
  description: z.string().max(1000, 'Максимум 1000 символів').optional(),
  order: z
    .string()
    .refine((v) => v.trim() === '' || /^\d{1,4}$/.test(v.trim()), {
      message: 'Вкажи ціле число від 0',
    })
    .optional(),
  photo: z.string().nullable().optional(),
  telegramTag: z.string().max(50, 'Максимум 50 символів').optional(),
});

export type MemberFormValues = z.infer<typeof schema>;

export const ROLE_OPTIONS = [
  { value: 'HEAD', label: 'Голова студради' },
  { value: 'FIRST_DEPUTY', label: 'Перший заступник' },
  { value: 'SECRETARY', label: 'Секретар' },
  { value: 'DEPUTY', label: 'Заступник' },
  { value: 'HR', label: 'HR' },
];

export function MemberForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  error,
}: {
  defaultValues?: Partial<MemberFormValues>;
  onSubmit: (values: MemberFormValues) => void;
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
  } = useForm<MemberFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'DEPUTY',
      firstName: '',
      lastName: '',
      specialization: '',
      title: '',
      description: '',
      order: '',
      photo: null,
      telegramTag: '',
      ...defaultValues,
    },
  });

  const photo = watch('photo');
  const { formRef, onInvalid, serverMessages } = useFormErrors(
    error,
    setError,
    Object.keys(schema.shape),
  );

  const submit = handleSubmit(onSubmit, onInvalid);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
      <Select
        label="Роль"
        options={ROLE_OPTIONS}
        {...register('role')}
        error={errors.role?.message}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <Input label="Імʼя" {...register('firstName')} error={errors.firstName?.message} />
        </div>
        <div className="min-w-0">
          <Input
            label="Прізвище"
            {...register('lastName')}
            error={errors.lastName?.message}
          />
        </div>
      </div>
      <ImageUpload
        label="Фото"
        value={photo}
        onChange={(url) => setValue('photo', url, { shouldDirty: true })}
      />
      <Input
        label="Telegram-тег"
        placeholder="@username"
        {...register('telegramTag')}
        error={errors.telegramTag?.message}
      />
      <Input
        label="Напрям / спеціалізація"
        placeholder="напр. технічний напрям (для заступників)"
        {...register('specialization')}
        error={errors.specialization?.message}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          label="Посада на сайті"
          placeholder="напр. Заступниця голови з внутрішньої роботи"
          {...register('title')}
          error={errors.title?.message}
        />
        <p className="break-words text-xs text-subtle">
          Якщо порожньо, на сайті буде назва ролі й напрям.
        </p>
      </div>
      <Textarea
        label="Опис (для сторінки президії)"
        placeholder="Чим займається ця людина"
        rows={4}
        {...register('description')}
        error={errors.description?.message}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          label="Порядок"
          type="number"
          min="0"
          placeholder="0"
          {...register('order')}
          error={errors.order?.message}
        />
        <p className="break-words text-xs text-subtle">
          Картки йдуть за роллю (голова, перший заступник, секретар, заступники),
          а в межах ролі — за цим числом, від меншого.
        </p>
      </div>
      <FormError messages={serverMessages} />
      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
