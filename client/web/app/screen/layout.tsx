import type { Metadata } from 'next';
import { Cormorant_Garamond, Forum, Rubik, Rubik_Wet_Paint, Unbounded } from 'next/font/google';
import { NOINDEX } from '@/lib/seo';

// Display fonts for the stage themes (FICE uses the site-wide Mulish).
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], weight: ['600', '700', '800'], variable: '--font-unbounded' });
const rubik = Rubik({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '700'], variable: '--font-rubik' });
const wetPaint = Rubik_Wet_Paint({ subsets: ['latin', 'cyrillic'], weight: '400', variable: '--font-wet' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
});
const forum = Forum({ subsets: ['latin', 'cyrillic'], weight: '400', variable: '--font-forum' });

export const metadata: Metadata = {
  title: { absolute: 'Екран голосування — Студрада ФІОТ' },
  robots: NOINDEX,
};

export default function ScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${unbounded.variable} ${rubik.variable} ${wetPaint.variable} ${cormorant.variable} ${forum.variable}`}>
      {children}
    </div>
  );
}
