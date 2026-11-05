import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Container } from './Container';
import { SpeechBubble } from './PixelFrame';
import { FrogScene, SCENES, type FrogSceneName } from './ThemedFrogs';

/**
 * The block a section page opens with: a title in the council's voice, and under it the page's
 * frog, dressed for the section, saying what the page is for. `--fpx` is one frog pixel, and
 * sets every sprite's size. It comes in as a sequence: the title rises, the frog hops in, its
 * bubble pops out as it lands, then the call to action; the page under it waits for the frog
 * (see Reveal).
 */
export function PageHero({
  title,
  scene,
  says,
  children,
  className,
}: {
  title: ReactNode;
  scene: FrogSceneName;
  says: ReactNode;
  /** A call to action under the frog, when the page has one. */
  children?: ReactNode;
  className?: string;
}) {
  const { h, eyeFromBottom } = SCENES[scene];
  return (
    <Container
      className={cn(
        'flex flex-col items-center text-center [--fpx:4px] sm:[--fpx:5px] lg:[--fpx:6px]',
        className,
      )}
    >
      <h1 className="animate-rise max-w-4xl text-balance text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
        {title}
      </h1>
      <div className="mt-8 flex w-full max-w-3xl flex-col items-center gap-5 sm:mt-10 sm:flex-row sm:items-end sm:justify-center sm:gap-6">
        <FrogScene
          scene={scene}
          className="animate-frog-in w-auto shrink-0 drop-shadow-md"
          style={{ height: `calc(var(--fpx) * ${h})` }}
        />
        {/* Grows out of its tail: above it on phones, on its left beside the frog. */}
        <SpeechBubble
          eye={eyeFromBottom}
          className="animate-bubble-in origin-top sm:max-w-[30rem] sm:origin-left"
        >
          {says}
        </SpeechBubble>
      </div>
      {children && (
        <div className="animate-rise mt-8" style={{ animationDelay: '560ms' }}>
          {children}
        </div>
      )}
    </Container>
  );
}
