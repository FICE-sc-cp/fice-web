'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { hapticNotify } from '@/lib/telegram';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { cn } from '@/lib/utils';

const STATUS_KEY = ['application-status'];

function IntakeCard() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => api.applicationStatus(),
  });
  const toggle = useMutation({
    mutationFn: (open: boolean) => api.setApplicationStatus(open),
    onSuccess: (next) => {
      qc.setQueryData(STATUS_KEY, next);
      hapticNotify('success');
      setConfirm(false);
    },
  });

  if (status.isLoading) {
    return (
      <Card className="mb-4 flex justify-center">
        <Spinner />
      </Card>
    );
  }
  if (!status.data) {
    return (
      <div className="mb-4">
        <FormError
          messages={['Не вдалося дізнатися, чи відкрито прийом заявок.']}
        />
      </div>
    );
  }

  const { open, updatedAt } = status.data;

  return (
    <>
      <Card className="mb-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-1.5 size-2.5 shrink-0 rounded-full',
              open ? 'bg-brand-green' : 'bg-brand-red',
            )}
          />
          <div className="min-w-0">
            <p className="font-semibold">
              {open ? 'Прийом заявок відкрито' : 'Прийом заявок закрито'}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {open
                ? 'Анкета на сторінці вступу доступна всім.'
                : 'На сторінці вступу замість анкети — повідомлення про наступний набір.'}
            </p>
            {updatedAt && (
              <p className="mt-0.5 text-xs text-subtle">
                Змінено{' '}
                {new Date(updatedAt).toLocaleString('uk-UA', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>
            )}
          </div>
        </div>
        {toggle.isError && !confirm && <FormError error={toggle.error} />}
        <Button
          type="button"
          variant={open ? 'danger' : 'primary'}
          disabled={toggle.isPending}
          onClick={() => (open ? setConfirm(true) : toggle.mutate(true))}
        >
          {open
            ? 'Закрити прийом заявок'
            : toggle.isPending
              ? '…'
              : 'Відкрити прийом заявок'}
        </Button>
      </Card>

      <ConfirmDialog
        open={confirm}
        title="Закрити прийом заявок?"
        message="Анкета зникне зі сторінки вступу, і нові заявки не прийматимуться. Відкрити прийом знову можна будь-коли."
        confirmLabel="Закрити"
        loading={toggle.isPending}
        error={toggle.error}
        onCancel={() => {
          setConfirm(false);
          toggle.reset();
        }}
        onConfirm={() => toggle.mutate(false)}
      />
    </>
  );
}

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

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleSyncSheets = async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const res = await api.syncGoogleSheets();
      if (res.success) {
        setSyncStatus(`✅ Успішно синхронізовано ${res.synced} заявок у Google Таблицю!`);
      } else {
        setSyncStatus(`❌ ${res.error || 'Помилка синхронізації'}`);
      }
    } catch (err: any) {
      setSyncStatus(`❌ ${err?.message || 'Не вдалося виконати синхронізацію'}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4 flex flex-col gap-3">
        <PageHeader title="Заявки на вступ" />
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={syncing}
            onClick={handleSyncSheets}
            className="text-xs"
          >
            {syncing ? <Spinner /> : '📊 Синхронізувати з Google Sheets'}
          </Button>
        </div>
        {syncStatus && (
          <p className="text-xs font-medium text-muted">{syncStatus}</p>
        )}
      </div>

      <IntakeCard />

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
