'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type PartnerInput } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { PartnerForm, type PartnerFormValues } from '@/components/forms/PartnerForm';
import { hapticNotify } from '@/lib/telegram';

export default function NewPartnerPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: PartnerInput) => api.createPartner(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] });
      hapticNotify('success');
      router.push('/partners');
    },
  });

  function handleSubmit(v: PartnerFormValues) {
    mutation.mutate({
      name: v.name,
      websiteLink: v.websiteLink || undefined,
      logoImage: v.logoImage ?? undefined,
    });
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Новий партнер" />
      <PartnerForm
        submitLabel="Створити"
        submitting={mutation.isPending}
        onSubmit={handleSubmit}
        error={mutation.error}
      />
    </main>
  );
}
