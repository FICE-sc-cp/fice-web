import type { Metadata } from "next";
import { IconDefs } from "@/components/ui/icons";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { GradientText } from "@/components/ui/GradientText";
import { PageHero } from "@/components/ui/PageHero";
import { MoreNews } from "@/components/sections/MoreNews";
import { fice, safe, type News, type Paginated } from "@/lib/api";

export const metadata: Metadata = {
  title: "Новини",
  description:
    "Новини Студентської ради ФІОТ КПІ: події, досягнення, освіта, партнерства та все, чим живе факультет. Стеж за оновленнями ФІОТ.",
};

const EMPTY: Paginated<News> = {
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
};

const INITIAL_PAGE_SIZE = 10;
const MORE_PAGE_SIZE = 9;

export default async function NewsCatalogPage() {
  const [{ items, total }, main] = await Promise.all([
    safe(fice.news(INITIAL_PAGE_SIZE, 1), EMPTY),
    safe<News | null>(fice.featuredNews(), null),
  ]);

  return (
    <>
      <IconDefs />
      <Header />
      <main className="relative isolate overflow-x-clip">
        <Glow
          color="#36DFFF"
          className="-left-40 -top-28 h-[30rem] w-[39rem] opacity-60"
        />
        <Glow
          color="#AD46FF"
          className="right-[-12rem] top-[32rem] h-[32rem] w-[40rem] opacity-60"
        />

        <section className="relative z-[1] pb-10 pt-16 lg:pt-24">
          <PageHero
            title={
              <>
                Чим живе <GradientText>Студрада ФІОТ</GradientText>
              </>
            }
            scene="reader"
            says="Анонси, підсумки заходів і важливі оновлення від Студради — коротко й по суті."
          />
        </section>

        {items.length > 0 ? (
          <MoreNews
            initial={items}
            main={main}
            total={total}
            pageSize={MORE_PAGE_SIZE}
          />
        ) : (
          <section className="py-20">
            <Container>
              <div className="flex flex-col items-center gap-2.5 text-center">
                <span className="text-4xl">📰</span>
                <h2 className="text-2xl font-extrabold">Новин поки немає</h2>
                <p className="max-w-md text-base text-subtle">
                  Зовсім скоро тут зʼявляться перші новини факультету.
                </p>
              </div>
            </Container>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
