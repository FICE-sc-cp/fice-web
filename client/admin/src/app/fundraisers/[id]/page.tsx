'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  FundraiserForm,
  type FundraiserFormValues,
} from '@/components/forms/FundraiserForm';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';
import { dateInputToIso, isoToDateInput } from '@/lib/utils';

export default function EditFundraiserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['fundraiser', id],
    queryFn: () => api.fundraiser(id),
  });

  const mutation = useMutation({
    mutationFn: (v: FundraiserFormValues) => {
      const jarWidgetUrl = v.jarWidgetUrl?.trim() || null;
      return api.updateFundraiser(id, {
        name: v.name,
        status: v.status,
        description: v.description,
        story: v.story || null,
        imageUrl: v.imageUrl || null,
        location: v.location || null,
        jarWidgetUrl,
        goalAmount: Number(v.goalAmount) || 0,
        currentAmount:
          !jarWidgetUrl && v.currentAmount ? Number(v.currentAmount) : undefined,
        cardNumber: v.cardNumber || null,
        jarUrl: jarWidgetUrl ? undefined : v.jarUrl || null,
        startDate: dateInputToIso(v.startDate),
        endDate: dateInputToIso(v.endDate),
        detailsLink: v.detailsLink || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fundraisers'] });
      qc.invalidateQueries({ queryKey: ['fundraiser', id] });
      hapticNotify('success');
      router.push('/fundraisers');
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Редагувати збір" />
      {isLoading || !data ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <FundraiserForm
          key={data.id}
          submitLabel="Зберегти"
          submitting={mutation.isPending}
          onSubmit={(v) => mutation.mutate(v)}
          error={mutation.error}
          jar={{
            jarWidgetUrl: data.jarWidgetUrl,
            jarHasGoal: data.jarHasGoal,
            jarSyncedAt: data.jarSyncedAt,
            jarSyncError: data.jarSyncError,
            currentAmount: data.currentAmount,
            goalAmount: data.goalAmount,
            jarUrl: data.jarUrl,
          }}
          defaultValues={{
            name: data.name,
            status: data.status,
            imageUrl: data.imageUrl,
            description: data.description,
            story: data.story ?? '',
            location: data.location ?? '',
            jarWidgetUrl: data.jarWidgetUrl ?? '',
            goalAmount: String(data.goalAmount),
            currentAmount: String(data.currentAmount),
            cardNumber: data.cardNumber ?? '',
            jarUrl: data.jarUrl ?? '',
            startDate: isoToDateInput(data.startDate),
            endDate: isoToDateInput(data.endDate),
            detailsLink: data.detailsLink ?? '',
          }}
        />
      )}
    </main>
  );
}
