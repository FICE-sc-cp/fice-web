'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { MenuIcon, CloseIcon } from '@/components/ui/icons';
import { JoinModal } from '@/components/sections/JoinModal';

const NAV = [
  { label: 'Про нас', href: '/#about' },
  { label: 'Команда', href: '/#team' },
  { label: 'Партнери', href: '/#partners' },
  { label: 'Благодійність', href: '/#charity' },
  { label: 'Заходи', href: '/#events' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Новини', href: '/news' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
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
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-bold text-stone-950 transition-opacity hover:opacity-70"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={ctaHref}
                onClick={() => setOpen(false)}
                className="mt-1 rounded-lg bg-gradient-main px-4 py-3 text-center font-bold text-black"
              >
                {ctaLabel}
              </Link>
            </div>
          )}
        </div>
      </Container>
    </header>
  );
}
