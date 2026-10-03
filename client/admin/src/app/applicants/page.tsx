'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

export default function ApplicantsListPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300).trim();
  const applicants = useInfiniteQuery({
    queryKey: ['applicants', debouncedSearch],
    queryFn: ({ pageParam }) =>
      api.applicants(pageParam, 50, debouncedSearch || undefined),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
  });
  const { isLoading, isError } = applicants;
  const data = useMemo(
    () =>
      applicants.data
        ? {
            total: applicants.data.pages[0].total,
            items: applicants.data.pages.flatMap((p) => p.items),
          }
        : undefined,
    [applicants.data],
  );

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader title="Заявки на вступ" />

      <div className="mb-4">
        <Input
          label="Пошук"
          placeholder="Прізвище, @тег, група або телефон"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-brand-red">Не вдалося завантажити.</p>
      ) : !data?.items.length ? (
        <p className="py-12 text-center text-sm text-subtle">
          {debouncedSearch ? 'Нічого не знайдено.' : 'Заявок ще немає.'}
        </p>
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

      {data && data.total > data.items.length && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-xs text-muted">
            Показано {data.items.length} з {data.total}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={applicants.isFetchingNextPage}
            onClick={() => applicants.fetchNextPage()}
          >
            {applicants.isFetchingNextPage ? 'Завантаження…' : 'Показати ще'}
          </Button>
        </div>
      )}
    </main>
  );
}
