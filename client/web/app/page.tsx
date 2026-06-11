import { IconDefs } from '@/components/ui/icons';
import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/sections/HeroSection';
import { StatementSection } from '@/components/sections/StatementSection';
import { AboutSection } from '@/components/sections/AboutSection';
import { ValuesSection } from '@/components/sections/ValuesSection';
import { FactsSection } from '@/components/sections/FactsSection';

export default function HomePage() {
  return (
    <>
      <IconDefs />
      <Header />
      <main id="top" className="overflow-x-clip">
        <HeroSection />
        <StatementSection />
        <AboutSection />
        <ValuesSection />
        <FactsSection />
      </main>
    </>
  );
}
