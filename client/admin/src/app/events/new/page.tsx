'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { EventForm, type EventFormValues } from '@/components/forms/EventForm';
import { hapticNotify } from '@/lib/telegram';

export default function NewEventPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (v: EventFormValues) => {
      let detailsId: string | undefined;
      if (v.description?.trim()) {
        const details = await api.createEventDetails({
          description: v.description,
          moneyCollected: Number(v.moneyCollected) || 0,
          charityAmount: Number(v.charityAmount) || 0,
          visitorsAmount: v.visitorsAmount ? Number(v.visitorsAmount) : undefined,
          departmentId: v.departmentId || undefined,
        });
        detailsId = details.id;
      }
      return api.createEvent({
        name: v.name,
        date: new Date(v.date).toISOString(),
        photoUrl: v.photoUrl ?? undefined,
        detailsId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      hapticNotify('success');
      router.push('/events');
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Новий захід" />
      {mutation.error && (
        <p className="mb-4 rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
          {mutation.error instanceof Error ? mutation.error.message : 'Помилка'}
        </p>
      )}
      <EventForm
        submitLabel="Створити"
        submitting={mutation.isPending}
        onSubmit={(v) => mutation.mutate(v)}
      />
    </main>
  );
}
