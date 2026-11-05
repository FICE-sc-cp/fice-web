import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import Script from 'next/script';
import { TelegramSurface } from '@/components/merch/surface';
import { Tabs } from '@/components/merch/Tabs';
import { NOINDEX } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: 'Мерч FICE — Mini App' },
  description: 'Каталог мерчу Студради ФІОТ',
  robots: NOINDEX,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MerchAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      {/* overflow-x-clip, not the overflow-y-auto of /interview: that makes this div a scroll
          container that never scrolls, and sticky bars inside it would never engage. */}
      <div
        id="mini-app-root"
        className="mx-auto min-h-screen max-w-md w-full bg-bg text-fg antialiased selection:bg-brand-cyan/30 overflow-x-clip relative border-x border-border/20 shadow-2xl"
      >
        <TelegramSurface>
          <div className="relative min-h-screen pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
            {/* The events Mini App's header, so both bots look like one family. */}
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-bg/95 px-4 py-3 backdrop-blur-xl">
              <Image
                src="/logo_white.png"
                alt="Студрада ФІОТ"
                width={130}
                height={40}
                priority
                className="h-8 w-auto object-contain"
              />
            </header>
            <main className="space-y-4 p-4">{children}</main>
            <Tabs />
          </div>
        </TelegramSurface>
      </div>
    </>
  );
}
