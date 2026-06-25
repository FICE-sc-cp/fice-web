import type { Metadata } from 'next';
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${mulish.variable} scroll-smooth`}>
      <head>
        <noscript>
          <style>{`.reveal,.reveal-stagger>*{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        {children}
      </body>
    </html>
  );
}
