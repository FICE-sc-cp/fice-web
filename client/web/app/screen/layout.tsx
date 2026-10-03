import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: 'Екран голосування — Студрада ФІОТ' },
  robots: NOINDEX,
};

export default function ScreenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
