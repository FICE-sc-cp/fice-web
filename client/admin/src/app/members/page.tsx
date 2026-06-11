'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type DepartmentMember } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ROLE_OPTIONS } from '@/components/forms/MemberForm';
import { hapticNotify } from '@/lib/telegram';

const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;

export default function MembersListPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.members(),
  });
  const [pending, setPending] = useState<DepartmentMember | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.deleteMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      hapticNotify('success');
      setPending(null);
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader
        title="Президія"
        action={
          <Link href="/members/new">
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
        <p className="py-12 text-center text-sm text-subtle">Тут поки порожньо.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {m.lastName} {m.firstName}
                </p>
                <p className="truncate text-xs text-subtle">
                  {roleLabel(m.role)}
                  {m.specialization ? ` · ${m.specialization}` : ''}
                  {m.assignments?.length
                    ? ` · ${m.assignments.map((a) => a.department.name).join(', ')}`
                    : ''}
                </p>
              </div>
              <Link
                href={`/members/${m.id}`}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
              >
                Ред.
              </Link>
              <button
                type="button"
                onClick={() => setPending(m)}
                aria-label="Видалити"
                className="rounded-lg px-2 py-1.5 text-brand-red"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Видалити з президії?"
        message={pending ? `${pending.lastName} ${pending.firstName}` : undefined}
        loading={del.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && del.mutate(pending.id)}
      />
    </main>
  );
}
