'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mediaUrl, type Partner } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { hapticNotify } from '@/lib/telegram';

export default function PartnersListPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['partners'],
    queryFn: () => api.partners(),
  });
  const [pending, setPending] = useState<Partner | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.deletePartner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] });
      hapticNotify('success');
      setPending(null);
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader
        title="Партнери"
        action={
          <Link href="/partners/new">
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
        <p className="py-12 text-center text-sm text-subtle">Партнерів ще немає.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((p) => {
            const logo = mediaUrl(p.logoImage);
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-border bg-surface p-3"
              >
                <div className="flex items-center gap-3">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-1"
                    />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-bg-soft text-xl">
                      🤝
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    {p.shortDescription && (
                      <p className="truncate text-xs text-subtle">
                        {p.shortDescription}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/partners/${p.id}`}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
                  >
                    Ред.
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPending(p)}
                    aria-label="Видалити"
                    className="rounded-lg px-2 py-1.5 text-brand-red"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Видалити партнера?"
        message={pending?.name}
        loading={del.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && del.mutate(pending.id)}
      />
    </main>
  );
}
