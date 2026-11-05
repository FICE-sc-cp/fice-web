import type { Viewport } from 'next';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { WebSurface } from '@/components/merch/surface';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function MerchLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebSurface>
      <Header />
      {/* Each page renders <main>, so main and footer stay children of body. */}
      {children}
      <Footer />
    </WebSurface>
  );
}
