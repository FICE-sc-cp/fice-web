import { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';

function Underlined({
  children,
  gradient,
}: {
  children: ReactNode;
  gradient: string;
}) {
  return (
    <span className="relative whitespace-nowrap">
      {children}
      <span
        aria-hidden
        className={`absolute -bottom-1 left-0 h-1.5 w-full rounded-full ${gradient}`}
      />
    </span>
  );
}

export function StatementSection() {
  return (
    <section className="py-20 lg:py-28">
      <Container>
        <p className="mx-auto max-w-5xl text-center text-3xl font-bold leading-tight sm:text-4xl lg:text-6xl">
          Від освітніх процесів до{' '}
          <Underlined gradient="bg-gradient-orange">
            партнерських проєктів
          </Underlined>{' '}
          — ми робимо це системно та ініціюємо{' '}
          <Underlined gradient="bg-gradient-blue">зміни</Underlined>, які реально
          працюють.
        </p>
      </Container>
    </section>
  );
}
