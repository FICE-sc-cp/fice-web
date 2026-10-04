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
    queryKey: ['partners', 'all'],
    queryFn: () => api.allPartners(),
  });
  const [pending, setPending] = useState<Partner | null>(null);
  const applications = (data?.items ?? []).filter((p) => !p.isApproved);
  const approved = (data?.items ?? []).filter((p) => p.isApproved);

  const approve = useMutation({
    mutationFn: (id: string) => api.approvePartner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] });
      hapticNotify('success');
    },
    onError: () => hapticNotify('error'),
  });

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
        <>
        {applications.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold text-amber-300">
              Заявки на партнерство ({applications.length})
            </h2>
            <ul className="flex flex-col gap-3">
              {applications.map((p) => (
                <li
                  key={p.id}
                  className="space-y-2 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4"
                >
                  <p className="font-semibold">{p.name}</p>
                  {p.websiteLink && (
                    <a
                      href={p.websiteLink}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-xs text-brand-cyan underline"
                    >
                      {p.websiteLink}
                    </a>
                  )}
                  {(p.contactName || p.contactMethod) && (
                    <p className="text-xs text-muted">
                      Контакт: {[p.contactName, p.contactMethod].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {p.proposal && (
                    <p className="whitespace-pre-line rounded-xl bg-bg-soft p-3 text-sm text-fg">
                      {p.proposal}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(p.id)}
                    >
                      Схвалити
                    </Button>
                    <Button type="button" variant="danger" onClick={() => setPending(p)}>
                      Видалити
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {approved.length > 0 && (
        <ul className="flex flex-col gap-3">
          {approved.map((p) => {
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
                    {p.websiteLink && (
                      <p className="truncate text-xs text-subtle">
                        {p.websiteLink}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
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
                </div>
              </li>
            );
          })}
        </ul>
        )}
        </>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Видалити партнера?"
        message={pending?.name}
        loading={del.isPending}
        error={del.error}
        onCancel={() => {
          setPending(null);
          del.reset();
        }}
        onConfirm={() => pending && del.mutate(pending.id)}
      />
    </main>
  );
}
