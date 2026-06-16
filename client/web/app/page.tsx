import { IconDefs } from '@/components/ui/icons';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/sections/HeroSection';
import { StatementSection } from '@/components/sections/StatementSection';
import { AboutSection } from '@/components/sections/AboutSection';
import { ValuesSection } from '@/components/sections/ValuesSection';
import { FactsSection } from '@/components/sections/FactsSection';
import { DepartmentsSection } from '@/components/sections/DepartmentsSection';
import { TeamSection } from '@/components/sections/TeamSection';
import { Marquee } from '@/components/sections/Marquee';
import { PartnersSection } from '@/components/sections/PartnersSection';
import { FundraisersSection } from '@/components/sections/FundraisersSection';
import { EventsSection } from '@/components/sections/EventsSection';
import { FaqSection } from '@/components/sections/FaqSection';
import { JoinSection } from '@/components/sections/JoinSection';
import { GallerySection } from '@/components/sections/GallerySection';

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
        <DepartmentsSection />
        <TeamSection />
        <Marquee />
        <PartnersSection />
        <FundraisersSection />
        <EventsSection />
        <Marquee />
        <FaqSection />
        <JoinSection />
        <GallerySection />
      </main>
      <Footer />
    </>
  );
}
