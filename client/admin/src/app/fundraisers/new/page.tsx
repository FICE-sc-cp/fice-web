'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  FundraiserForm,
  type FundraiserFormValues,
} from '@/components/forms/FundraiserForm';
import { hapticNotify } from '@/lib/telegram';

export default function NewFundraiserPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (v: FundraiserFormValues) =>
      api.createFundraiser({
        name: v.name,
        status: v.status,
        description: v.description,
        story: v.story || undefined,
        imageUrl: v.imageUrl || undefined,
        location: v.location || undefined,
        goalAmount: Number(v.goalAmount) || 0,
        currentAmount: v.currentAmount ? Number(v.currentAmount) : undefined,
        donationsCount: v.donationsCount ? Number(v.donationsCount) : undefined,
        cardNumber: v.cardNumber || undefined,
        jarUrl: v.jarUrl || undefined,
        monoJarId: v.monoJarId || undefined,
        startDate: new Date(v.startDate).toISOString(),
        endDate: new Date(v.endDate).toISOString(),
        detailsLink: v.detailsLink || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fundraisers'] });
      hapticNotify('success');
      router.push('/fundraisers');
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Новий збір" />
      {mutation.error && (
        <p className="mb-4 rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          {mutation.error instanceof Error ? mutation.error.message : 'Помилка'}
        </p>
      )}
      <FundraiserForm
        submitLabel="Створити"
        submitting={mutation.isPending}
        onSubmit={(v) => mutation.mutate(v)}
      />
    </main>
  );
}
