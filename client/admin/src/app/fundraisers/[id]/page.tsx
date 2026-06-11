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

export default function EditFundraiserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['fundraisers'],
    queryFn: () => api.fundraisers(),
    select: (res) => res.items.find((f) => f.id === id) ?? null,
  });

  const mutation = useMutation({
    mutationFn: (v: FundraiserFormValues) =>
      api.updateFundraiser(id, {
        name: v.name,
        status: v.status,
        description: v.description,
        goalAmount: Number(v.goalAmount) || 0,
        currentAmount: v.currentAmount ? Number(v.currentAmount) : undefined,
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
      <PageHeader title="Редагувати збір" />
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
          <FundraiserForm
            submitLabel="Зберегти"
            submitting={mutation.isPending}
            onSubmit={(v) => mutation.mutate(v)}
            defaultValues={
              data
                ? {
                    name: data.name,
                    status: data.status,
                    description: data.description,
                    goalAmount: String(data.goalAmount),
                    currentAmount: String(data.currentAmount),
                    startDate: data.startDate.slice(0, 10),
                    endDate: data.endDate.slice(0, 10),
                    detailsLink: data.detailsLink ?? '',
                  }
                : undefined
            }
          />
        </>
      )}
    </main>
  );
}
