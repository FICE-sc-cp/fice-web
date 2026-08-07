import type { Metadata } from "next";
import { IconDefs } from "@/components/ui/icons";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { GradientText } from "@/components/ui/GradientText";
import { MoreNews } from "@/components/sections/MoreNews";
import { fice, safe, type News, type Paginated } from "@/lib/api";

export const metadata: Metadata = {
  title: "Новини ФІОТ — Студентська рада",
  description:
    "Події, досягнення, партнерства та все, чим живе факультет. Стеж за оновленнями ФІОТ.",
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
  const { items, total } = await safe(fice.news(INITIAL_PAGE_SIZE, 1), EMPTY);

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

        <section className="relative z-[1] px-4 pb-6 pt-16 text-center sm:px-6 lg:pt-20">
          <Container>
            <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              <GradientText>Новини</GradientText>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted sm:text-xl">
              Події, досягнення, партнерства та все, чим живе факультет. Стеж за
              оновленнями, щоб нічого не пропустити.
            </p>
          </Container>
        </section>

        {items.length > 0 ? (
          <MoreNews
            initial={items}
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
