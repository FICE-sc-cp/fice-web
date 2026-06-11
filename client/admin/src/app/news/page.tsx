'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mediaUrl, type News } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { hapticNotify } from '@/lib/telegram';

export default function NewsListPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['news'],
    queryFn: () => api.news(1, 50),
  });
  const [pending, setPending] = useState<News | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api.deleteNews(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['news'] });
      hapticNotify('success');
      setPending(null);
    },
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <PageHeader
        title="Новини"
        action={
          <Link href="/news/new">
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
        <p className="py-12 text-center text-sm text-subtle">
          Поки що порожньо. Додай першу новину.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((n) => {
            const img = mediaUrl(n.image);
            return (
              <li
                key={n.id}
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
                    📰
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{n.title}</p>
                  <p className="text-xs text-subtle">
                    {new Date(n.publishDate).toLocaleDateString('uk-UA')}
                  </p>
                </div>
                <Link
                  href={`/news/${n.id}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
                >
                  Ред.
                </Link>
                <button
                  type="button"
                  onClick={() => setPending(n)}
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
        title="Видалити новину?"
        message={pending?.title}
        loading={del.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && del.mutate(pending.id)}
      />
    </main>
  );
}
