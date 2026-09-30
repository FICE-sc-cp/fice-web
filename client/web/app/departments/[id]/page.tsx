import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { Marquee } from "@/components/sections/Marquee";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { ProjectsGrid } from "@/components/sections/ProjectsGrid";
import {
  DepartmentSectionHeading,
  DepartmentTop,
} from "@/components/sections/DepartmentTop";
import { AccentCard, accentGradient } from "@/components/ui/AccentCard";
import { IconDefs } from "@/components/ui/icons";
import { DEPARTMENTS, departmentSlugs } from "@/lib/departments";

export function generateStaticParams() {
  return departmentSlugs.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const dept = DEPARTMENTS[id];
  if (!dept) return { title: "Департамент — Студрада ФІОТ" };
  return {
    title: `${dept.name} — Студрада ФІОТ`,
    description: dept.slogan?.replace(/\s*\n\s*/g, " ") ?? undefined,
  };
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = DEPARTMENTS[id];
  if (!d) notFound();

  const iconGrad = accentGradient[d.accent];
  const joinHref = `/join?dept=${encodeURIComponent(d.name)}`;

  return (
    <>
      <IconDefs />
      <Header />
      <main className="overflow-x-clip">
        <DepartmentTop d={d} />

        {!!d.subDepartments?.length && (
          <section className="relative isolate py-16 lg:py-24">
            <Glow
              color={d.glow[1]}
              className="right-0 top-1/3 h-[24rem] w-[34rem] translate-x-1/4"
            />
            <Container className="flex flex-col">
              <DepartmentSectionHeading
                title="Ролі у департаменті"
                gradient={d.gradient}
              />
              <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {d.subDepartments?.map((s) => (
                  <AccentCard
                    key={s.name}
                    accent={d.accent}
                    interactive
                    className="flex flex-col gap-3 p-7"
                  >
                    <h3 className="text-xl font-bold text-white">{s.name}</h3>
                    <p className="text-lg leading-relaxed text-stone-400">
                      {s.description}
                    </p>
                  </AccentCard>
                ))}
              </div>
            </Container>
          </section>
        )}

        {!!d.projects?.length && (
          <section className="relative isolate py-16 lg:py-24">
            <Container className="flex flex-col">
              <DepartmentSectionHeading
                title="Проєкти та результати"
                gradient={d.gradient}
              />
              <ProjectsGrid projects={d.projects} gradient={d.gradient} />
            </Container>
          </section>
        )}

        <Marquee href={joinHref} gradient={d.gradient} />

        {!!d.faq?.length && (
          <section className="relative isolate py-20 lg:py-28">
            <Container className="flex flex-col">
              <DepartmentSectionHeading
                title="Поширені запитання"
                gradient={d.gradient}
              />
              <FaqAccordion
                items={d.faq}
                gradient={d.gradient}
                gradId={`grad-${iconGrad}`}
                accent={d.accent}
              />
            </Container>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
