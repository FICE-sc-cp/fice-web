'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { EventForm, type EventFormValues } from '@/components/forms/EventForm';
import { EventPartners } from '@/components/EventPartners';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.event(id),
  });

  const mutation = useMutation({
    mutationFn: async (v: EventFormValues) => {
      let detailsId = event?.detailsId ?? undefined;
      if (v.description?.trim()) {
        const body = {
          description: v.description,
          moneyCollected: Number(v.moneyCollected) || 0,
          charityAmount: Number(v.charityAmount) || 0,
          visitorsAmount: v.visitorsAmount ? Number(v.visitorsAmount) : undefined,
          departmentId: v.departmentId || undefined,
        };
        if (event?.detailsId) {
          await api.updateEventDetails(event.detailsId, body);
        } else {
          const d = await api.createEventDetails(body);
          detailsId = d.id;
        }
      }
      return api.updateEvent(id, {
        name: v.name,
        date: new Date(v.date).toISOString(),
        photoUrl: v.photoUrl ?? undefined,
        detailsId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', id] });
      hapticNotify('success');
      router.push('/events');
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Редагувати захід" />
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
          <EventForm
            submitLabel="Зберегти"
            submitting={mutation.isPending}
            onSubmit={(v) => mutation.mutate(v)}
            defaultValues={
              event
                ? {
                    name: event.name,
                    date: toLocalInput(event.date),
                    photoUrl: event.photoUrl,
                    description: event.details?.description ?? '',
                    moneyCollected: event.details
                      ? String(event.details.moneyCollected)
                      : '',
                    charityAmount: event.details
                      ? String(event.details.charityAmount)
                      : '',
                    visitorsAmount:
                      event.details?.visitorsAmount != null
                        ? String(event.details.visitorsAmount)
                        : '',
                    departmentId: event.details?.departmentId ?? '',
                  }
                : undefined
            }
          />
          {event && (
            <EventPartners eventId={event.id} attached={event.eventPartners ?? []} />
          )}
        </>
      )}
    </main>
  );
}
