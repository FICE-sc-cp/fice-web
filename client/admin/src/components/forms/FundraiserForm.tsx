'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useMainButton } from '@/lib/telegram';

const schema = z.object({
  name: z.string().min(1, 'Вкажи назву').max(30),
  status: z.enum(['ACTIVE', 'CLOSED']),
  description: z.string().min(1, 'Вкажи опис').max(255),
  goalAmount: z.string().min(1, 'Вкажи ціль'),
  currentAmount: z.string().optional(),
  startDate: z.string().min(1, 'Вкажи дату початку'),
  endDate: z.string().min(1, 'Вкажи дату завершення'),
  detailsLink: z.union([z.string().url('Невалідний URL'), z.literal('')]).optional(),
});

export type FundraiserFormValues = z.infer<typeof schema>;

export function FundraiserForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
}: {
  defaultValues?: Partial<FundraiserFormValues>;
  onSubmit: (values: FundraiserFormValues) => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FundraiserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      status: 'ACTIVE',
      description: '',
      goalAmount: '',
      currentAmount: '',
      startDate: '',
      endDate: '',
      detailsLink: '',
      ...defaultValues,
    },
  });

  const submit = handleSubmit(onSubmit);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Назва" {...register('name')} error={errors.name?.message} />
      <Select
        label="Статус"
        options={[
          { value: 'ACTIVE', label: 'Активний' },
          { value: 'CLOSED', label: 'Закритий' },
        ]}
        {...register('status')}
      />
      <Textarea
        label="Опис"
        {...register('description')}
        error={errors.description?.message}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Ціль, ₴"
          type="number"
          min="0"
          {...register('goalAmount')}
          error={errors.goalAmount?.message}
        />
        <Input label="Зібрано, ₴" type="number" min="0" {...register('currentAmount')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Початок"
          type="date"
          {...register('startDate')}
          error={errors.startDate?.message}
        />
        <Input
          label="Завершення"
          type="date"
          {...register('endDate')}
          error={errors.endDate?.message}
        />
      </div>
      <Input
        label="Посилання (необовʼязково)"
        placeholder="https://…"
        {...register('detailsLink')}
        error={errors.detailsLink?.message}
      />
      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
