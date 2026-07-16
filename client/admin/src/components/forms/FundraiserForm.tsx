'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { RichTextArea } from '../RichTextArea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ImageUpload } from '../ImageUpload';
import { useMainButton } from '@/lib/telegram';

const urlField = z
  .union([z.string().url('Невалідний URL'), z.literal('')])
  .optional();

const schema = z.object({
  name: z.string().min(1, 'Вкажи назву').max(120),
  status: z.enum(['ACTIVE', 'CLOSED']),
  imageUrl: z.string().nullable().optional(),
  description: z.string().min(1, 'Вкажи короткий опис').max(255),
  story: z.string().optional(),
  location: z.string().max(100).optional(),
  goalAmount: z.string().min(1, 'Вкажи ціль'),
  currentAmount: z.string().optional(),
  donationsCount: z.string().optional(),
  cardNumber: z.string().max(25).optional(),
  jarUrl: urlField,
  monoJarId: z.string().max(40).optional(),
  startDate: z.string().min(1, 'Вкажи дату початку'),
  endDate: z.string().min(1, 'Вкажи дату завершення'),
  detailsLink: urlField,
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
    watch,
    setValue,
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
      goalAmount: '',
      currentAmount: '',
      donationsCount: '',
      cardNumber: '',
      jarUrl: '',
      monoJarId: '',
      startDate: '',
      endDate: '',
      detailsLink: '',
      ...defaultValues,
    },
  });

  const imageUrl = watch('imageUrl');
  const story = watch('story');
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
      <Input
        label="Кількість донатів"
        type="number"
        min="0"
        placeholder="0"
        {...register('donationsCount')}
      />

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
          <Input
            label="Посилання на банку monobank"
            placeholder="https://send.monobank.ua/jar/…"
            {...register('jarUrl')}
            error={errors.jarUrl?.message}
          />
          <Input
            label="ID банки monobank (для авто-синку, необовʼязково)"
            placeholder="напр. abcDEF123…"
            {...register('monoJarId')}
            error={errors.monoJarId?.message}
          />
        </div>
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
        label="Посилання на звітність (необовʼязково)"
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
