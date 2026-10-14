import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { GradientText } from '@/components/ui/GradientText';
import { NOINDEX } from '@/lib/seo';

/** Shari pages are working tools behind links and sign-in: kept out of search, and links don't leak the page URL. */
export const SHARI_METADATA = {
  robots: NOINDEX,
  referrer: 'no-referrer',
} as const;

/**
 * Frame of the shari pages: a platform of its own in the site's design, with
 * no site navigation. Title is "Шари <rest>" unless `heading` replaces it.
 */
export function ShariShell({
  title,
  heading,
  lead,
  children,
}: {
  title?: string;
  heading?: React.ReactNode;
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="relative isolate min-h-screen overflow-x-clip">
      <Glow color="#2B7FFF" className="left-0 top-4 h-[22rem] w-[32rem] -translate-x-1/3" />
      <Glow color="#AD46FF" className="right-0 top-24 h-[22rem] w-[32rem] translate-x-1/3" />
      <Container className="max-w-5xl pb-20 pt-6 sm:pt-8">
        <div className="flex items-center gap-3">
          <Image
            src="/logo_white.png"
            alt="Студрада ФІОТ"
            width={160}
            height={55}
            priority
            className="h-8 w-auto object-contain sm:h-9"
          />
          <span className="h-7 w-px bg-border" />
          <GradientText className="text-xl font-black tracking-tight sm:text-2xl">Шари</GradientText>
        </div>
        <h1 className="mt-10 text-3xl font-bold leading-tight tracking-tight sm:mt-14 sm:text-5xl">
          {heading ?? (
            <>
              <GradientText>Шари</GradientText> {title}
            </>
          )}
        </h1>
        {lead && <div className="mt-4 max-w-3xl text-base text-muted sm:text-lg">{lead}</div>}
        <div className="mt-8 flex flex-col gap-6">{children}</div>
      </Container>
    </main>
  );
}
