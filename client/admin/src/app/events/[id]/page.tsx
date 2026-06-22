'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  EventForm,
  eventValuesToInput,
  type EventFormValues,
} from '@/components/forms/EventForm';
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
      const hasStats = !!(v.moneyCollected || v.charityAmount || v.visitorsAmount);
      let detailsId = event?.detailsId ?? undefined;
      const body = {
        description: (v.description?.trim() || v.name).slice(0, 255),
        moneyCollected: Number(v.moneyCollected) || 0,
        charityAmount: Number(v.charityAmount) || 0,
        visitorsAmount: v.visitorsAmount ? Number(v.visitorsAmount) : undefined,
      };
      if (event?.detailsId) {
        await api.updateEventDetails(event.detailsId, body);
      } else if (hasStats) {
        const d = await api.createEventDetails(body);
        detailsId = d.id;
      }
      return api.updateEvent(id, { ...eventValuesToInput(v), detailsId });
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
      <Link
        href={`/events/${id}/registrations`}
        className="mb-4 inline-flex rounded-xl border border-border px-4 py-2 text-sm font-semibold text-brand-cyan transition-colors hover:border-brand-cyan"
      >
        Список зареєстрованих →
      </Link>
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
                    description: event.description ?? event.details?.description ?? '',
                    location: event.location ?? '',
                    locationNote: event.locationNote ?? '',
                    timeNote: event.timeNote ?? '',
                    registrationCloseDate: event.registrationCloseDate
                      ? toLocalInput(event.registrationCloseDate)
                      : '',
                    photoAlbumUrl: event.photoAlbumUrl ?? '',
                    feeAmount: event.feeAmount != null ? String(event.feeAmount) : '',
                    feeAtEventAmount:
                      event.feeAtEventAmount != null
                        ? String(event.feeAtEventAmount)
                        : '',
                    feeRequisites: event.feeRequisites ?? '',
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
                    program: (event.program ?? []).map((p) => ({
                      time: p.time,
                      title: p.title,
                    })),
                    questions: (event.questions ?? []).map((q) => ({
                      id: q.id,
                      label: q.label,
                      type: q.type,
                      required: q.required,
                      optionsText: q.options.join(', '),
                    })),
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
