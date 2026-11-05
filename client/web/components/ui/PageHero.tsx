import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Container } from './Container';
import { SpeechBubble } from './PixelFrame';
import { FrogScene, SCENES, type FrogSceneName } from './ThemedFrogs';

/**
 * The block a section page opens with: a title in the council's voice, and under it the page's
 * frog, dressed for the section, saying what the page is for. `--fpx` is one frog pixel, and
 * sets every sprite's size.
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
      <h1
        className="animate-rise max-w-4xl text-balance text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl"
        style={{ animationDelay: '80ms' }}
      >
        {title}
      </h1>
      <div
        className="animate-rise mt-8 flex w-full max-w-3xl flex-col items-center gap-5 sm:mt-10 sm:flex-row sm:items-end sm:justify-center sm:gap-6"
        style={{ animationDelay: '180ms' }}
      >
        <FrogScene
          scene={scene}
          className="w-auto shrink-0 drop-shadow-md"
          style={{ height: `calc(var(--fpx) * ${h})` }}
        />
        <SpeechBubble eye={eyeFromBottom} className="sm:max-w-[30rem]">
          {says}
        </SpeechBubble>
      </div>
      {children && (
        <div className="animate-rise mt-8" style={{ animationDelay: '280ms' }}>
          {children}
        </div>
      )}
    </Container>
  );
}
