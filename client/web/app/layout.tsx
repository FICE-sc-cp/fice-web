import type { Metadata, Viewport } from 'next';
import { Mulish } from 'next/font/google';
import './globals.css';

const mulish = Mulish({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mulish',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Студентська рада ФІОТ',
  description:
    'Сайт студентської ради ФІОТ — діяльність, заходи, збори, партнерство та вступ до команди.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${mulish.variable} scroll-smooth`}>
      <body className="flex min-h-screen flex-col bg-bg font-sans text-fg antialiased">
        <noscript>
          <style>{`.reveal,.reveal-stagger>*{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
