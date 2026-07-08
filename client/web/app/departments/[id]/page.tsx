import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { Marquee } from "@/components/sections/Marquee";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { ProjectsGrid } from "@/components/sections/ProjectsGrid";
import {
  AccentCard,
  accentBorder,
  accentText,
  accentGradient,
  type Accent,
} from "@/components/ui/AccentCard";
import {
  IconDefs,
  TelegramIcon,
  PeopleIcon,
  CheckDoneIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, departmentSlugs, type Member } from "@/lib/departments";

const PERSON_OUTLINE =
  "drop-shadow(3px 3px 0 #fff) drop-shadow(-3px -3px 0 #fff) drop-shadow(3px -3px 0 #fff) drop-shadow(-3px 3px 0 #fff)";

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
    description: dept.slogan ?? undefined,
  };
}

function MemberCard({ member, accent }: { member: Member; accent: Accent }) {
  const tg = member.telegram?.replace(/^@/, "");
  return (
    <article className="flex w-64 max-w-full flex-col gap-3">
      <div
        className={cn(
          "relative aspect-[3/4] overflow-hidden rounded-2xl border bg-surface/40",
          accentBorder[accent],
        )}
      >
        <Image
          src="/placeholder-person.png"
          alt={member.name}
          fill
          sizes="256px"
          className="object-contain object-bottom"
          style={{ filter: PERSON_OUTLINE }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-white">{member.name}</h3>
        <p className={cn("text-base font-semibold", accentText[accent])}>
          {member.role}
        </p>
        {tg && (
          <a
            href={`https://t.me/${tg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 flex items-center gap-1.5 text-stone-300 transition-colors hover:text-brand-cyan"
          >
            <span className="size-4 shrink-0">
              <TelegramIcon />
            </span>
            <span className="text-sm">@{tg}</span>
          </a>
        )}
      </div>
    </article>
  );
}

function SectionHeading({
  title,
  gradient,
}: {
  title: string;
  gradient: string;
}) {
  return (
    <div className="inline-flex flex-col items-center gap-3 self-center text-center">
      <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
      <span className={cn("h-1.5 w-full rounded-full", gradient)} />
    </div>
  );
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
  const headTg = d.head?.telegram?.replace(/^@/, "");
  const headMember: Member | null = d.head
    ? {
        name: d.head.name,
        role: "Голова департаменту",
        telegram: d.head.telegram,
      }
    : null;
  const teamMembers: Member[] = [
    ...(headMember ? [headMember] : []),
    ...(d.team ?? []),
  ];
  const hasAbout = !!d.about?.length;
  const hasResp = !!d.responsibilities?.length;

  return (
    <>
      <IconDefs />
      <Header />
      <main className="overflow-x-clip">
        <section className="relative isolate pb-10 pt-20 lg:pt-28">
          <Glow
            color={d.glow[0]}
            className="left-0 top-10 h-[26rem] w-[36rem] -translate-x-1/4"
          />
          <Glow
            color={d.glow[1]}
            className="right-0 top-24 h-[28rem] w-[36rem] translate-x-1/4"
          />
          <Container>
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
                <Link
                  href="/#departments"
                  className="inline-flex items-center gap-1 text-lg font-semibold text-subtle transition-colors hover:text-fg"
                >
                  ← Усі департаменти
                </Link>
                <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                  <span
                    className={cn("bg-clip-text text-transparent", d.gradient)}
                  >
                    {d.name}
                  </span>
                </h1>
                {d.slogan && (
                  <p className="max-w-xl text-xl text-muted sm:text-2xl">
                    {d.slogan}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  {d.memberCount != null && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-surface/50 px-4 py-2 text-base font-semibold text-fg">
                      <span className="size-5">
                        <PeopleIcon gradient={iconGrad} />
                      </span>
                      {d.memberCount} учасників
                    </span>
                  )}
                  <Link
                    href={joinHref}
                    className={cn(
                      "rounded-full px-6 py-2.5 text-base font-bold text-black transition-transform hover:scale-[1.03] active:scale-95",
                      d.gradient,
                    )}
                  >
                    Долучитися
                  </Link>
                </div>
              </div>

              {d.cover && (
                <div className="relative w-full overflow-hidden rounded-3xl border border-white/10">
                  <Image
                    src={d.cover}
                    alt={`Команда «${d.name}»`}
                    width={0}
                    height={0}
                    sizes="(min-width: 1024px) 32rem, 100vw"
                    className="h-auto w-full"
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay",
                      d.gradient,
                    )}
                  />
                </div>
              )}
            </div>
          </Container>
        </section>

        {(hasAbout || hasResp) && (
          <section className="relative isolate py-16 lg:py-24">
            <Container>
              <div
                className={cn(
                  "grid grid-cols-1 gap-12 lg:gap-16",
                  hasAbout && hasResp && "lg:grid-cols-[1.4fr_1fr]",
                )}
              >
                {hasAbout && (
                  <div className="flex flex-col gap-6">
                    <div className="inline-flex w-fit flex-col gap-3">
                      <h2 className="text-3xl font-bold sm:text-4xl">
                        Чим ми займаємось
                      </h2>
                      <span
                        className={cn("h-1.5 w-full rounded-full", d.gradient)}
                      />
                    </div>
                    {d.about?.map((p, i) => (
                      <p key={i} className="text-xl leading-relaxed text-muted">
                        {p}
                      </p>
                    ))}
                  </div>
                )}

                {hasResp && (
                  <AccentCard
                    accent={d.accent}
                    className="flex flex-col gap-5 p-7"
                  >
                    <h3 className="text-2xl font-bold text-white">
                      Сфери відповідальності
                    </h3>
                    <ul className="flex flex-col gap-4">
                      {d.responsibilities?.map((r, i) =>
                        typeof r === "string" ? (
                          <li key={i} className="flex items-start gap-3">
                            <span className="mt-0.5 size-7 shrink-0">
                              <CheckDoneIcon gradient={iconGrad} />
                            </span>
                            <span className="text-xl leading-snug text-stone-300">
                              {r}
                            </span>
                          </li>
                        ) : (
                          <li key={i} className="flex flex-col gap-2">
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 size-7 shrink-0">
                                <CheckDoneIcon gradient={iconGrad} />
                              </span>
                              <span className="text-xl font-semibold leading-snug text-white">
                                {r.text}
                              </span>
                            </div>
                            <ul className="ml-10 flex flex-col gap-2.5">
                              {r.items.map((sub, j) => (
                                <li key={j} className="flex items-start gap-3">
                                  <span
                                    className={cn(
                                      "mt-2.5 size-2 shrink-0 rounded-full",
                                      d.gradient,
                                    )}
                                  />
                                  <span className="text-lg leading-snug text-stone-400">
                                    {sub}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ),
                      )}
                    </ul>
                  </AccentCard>
                )}
              </div>
            </Container>
          </section>
        )}

        {d.head && (
          <section className="relative isolate py-16 lg:py-24">
            <Glow
              color={d.glow[0]}
              className="left-1/2 top-1/2 h-[24rem] w-[40rem] -translate-x-1/2 -translate-y-1/2"
            />
            <Container>
              <div className={cn("rounded-3xl p-px", d.gradient)}>
                <div className="grid grid-cols-1 gap-8 rounded-3xl bg-bg p-6 sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
                  <div className="relative mx-auto aspect-[3/4] w-56 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-surface/40">
                    <Image
                      src="/placeholder-person.png"
                      alt={d.head.name}
                      fill
                      sizes="224px"
                      className="object-contain object-bottom"
                      style={{ filter: PERSON_OUTLINE }}
                    />
                  </div>
                  <div className="flex flex-col gap-4 text-center md:text-left">
                    <span
                      className={cn(
                        "self-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-black md:self-start",
                        d.gradient,
                      )}
                    >
                      Голова департаменту
                    </span>
                    <h2 className="text-3xl font-bold sm:text-4xl">
                      {d.head.name}
                    </h2>
                    <p className="text-xl leading-relaxed text-muted">
                      «{d.head.quote}»
                    </p>
                    {headTg && (
                      <a
                        href={`https://t.me/${headTg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mx-auto inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 font-semibold text-stone-200 transition-colors hover:border-brand-cyan hover:text-brand-cyan md:mx-0 md:self-start"
                      >
                        <span className="size-5">
                          <TelegramIcon />
                        </span>
                        @{headTg}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Container>
          </section>
        )}

        {teamMembers.length > 0 && (
          <section className="relative isolate py-16 lg:py-24">
            <Container className="flex flex-col">
              <SectionHeading title="Команда" gradient={d.gradient} />
              <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-10">
                {teamMembers.map((m, i) => (
                  <MemberCard key={i} member={m} accent={d.accent} />
                ))}
              </div>
            </Container>
          </section>
        )}

        {!!d.subDepartments?.length && (
          <section className="relative isolate py-16 lg:py-24">
            <Glow
              color={d.glow[1]}
              className="right-0 top-1/3 h-[24rem] w-[34rem] translate-x-1/4"
            />
            <Container className="flex flex-col">
              <SectionHeading title="Підрозділи" gradient={d.gradient} />
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
              <SectionHeading
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
              <SectionHeading
                title="Поширені запитання"
                gradient={d.gradient}
              />
              <FaqAccordion
                items={d.faq}
                gradient={d.gradient}
                gradId={`grad-${iconGrad}`}
              />
            </Container>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
