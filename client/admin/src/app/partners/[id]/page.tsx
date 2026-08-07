'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PartnerInput } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { PartnerForm, type PartnerFormValues } from '@/components/forms/PartnerForm';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

export default function EditPartnerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: () => api.partners(),
    select: (res) => res.items.find((p) => p.id === id) ?? null,
  });

  const mutation = useMutation({
    mutationFn: (input: Partial<PartnerInput>) => api.updatePartner(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] });
      hapticNotify('success');
      router.push('/partners');
    },
  });

  function handleSubmit(v: PartnerFormValues) {
    mutation.mutate({
      name: v.name,
      websiteLink: v.websiteLink || null,
      logoImage: v.logoImage ?? null,
    });
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Редагувати партнера" />
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <PartnerForm
          submitLabel="Зберегти"
          submitting={mutation.isPending}
          onSubmit={handleSubmit}
          error={mutation.error}
          defaultValues={
            data
              ? {
                  name: data.name,
                  websiteLink: data.websiteLink ?? '',
                  logoImage: data.logoImage,
                }
              : undefined
          }
        />
      )}
    </main>
  );
}
