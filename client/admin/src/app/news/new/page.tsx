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
      category: v.category ? v.category : null,
      eventDate: v.isEvent && v.eventDate ? new Date(v.eventDate).toISOString() : null,
      eventLocation:
        v.isEvent && v.eventLocation?.trim() ? v.eventLocation.trim() : null,
      registrationLink:
        v.isEvent && v.registrationLink?.trim() ? v.registrationLink.trim() : null,
    });
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Нова новина" />
      <NewsForm
        submitLabel="Створити"
        submitting={mutation.isPending}
        onSubmit={handleSubmit}
        error={mutation.error}
      />
    </main>
  );
}
