'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSurface } from './surface';
import { CONTROL } from './ui';

const ICONS = {
  bag: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  box: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  gear: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

/** Which tab a path lives under: a product and checkout are the catalog, pickup the orders. */
function section(path: string) {
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/orders') || path.startsWith('/pickup')) return 'orders';
  if (path.startsWith('/profile')) return 'profile';
  return 'catalog';
}

/** The Mini App's bottom bar, the same as the events Mini App's. The web has the site header. */
export function Tabs() {
  const { base, isAdmin, tg } = useSurface();
  const current = section(usePathname().slice(base.length));

  const tabs = [
    { id: 'catalog', href: base, label: 'Каталог', icon: ICONS.bag },
    { id: 'orders', href: `${base}/orders`, label: 'Замовлення', icon: ICONS.box },
    { id: 'profile', href: `${base}/profile`, label: 'Профіль', icon: ICONS.user },
    ...(isAdmin ? [{ id: 'admin', href: `${base}/admin`, label: 'Адмін', icon: ICONS.gear }] : []),
  ];

  return (
    <nav
      aria-label="Мерч"
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-border/80 bg-bg/95 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const active = tab.id === current;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              onClick={() => tg?.haptic('light')}
              className={cn(
                'flex min-w-16 flex-col items-center gap-1.5 rounded-xl py-1 text-xs font-bold transition-colors',
                CONTROL,
                active ? 'text-brand-cyan' : 'text-muted hover:text-fg',
              )}
            >
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
