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
import { dateInputToIso, todayInputValue } from '@/lib/utils';

export default function NewFundraiserPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (v: FundraiserFormValues) => {
      const jarWidgetUrl = v.jarWidgetUrl?.trim() || undefined;
      return api.createFundraiser({
        name: v.name,
        status: v.status,
        description: v.description,
        story: v.story || undefined,
        imageUrl: v.imageUrl || undefined,
        location: v.location || undefined,
        jarWidgetUrl,
        goalAmount: v.goalAmount ? Number(v.goalAmount) : undefined,
        currentAmount:
          !jarWidgetUrl && v.currentAmount ? Number(v.currentAmount) : undefined,
        cardNumber: v.cardNumber || undefined,
        jarUrl: jarWidgetUrl ? undefined : v.jarUrl || undefined,
        startDate: dateInputToIso(v.startDate),
        endDate: dateInputToIso(v.endDate),
        detailsLink: v.detailsLink || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fundraisers'] });
      hapticNotify('success');
      router.push('/fundraisers');
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Новий збір" />
      <FundraiserForm
        submitLabel="Створити"
        submitting={mutation.isPending}
        onSubmit={(v) => mutation.mutate(v)}
        error={mutation.error}
        defaultValues={{ startDate: todayInputValue() }}
      />
    </main>
  );
}
