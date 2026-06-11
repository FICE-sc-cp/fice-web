'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { MenuIcon, CloseIcon } from '@/components/ui/icons';

const NAV = [
  { label: 'Про нас', href: '#about' },
  { label: 'Команда', href: '#team' },
  { label: 'Партнери', href: '#partners' },
  { label: 'Благодійність', href: '#charity' },
  { label: 'Заходи', href: '#events' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Новини', href: '#news' },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-4 z-50">
      <Container>
        <div className="relative flex items-center justify-between gap-4 rounded-2xl bg-gradient-main px-4 py-3 shadow-lg shadow-black/20 sm:px-6">
          <a href="#top" className="flex shrink-0 items-center" aria-label="На головну">
            <Image
              src="/logo_black.png"
              alt="Студрада ФІОТ"
              width={120}
              height={48}
              priority
              className="h-8 w-auto object-contain sm:h-9"
            />
          </a>

          <nav className="hidden items-center gap-5 lg:flex xl:gap-7">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-bold text-stone-950 transition-opacity hover:opacity-70"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <a
            href="#join"
            className="hidden shrink-0 rounded-lg bg-stone-950 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-80 sm:inline-flex"
          >
            Приєднатись до нас
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Закрити меню' : 'Відкрити меню'}
            aria-expanded={open}
            className="inline-flex size-9 items-center justify-center rounded-lg p-1.5 text-stone-950 lg:hidden"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>

          {open && (
            <div className="absolute inset-x-0 top-full z-50 mt-2 flex flex-col gap-1 rounded-2xl border border-border bg-bg-soft p-3 shadow-xl shadow-black/40 lg:hidden">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-3 font-semibold text-fg transition-colors hover:bg-surface"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#join"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-lg bg-gradient-main px-4 py-3 text-center font-bold text-black"
              >
                Приєднатись до нас
              </a>
            </div>
          )}
        </div>
      </Container>
    </header>
  );
}
