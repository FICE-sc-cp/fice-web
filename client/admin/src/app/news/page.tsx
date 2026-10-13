'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mediaUrl, type News } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CATEGORY_OPTIONS } from '@/components/forms/NewsForm';
import { hapticNotify } from '@/lib/telegram';
import { isVideo, todayInputValue } from '@/lib/utils';

/** Published news per category for a chosen period. */
function NewsStatsCard() {
  const [from, setFrom] = useState(() => `${todayInputValue().slice(0, 8)}01`);
  const [to, setTo] = useState(() => todayInputValue());
  const stats = useQuery({
    queryKey: ['news-stats', from, to],
    queryFn: () => api.newsStats(from || undefined, to || undefined),
  });

  return (
    <Card className="mb-4 flex flex-col gap-3">
      <p className="font-semibold">📊 Скільки новин опубліковано</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="З"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          label="По"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {stats.isLoading ? (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      ) : stats.isError ? (
        <p className="text-sm text-brand-red">Не вдалося порахувати.</p>
      ) : stats.data ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {CATEGORY_OPTIONS.map(({ value, label }) => (
            <li key={value} className="flex justify-between gap-2">
              <span className="text-muted">
                {value ? label : 'Без категорії'}
              </span>
              <span className="font-semibold">
                {stats.data.byCategory[value || 'NONE'] ?? 0}
              </span>
            </li>
          ))}
          <li className="mt-1 flex justify-between gap-2 border-t border-border pt-2 font-semibold">
            <span>Усього</span>
            <span>{stats.data.total}</span>
          </li>
        </ul>
      ) : null}
    </Card>
  );
}

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

      <NewsStatsCard />

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
                {img && isVideo(img) ? (
                  <video
                    src={img}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : img ? (
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
                  <p className="truncate text-xs text-subtle">
                    {new Date(n.publishDate).toLocaleDateString('uk-UA')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Link
                    href={`/news/${n.id}`}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
                  >
                    Ред.
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      del.reset();
                      setPending(n);
                    }}
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
        title="Видалити новину?"
        message={pending?.title}
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
