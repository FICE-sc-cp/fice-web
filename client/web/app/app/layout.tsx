import type { Metadata, Viewport } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'FICE Events — Mini App',
  description: 'Реєстрація на заходи FICE та голосування в Telegram',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <div
        id="mini-app-root"
        className="mx-auto min-h-screen max-w-md w-full bg-bg text-fg antialiased selection:bg-brand-cyan/30 overflow-y-auto relative border-x border-border/20 shadow-2xl"
      >
        {children}
      </div>
    </>
  );
}
