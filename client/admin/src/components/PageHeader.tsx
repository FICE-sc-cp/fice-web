'use client';

import { useRouter } from 'next/navigation';
import { useBackButton } from '@/lib/telegram';

export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  const router = useRouter();
  useBackButton(() => router.back());

  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Назад"
          className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-muted transition-colors hover:text-fg"
        >
          ←
        </button>
        <h1 className="truncate text-xl font-bold">{title}</h1>
      </div>
      {action}
    </div>
  );
}
