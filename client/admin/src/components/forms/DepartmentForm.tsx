'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { FormError } from '../ui/FormError';
import { ImageUpload } from '../ImageUpload';
import { useMainButton } from '@/lib/telegram';

const schema = z.object({
  name: z.string().min(1, 'Вкажи назву').max(50, 'Максимум 50 символів'),
  memberCount: z.string().optional(),
  telegramChatId: z.string().max(64, 'Максимум 64 символи').optional(),
  headFirstName: z.string().max(30, 'Максимум 30 символів').optional(),
  headLastName: z.string().max(30, 'Максимум 30 символів').optional(),
  headTelegramTag: z.string().max(50, 'Максимум 50 символів').optional(),
  headPhoto: z.string().nullable().optional(),
});

export type DepartmentFormValues = z.infer<typeof schema>;

export function DepartmentForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  error,
}: {
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
    formState: { errors },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
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
  const submit = handleSubmit(onSubmit);
  useMainButton({ text: submitLabel, onClick: () => void submit(), loading: submitting });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Назва" {...register('name')} error={errors.name?.message} />
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
          Чат, звідки бот збирає людей департаменту. Для гілки додай /threadId.
          Бот має бути адміном чату.
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

      <FormError error={error} />

      <Button type="submit" disabled={submitting} className="mt-1">
        {submitting ? 'Збереження…' : submitLabel}
      </Button>
    </form>
  );
}
