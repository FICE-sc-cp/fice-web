import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { NOINDEX } from '@/lib/seo';
import { PartyFrog, SphereCloud } from './decor';

/** Shari pages are working tools behind links and sign-in: kept out of search, and links don't leak the page URL. */
export const SHARI_METADATA = {
  robots: NOINDEX,
  referrer: 'no-referrer',
} as const;

/**
 * Frame of the shari pages: a platform of its own in the site's design —
 * FICE's birthday, with the council's pixel frog and floating "шари".
 */
export function ShariShell({
  heading,
  lead,
  children,
}: {
  heading: React.ReactNode;
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="relative isolate min-h-screen overflow-x-clip">
      <div aria-hidden className="shari-dots pointer-events-none absolute inset-x-0 top-0 -z-20 h-[46rem]" />
      <Glow color="#2B7FFF" className="left-0 top-4 h-[22rem] w-[32rem] -translate-x-1/3" />
      <Glow color="#AD46FF" className="right-0 top-24 h-[22rem] w-[32rem] translate-x-1/3" />
      <Container className="max-w-5xl pb-24 pt-6 sm:pt-8">
        <Image
          src="/logo_white.png"
          alt="Студрада ФІОТ"
          width={160}
          height={55}
          priority
          className="h-8 w-auto object-contain sm:h-9"
        />

        <header className="mt-10 sm:mt-14">
          <div className="flex items-start justify-between gap-4 sm:items-end">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-black leading-[1.04] tracking-tight sm:text-6xl">{heading}</h1>
              {lead && <div className="mt-5 max-w-xl text-base text-muted sm:text-lg">{lead}</div>}
            </div>
            <div className="relative isolate shrink-0">
              <SphereCloud />
              <PartyFrog className="frog-big w-20 drop-shadow-[0_12px_32px_rgba(46,255,151,0.25)] sm:w-40 lg:w-48" />
            </div>
          </div>
        </header>

        <div className="mt-10 flex flex-col gap-6 sm:mt-14">{children}</div>
      </Container>
    </main>
  );
}
