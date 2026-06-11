'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type NewsInput } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { NewsForm, type NewsFormValues } from '@/components/forms/NewsForm';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

export default function EditNewsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['news', id],
    queryFn: () => api.newsById(id),
  });

  const mutation = useMutation({
    mutationFn: (input: Partial<NewsInput>) => api.updateNews(id, input),
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
      <PageHeader title="Редагувати новину" />
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          {mutation.error && (
            <p className="mb-4 rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
              {mutation.error instanceof Error ? mutation.error.message : 'Помилка'}
            </p>
          )}
          <NewsForm
            submitLabel="Зберегти"
            submitting={mutation.isPending}
            onSubmit={handleSubmit}
            defaultValues={
              data
                ? { title: data.title, details: data.details ?? '', image: data.image }
                : undefined
            }
          />
        </>
      )}
    </main>
  );
}
