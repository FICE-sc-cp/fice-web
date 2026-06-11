'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type NewsInput } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { NewsForm, type NewsFormValues } from '@/components/forms/NewsForm';
import { hapticNotify } from '@/lib/telegram';

export default function NewNewsPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: NewsInput) => api.createNews(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news'] });
      hapticNotify('success');
      router.push('/news');
    },
  });

  function handleSubmit(v: NewsFormValues) {
    mutation.mutate({
      title: v.title,
      details: v.details?.trim() ? v.details : undefined,
      image: v.image ?? undefined,
    });
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Нова новина" />
      {mutation.error && (
        <p className="mb-4 rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          {mutation.error instanceof Error ? mutation.error.message : 'Помилка'}
        </p>
      )}
      <NewsForm
        submitLabel="Створити"
        submitting={mutation.isPending}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
