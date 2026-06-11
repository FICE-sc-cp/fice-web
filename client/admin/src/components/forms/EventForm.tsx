'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ImageUpload } from '../ImageUpload';
import { useMainButton } from '@/lib/telegram';

const schema = z.object({
  name: z.string().min(1, 'Вкажи назву').max(50),
  date: z.string().min(1, 'Вкажи дату'),
  photoUrl: z.string().nullable().optional(),
  description: z.string().max(255).optional(),
  moneyCollected: z.string().optional(),
  charityAmount: z.string().optional(),
  visitorsAmount: z.string().optional(),
  departmentId: z.string().optional(),
});

export type EventFormValues = z.infer<typeof schema>;

export function EventForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
}: {
  defaultValues?: Partial<EventFormValues>;
  onSubmit: (values: EventFormValues) => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.departments(),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      date: '',
      photoUrl: null,
      description: '',
      moneyCollected: '',
      charityAmount: '',
      visitorsAmount: '',
      departmentId: '',
      ...defaultValues,
    },
  });

  const photo = watch('photoUrl');
  const submit = handleSubmit(onSubmit);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  const deptOptions = [
    { value: '', label: '— Без відділу —' },
    ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
  ];

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
        label="Фото"
        value={photo}
        onChange={(url) => setValue('photoUrl', url, { shouldDirty: true })}
      />

      <div className="rounded-2xl border border-border bg-bg-soft p-4">
        <p className="mb-3 text-sm font-semibold text-muted">
          Деталі та результати (необовʼязково)
        </p>
        <div className="flex flex-col gap-4">
          <Textarea
            label="Опис"
            {...register('description')}
            error={errors.description?.message}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Зібрано, ₴"
              type="number"
              min="0"
              inputMode="numeric"
              {...register('moneyCollected')}
            />
            <Input
              label="На благодійність, ₴"
              type="number"
              min="0"
              inputMode="numeric"
              {...register('charityAmount')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Відвідувачів"
              type="number"
              min="0"
              inputMode="numeric"
              {...register('visitorsAmount')}
            />
            <Select label="Відділ" options={deptOptions} {...register('departmentId')} />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
