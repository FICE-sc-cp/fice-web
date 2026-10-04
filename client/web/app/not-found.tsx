import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { IconDefs } from "@/components/ui/icons";
import { Pixel404 } from "@/components/ui/Pixel404";

export const metadata: Metadata = {
  title: "Сторінку не знайдено",
};

const LINKS = [
  { label: "Заходи", href: "/events" },
  { label: "Новини", href: "/news" },
];

const PIXEL_GRID: CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)",
  backgroundSize: "2.5rem 2.5rem",
  maskImage:
    "radial-gradient(ellipse 60% 55% at 50% 40%, #000 0%, transparent 100%)",
  WebkitMaskImage:
    "radial-gradient(ellipse 60% 55% at 50% 40%, #000 0%, transparent 100%)",
};

export default function NotFound() {
  return (
    <>
      <IconDefs />
      <Header />
      <main className="relative isolate flex items-center overflow-x-clip py-14 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={PIXEL_GRID}
        />
        <Glow
          color="#36DFFF"
          className="left-1/2 top-[8%] h-[20rem] w-[40rem] -translate-x-1/2 opacity-40"
        />
        <Glow
          color="#AD46FF"
          className="bottom-0 right-0 h-[22rem] w-[30rem] translate-x-1/3 opacity-60"
        />
        <Glow
          color="#2EFF97"
          className="bottom-[15%] left-0 h-[18rem] w-[26rem] -translate-x-1/3 opacity-30"
        />

        <Container className="relative">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="animate-pop w-full max-w-[44rem]">
              <Pixel404 className="h-auto w-full" />
            </div>
            <br />
            <h1
              className="animate-rise mt-5 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "200ms" }}
            >
              Сторінку не знайдено
            </h1>
            <p
              className="animate-rise mt-4 max-w-xl text-lg text-muted sm:text-xl"
              style={{ animationDelay: "280ms" }}
            >
              Наша жабка обстрибала весь сайт, але такої сторінки так і не
              знайшла. Можливо, посилання застаріло або в адресі закралася
              помилка.
            </p>
            <div
              className="animate-rise mt-8 grid w-full max-w-sm grid-cols-2 gap-3 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center"
              style={{ animationDelay: "360ms" }}
            >
              <Link
                href="/"
                className="col-span-2 inline-flex items-center justify-center rounded-2xl bg-gradient-main px-8 py-3.5 text-lg font-bold text-black transition-transform hover:scale-[1.03] hover:opacity-95 active:scale-95"
              >
                На головну
              </Link>
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-6 py-3.5 text-lg font-bold text-fg transition-colors hover:border-brand-cyan hover:text-brand-cyan"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
