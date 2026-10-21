import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: 'Вибір партнера — Студрада ФІОТ' },
  robots: NOINDEX,
};

export default function PickLayout({ children }: { children: React.ReactNode }) {
  return children;
}
