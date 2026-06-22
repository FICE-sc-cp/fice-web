'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  EventForm,
  eventValuesToInput,
  type EventFormValues,
} from '@/components/forms/EventForm';
import { hapticNotify } from '@/lib/telegram';

export default function NewEventPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (v: EventFormValues) => {
      const hasStats = !!(v.moneyCollected || v.charityAmount || v.visitorsAmount);
      let detailsId: string | undefined;
      if (hasStats) {
        const details = await api.createEventDetails({
          description: (v.description?.trim() || v.name).slice(0, 255),
          moneyCollected: Number(v.moneyCollected) || 0,
          charityAmount: Number(v.charityAmount) || 0,
          visitorsAmount: v.visitorsAmount ? Number(v.visitorsAmount) : undefined,
        });
        detailsId = details.id;
      }
      return api.createEvent({ ...eventValuesToInput(v), detailsId });
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
