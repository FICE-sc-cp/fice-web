'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Spinner } from '@/components/ui/Spinner';

export default function ApplicantsListPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['applicants'],
    queryFn: () => api.applicants(),
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Заявки на вступ" />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-brand-red">Не вдалося завантажити.</p>
      ) : !data?.items.length ? (
        <p className="py-12 text-center text-sm text-subtle">Заявок ще немає.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((a) => (
            <li key={a.id}>
              <Link
                href={`/applicants/${a.id}`}
                className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand-cyan"
              >
                <p className="font-semibold">
                  {a.lastName} {a.firstName}
                </p>
                <p className="text-xs text-subtle">
                  {a.group} · {new Date(a.createdAt).toLocaleDateString('uk-UA')}
                </p>
                {a.applicantDepartments?.length ? (
                  <p className="mt-1 truncate text-xs text-muted">
                    {a.applicantDepartments.map((d) => d.department.name).join(', ')}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
