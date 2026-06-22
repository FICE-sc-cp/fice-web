'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useBackButton } from '@/lib/telegram';

/** One level up in the route tree, e.g. /members/123 → /members, /members → / */
function parentPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  segments.pop();
  return '/' + segments.join('/');
}

export function PageHeader({
  title,
  action,
  backHref,
}: {
  title: string;
  action?: React.ReactNode;
  backHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const target = backHref ?? parentPath(pathname);
  const goUp = () => router.push(target);
  useBackButton(goUp);

  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={goUp}
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
