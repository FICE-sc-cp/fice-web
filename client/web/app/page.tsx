import { Container } from '@/components/ui/Container';
import { GradientText } from '@/components/ui/GradientText';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center text-center">
      <Container className="py-24">
        <h1 className="text-4xl font-bold uppercase leading-[1.05] sm:text-6xl md:text-7xl">
          Студентська рада <GradientText>ФІОТ</GradientText>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
          Ми знайшли баланс між незалежністю та ефективною співпрацею — зі
          студентами, університетом і партнерами.
        </p>
      </Container>
    </main>
  );
}
