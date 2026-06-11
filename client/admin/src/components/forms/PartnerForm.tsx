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
  name: z.string().min(1, 'Вкажи назву').max(30, 'Максимум 30 символів'),
  websiteLink: z.union([z.string().url('Невалідний URL'), z.literal('')]).optional(),
  shortDescription: z.string().max(150, 'Максимум 150 символів').optional(),
  logoImage: z.string().nullable().optional(),
});

export type PartnerFormValues = z.infer<typeof schema>;

export function PartnerForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
}: {
  defaultValues?: Partial<PartnerFormValues>;
  onSubmit: (values: PartnerFormValues) => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PartnerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      websiteLink: '',
      shortDescription: '',
      logoImage: null,
      ...defaultValues,
    },
  });

  const logo = watch('logoImage');
  const submit = handleSubmit(onSubmit);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Назва" {...register('name')} error={errors.name?.message} />
      <Input
        label="Сайт"
        placeholder="https://…"
        {...register('websiteLink')}
        error={errors.websiteLink?.message}
      />
      <Textarea
        label="Короткий опис"
        {...register('shortDescription')}
        error={errors.shortDescription?.message}
      />
      <ImageUpload
        label="Логотип"
        value={logo}
        onChange={(url) => setValue('logoImage', url, { shouldDirty: true })}
      />
      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
