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

function toLocalDateInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      return api.updateEvent(id, {
        ...eventValuesToInput(v),
        detailsId,
        photoUrl: v.photoUrl?.trim() || null,
        location: v.location?.trim() || null,
        locationNote: v.locationNote?.trim() || null,
        photoAlbumUrl: v.photoAlbumUrl?.trim() || null,
        isAbitfest: v.isAbitfest ?? false,
        noRegistration: v.noRegistration ?? false,
        isDraft: v.isDraft ?? false,
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
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/events/${id}/registrations`}
          className="inline-flex rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-brand-cyan transition-colors hover:border-brand-cyan"
        >
          Список зареєстрованих →
        </Link>
        <Link
          href={`/events/${id}/voting`}
          className="inline-flex rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-fg transition-colors hover:border-white/40"
        >
          🗳 Голосування заходу →
        </Link>
        <Link
          href={`/events/${id}/broadcast`}
          className="inline-flex rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-brand-green transition-colors hover:border-brand-green"
        >
          📢 Розсилка учасникам →
        </Link>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <EventForm
          submitLabel="Зберегти"
          submitting={mutation.isPending}
          onSubmit={(v) => mutation.mutate(v)}
          error={mutation.error}
          draftKey={`edit_event_${id}`}
          partnersSlot={
            event ? (
              <EventPartners eventId={event.id} attached={event.eventPartners ?? []} />
            ) : undefined
          }
          defaultValues={
            event
              ? {
                  name: event.name,
                  date: toLocalDateInput(event.date),
                  hasTime: event.hasTime ?? true,
                  time: event.time || toLocalTimeInput(event.date),
                  photoUrl: event.photoUrl,
                  description: event.description ?? event.details?.description ?? '',
                  isAbitfest: event.isAbitfest ?? false,
                  noRegistration: event.noRegistration ?? false,
                  isDraft: event.isDraft ?? false,
                  allowedFaculties: event.allowedFaculties ?? [],
                  checkInStaffTags: event.checkInStaffTags ?? [],
                  baseQuestionsConfig: (event.baseQuestionsConfig as any) ?? undefined,
                  location: event.location ?? '',
                  locationNote: event.locationNote ?? '',
                  timeNote: event.timeNote ?? '',
                  registrationCloseDate: event.registrationCloseDate
                    ? toLocalDateInput(event.registrationCloseDate)
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
      )}
    </main>
  );
}
