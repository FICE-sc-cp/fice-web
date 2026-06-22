'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  FundraiserForm,
  type FundraiserFormValues,
} from '@/components/forms/FundraiserForm';
import { FundraiserDonations } from '@/components/FundraiserDonations';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

export default function EditFundraiserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['fundraiser', id],
    queryFn: () => api.fundraiser(id),
  });

  const mutation = useMutation({
    mutationFn: (v: FundraiserFormValues) =>
      api.updateFundraiser(id, {
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
        <>
          {mutation.error && (
            <p className="mb-4 rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
              {mutation.error instanceof Error ? mutation.error.message : 'Помилка'}
            </p>
          )}
          <FundraiserForm
            key={`${data.currentAmount}-${data.donationsCount}`}
            submitLabel="Зберегти"
            submitting={mutation.isPending}
            onSubmit={(v) => mutation.mutate(v)}
            defaultValues={{
              name: data.name,
              status: data.status,
              imageUrl: data.imageUrl,
              description: data.description,
              story: data.story ?? '',
              location: data.location ?? '',
              goalAmount: String(data.goalAmount),
              currentAmount: String(data.currentAmount),
              donationsCount: String(data.donationsCount),
              cardNumber: data.cardNumber ?? '',
              jarUrl: data.jarUrl ?? '',
              monoJarId: data.monoJarId ?? '',
              startDate: data.startDate.slice(0, 10),
              endDate: data.endDate.slice(0, 10),
              detailsLink: data.detailsLink ?? '',
            }}
          />
          <FundraiserDonations
            fundraiserId={id}
            donations={data.donations ?? []}
          />
        </>
      )}
    </main>
  );
}
