'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ImageUpload } from '../ImageUpload';
import { useMainButton } from '@/lib/telegram';

const schema = z.object({
  role: z.enum(['HEAD', 'FIRST_DEPUTY', 'SECRETARY', 'DEPUTY', 'HR']),
  firstName: z.string().min(1, 'Вкажи імʼя').max(30),
  lastName: z.string().min(1, 'Вкажи прізвище').max(30),
  specialization: z.string().max(100).optional(),
  photo: z.string().nullable().optional(),
  telegramTag: z.string().max(50).optional(),
  quote: z.string().max(160).optional(),
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
}: {
  defaultValues?: Partial<MemberFormValues>;
  onSubmit: (values: MemberFormValues) => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'DEPUTY',
      firstName: '',
      lastName: '',
      specialization: '',
      photo: null,
      telegramTag: '',
      quote: '',
      ...defaultValues,
    },
  });

  const photo = watch('photo');
  const submit = handleSubmit(onSubmit);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Select label="Роль" options={ROLE_OPTIONS} {...register('role')} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Імʼя" {...register('firstName')} error={errors.firstName?.message} />
        <Input
          label="Прізвище"
          {...register('lastName')}
          error={errors.lastName?.message}
        />
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
      />
      <Input
        label="Цитата / девіз (необовʼязково)"
        placeholder="Один короткий рядок про себе"
        {...register('quote')}
        error={errors.quote?.message}
      />
      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
