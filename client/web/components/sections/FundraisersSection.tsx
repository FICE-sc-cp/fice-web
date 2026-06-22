import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Glow } from "@/components/ui/Glow";
import { FundraiserCard } from "@/components/charity/FundraiserCard";
import { fice, safe, type Fundraiser } from "@/lib/api";

const EMPTY = { items: [] as Fundraiser[], total: 0, page: 1, limit: 3, totalPages: 0 };

export async function FundraisersSection() {
  const data = await safe(fice.fundraisers(3, 1), EMPTY);
  const fundraisers = data.items;

  return (
    <section id="charity" className="relative isolate scroll-mt-28 py-20 lg:py-28">
      <Glow
        color="#FF791B"
        className="bottom-0 left-1/2 h-[24rem] w-[40rem] -translate-x-1/2 translate-y-1/2 ml-[16rem] -rotate-30"
      />
      <Container>
        <SectionHeader
          title="Наші збори"
          subtitle="Донати наближають перемогу"
          gradient="bg-gradient-magenta"
        />

        {fundraisers.length === 0 ? (
          <p className="mt-14 text-center text-lg text-muted">
            Активних зборів поки немає — скоро анонсуємо 💛
          </p>
        ) : (
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {fundraisers.map((item) => (
              <FundraiserCard key={item.id} fundraiser={item} />
            ))}
          </div>
        )}

        <div className="mt-14 flex justify-center">
          <Link
            href="/charity"
            className="rounded-2xl bg-neutral-600/40 px-16 py-5 text-2xl font-bold text-white transition-colors hover:bg-neutral-600/60 lg:text-3xl"
          >
            Переглянути всі
          </Link>
        </div>
      </Container>
    </section>
  );
}
