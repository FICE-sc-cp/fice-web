'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { ImageUpload } from '../ImageUpload';
import { useMainButton } from '@/lib/telegram';

const schema = z.object({
  name: z.string().min(1, 'Вкажи назву').max(50),
  shortDescription: z.string().min(1, 'Вкажи короткий опис').max(100),
  headFirstName: z.string().max(30).optional(),
  headLastName: z.string().max(30).optional(),
  headTelegramTag: z.string().max(50).optional(),
  headJob: z.string().max(100).optional(),
  headPhoto: z.string().nullable().optional(),
  about: z.string().optional(),
  detailedDescription: z.string().optional(),
  exampleOfWork: z.string().optional(),
});

export type DepartmentFormValues = z.infer<typeof schema>;

export function DepartmentForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
}: {
  defaultValues?: Partial<DepartmentFormValues>;
  onSubmit: (values: DepartmentFormValues) => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      shortDescription: '',
      headFirstName: '',
      headLastName: '',
      headTelegramTag: '',
      headJob: '',
      headPhoto: null,
      about: '',
      detailedDescription: '',
      exampleOfWork: '',
      ...defaultValues,
    },
  });

  const photo = watch('headPhoto');
  const submit = handleSubmit(onSubmit);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Назва" {...register('name')} error={errors.name?.message} />
      <Textarea
        label="Короткий опис"
        {...register('shortDescription')}
        error={errors.shortDescription?.message}
      />

      <div className="rounded-2xl border border-border bg-bg-soft p-4">
        <p className="mb-3 text-sm font-semibold text-muted">Керівник</p>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Імʼя" {...register('headFirstName')} />
            <Input label="Прізвище" {...register('headLastName')} />
          </div>
          <Input
            label="Telegram"
            placeholder="@username"
            {...register('headTelegramTag')}
          />
          <Input label="Посада" {...register('headJob')} />
          <ImageUpload
            label="Фото"
            value={photo}
            onChange={(url) => setValue('headPhoto', url, { shouldDirty: true })}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-soft p-4">
        <p className="mb-3 text-sm font-semibold text-muted">Деталі</p>
        <div className="flex flex-col gap-4">
          <Textarea label="Про відділ" {...register('about')} />
          <Textarea label="Детальний опис" {...register('detailedDescription')} />
          <Textarea label="Приклад роботи" {...register('exampleOfWork')} />
        </div>
      </div>

      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
