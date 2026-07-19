import { ViewAllLink } from "@/components/ui/ViewAllLink";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Glow } from "@/components/ui/Glow";
import { FundraiserCard } from "@/components/charity/FundraiserCard";
import { Reveal, RevealGroup } from "@/components/ui/Reveal";
import { fice, safe, type Fundraiser } from "@/lib/api";

const EMPTY = { items: [] as Fundraiser[], total: 0, page: 1, limit: 3, totalPages: 0 };

export async function FundraisersSection() {
  const data = await safe(fice.fundraisers(3, 1), EMPTY);
  const fundraisers = data.items;

  return (
    <section id="charity" className="relative isolate scroll-mt-36 py-12 lg:py-16">
      <Glow
        color="#FF791B"
        className="bottom-0 left-1/2 h-[24rem] w-[40rem] -translate-x-1/2 translate-y-1/2 ml-[16rem] -rotate-30"
      />
      <Container>
        <Reveal>
          <SectionHeader
            title="Наші збори"
            subtitle="Донати наближають перемогу"
            gradient="bg-gradient-magenta"
          />
        </Reveal>

        {fundraisers.length === 0 ? (
          <p className="mt-14 text-center text-lg text-muted">
            Активних зборів поки немає — скоро анонсуємо 💛
          </p>
        ) : (
          <RevealGroup className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
            {fundraisers.map((item) => (
              <div
                key={item.id}
                className="w-[85vw] max-w-[22rem] shrink-0 snap-center sm:w-auto sm:max-w-none sm:shrink sm:[&>*]:h-full"
              >
                <FundraiserCard fundraiser={item} />
              </div>
            ))}
          </RevealGroup>
        )}

        <div className="mt-10 flex justify-center">
          <ViewAllLink
            href="/charity"
            gradient="bg-gradient-magenta"
            accent="text-brand-magenta"
          >
            Переглянути всі
          </ViewAllLink>
        </div>
      </Container>
    </section>
  );
}
