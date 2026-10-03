import type { Metadata } from 'next';
import { Mulish } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const mulish = Mulish({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mulish',
  display: 'swap',
});

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'FICE — Адмінка',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: `${base}/favicon.ico`, sizes: 'any' },
      { url: `${base}/icon.png`, type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: `${base}/apple-icon.png`, sizes: '180x180', type: 'image/png' },
    ],
    shortcut: `${base}/favicon.ico`,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk" className={mulish.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
