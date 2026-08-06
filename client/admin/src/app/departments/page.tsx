'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Department } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { hapticNotify } from '@/lib/telegram';

export default function DepartmentsListPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.departments(),
  });
  const [pending, setPending] = useState<Department | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.deleteDepartment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      hapticNotify('success');
      setPending(null);
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader
        title="Департаменти"
        action={
          <Link href="/departments/new">
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
      ) : !data?.length ? (
        <p className="py-12 text-center text-sm text-subtle">Департаментів ще немає.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{d.name}</p>
                {d.head && (
                  <p className="truncate text-xs text-subtle">
                    {d.head.firstName} {d.head.lastName}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/departments/${d.id}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
                >
                  Ред.
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    del.reset();
                    setPending(d);
                  }}
                  aria-label="Видалити"
                  className="rounded-lg px-2 py-1.5 text-brand-red"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Видалити департамент?"
        message={pending?.name}
        loading={del.isPending}
        error={del.error}
        onCancel={() => {
          del.reset();
          setPending(null);
        }}
        onConfirm={() => pending && del.mutate(pending.id)}
      />
    </main>
  );
}
