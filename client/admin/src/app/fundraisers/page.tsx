'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Fundraiser } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { hapticNotify } from '@/lib/telegram';

export default function FundraisersListPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['fundraisers'],
    queryFn: () => api.fundraisers(),
  });
  const [pending, setPending] = useState<Fundraiser | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.deleteFundraiser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fundraisers'] });
      hapticNotify('success');
      setPending(null);
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader
        title="Збори"
        action={
          <Link href="/fundraisers/new">
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
        <p className="py-12 text-center text-sm text-subtle">Зборів ще немає.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((f) => {
            const goal = Number(f.goalAmount);
            const current = Number(f.currentAmount);
            const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
            return (
              <li
                key={f.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{f.name}</p>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                          f.status === 'ACTIVE'
                            ? 'bg-brand-green/15 text-brand-green'
                            : 'bg-subtle/20 text-subtle'
                        }`}
                      >
                        {f.status === 'ACTIVE' ? 'активний' : 'закритий'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-subtle">
                      {current.toLocaleString('uk-UA')} / {goal.toLocaleString('uk-UA')} ₴
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/fundraisers/${f.id}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
                    >
                      Ред.
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPending(f)}
                      aria-label="Видалити"
                      className="rounded-lg px-2 py-1.5 text-brand-red"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-soft">
                  <div className="h-full bg-gradient-main" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Видалити збір?"
        message={pending?.name}
        loading={del.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && del.mutate(pending.id)}
      />
    </main>
  );
}
