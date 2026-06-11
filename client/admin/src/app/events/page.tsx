'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mediaUrl, type EventItem } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { hapticNotify } from '@/lib/telegram';

export default function EventsListPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.events(1, 50),
  });
  const [pending, setPending] = useState<EventItem | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      hapticNotify('success');
      setPending(null);
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader
        title="Заходи"
        action={
          <Link href="/events/new">
            <Button>+ Додати</Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-brand-red">Не вдалося завантажити.</p>
      ) : !data?.items.length ? (
        <p className="py-12 text-center text-sm text-subtle">Заходів ще немає.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((e) => {
            const img = mediaUrl(e.photoUrl);
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-bg-soft text-xl">
                    🎉
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.name}</p>
                  <p className="text-xs text-subtle">
                    {new Date(e.date).toLocaleDateString('uk-UA')}
                  </p>
                </div>
                <Link
                  href={`/events/${e.id}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
                >
                  Ред.
                </Link>
                <button
                  type="button"
                  onClick={() => setPending(e)}
                  aria-label="Видалити"
                  className="rounded-lg px-2 py-1.5 text-brand-red"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Видалити захід?"
        message={pending?.name}
        loading={del.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && del.mutate(pending.id)}
      />
    </main>
  );
}
