"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { FrogMascot } from "@/components/ui/FrogMascot";
import { MenuIcon, CloseIcon } from "@/components/ui/icons";

const NAV = [
  { label: "Головна", href: "/" },
  { label: "Команда", href: "/team" },
  { label: "Благодійність", href: "/charity" },
  { label: "Заходи", href: "/events" },
  { label: "Новини", href: "/news" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isJoinPage = pathname === "/join";
  const ctaHref = isJoinPage ? "/" : "/join";
  const ctaLabel = isJoinPage ? "На головну" : "Приєднатись до нас";

  return (
    <header className="sticky top-4 z-50">
      <Container>
        <div className="relative">
          <span className="pointer-events-none absolute right-0 top-1/2 hidden h-14 w-14 -translate-y-1/2 translate-x-[70%] rotate-12 drop-shadow-md lg:block">
            <span className="block h-full w-full animate-float">
              <FrogMascot className="h-full w-full" />
            </span>
          </span>
          <div className="relative flex items-center justify-between gap-4 rounded-2xl bg-gradient-main px-4 py-3 shadow-lg shadow-black/20 sm:px-6">
            <Link
              href="/"
              className="flex shrink-0 items-center"
              aria-label="На головну"
            >
              <Image
                src="/logo_black.png"
                alt="Студрада ФІОТ"
                width={120}
                height={48}
                priority
                className="h-8 w-auto object-contain sm:h-9"
              />
            </Link>

            <nav className="hidden items-center gap-5 lg:flex xl:gap-7">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative text-base font-bold text-stone-950 transition-opacity after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-stone-950 after:transition-all after:duration-300 hover:after:w-full"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <Link
              href={ctaHref}
              className="hidden shrink-0 justify-center rounded-lg bg-stone-950 px-4 py-2 text-center text-base font-bold text-white transition-opacity hover:opacity-80 sm:inline-flex sm:min-w-[11.5rem]"
            >
              {ctaLabel}
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Закрити меню" : "Відкрити меню"}
              aria-expanded={open}
              className="inline-flex size-9 items-center justify-center rounded-lg p-1.5 text-stone-950 lg:hidden"
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>

            {open && (
              <div className="absolute inset-x-0 top-full z-50 mt-2 flex flex-col gap-1 rounded-2xl border border-border bg-bg-soft p-3 shadow-xl shadow-black/40 lg:hidden">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-3 font-semibold text-fg transition-colors hover:bg-surface"
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
        </div>
      </Container>
    </header>
  );
}
