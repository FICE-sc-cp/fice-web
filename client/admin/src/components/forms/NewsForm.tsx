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
  title: z.string().min(1, 'Вкажи заголовок').max(50, 'Максимум 50 символів'),
  details: z.string().optional(),
  image: z.string().nullable().optional(),
});

export type NewsFormValues = z.infer<typeof schema>;

export function NewsForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
}: {
  defaultValues?: Partial<NewsFormValues>;
  onSubmit: (values: NewsFormValues) => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NewsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', details: '', image: null, ...defaultValues },
  });

  const image = watch('image');
  const submit = handleSubmit(onSubmit);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Заголовок"
        placeholder="Назва новини"
        {...register('title')}
        error={errors.title?.message}
      />
      <Textarea label="Текст" placeholder="Деталі новини…" {...register('details')} />
      <ImageUpload
        label="Обкладинка"
        value={image}
        onChange={(url) => setValue('image', url, { shouldDirty: true })}
      />
      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
