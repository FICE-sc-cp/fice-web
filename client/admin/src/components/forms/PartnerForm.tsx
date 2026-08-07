'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ImageUpload } from '../ImageUpload';
import { FormError } from '@/components/ui/FormError';
import { useFormErrors } from '@/lib/formErrors';
import { useMainButton } from '@/lib/telegram';

const schema = z.object({
  name: z.string().min(1, 'Вкажи назву').max(100, 'Максимум 100 символів'),
  websiteLink: z
    .union([z.string().url('Невалідне посилання, приклад: https://example.com'), z.literal('')])
    .optional(),
  logoImage: z.string().nullable().optional(),
});

export type PartnerFormValues = z.infer<typeof schema>;

export function PartnerForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  error,
}: {
  defaultValues?: Partial<PartnerFormValues>;
  onSubmit: (values: PartnerFormValues) => void;
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
  } = useForm<PartnerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      websiteLink: '',
      logoImage: null,
      ...defaultValues,
    },
  });

  const logo = watch('logoImage');
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
      <Input
        label="Сайт"
        placeholder="https://…"
        {...register('websiteLink')}
        error={errors.websiteLink?.message}
      />
      <ImageUpload
        label="Логотип"
        value={logo}
        onChange={(url) => setValue('logoImage', url, { shouldDirty: true })}
      />
      <FormError messages={serverMessages} />
      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
