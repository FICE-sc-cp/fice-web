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
import { RichText } from "@/components/ui/RichText";
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
import { fice, safe, mediaUrl, type Department } from "@/lib/api";

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

function MemberCard({
  name,
  role,
  telegram,
  photo,
  quote,
  featured,
  accent,
  gradient,
}: {
  name: string;
  role: string;
  telegram: string | null;
  photo?: string | null;
  quote?: string | null;
  featured?: boolean;
  accent: Accent;
  gradient: string;
}) {
  const tg = telegram?.replace(/^@/, "");
  return (
    <article className="flex w-64 max-w-full flex-col gap-3">
      <div
        className={cn(
          "rounded-2xl",
          featured ? cn("p-px", gradient) : cn("border", accentBorder[accent]),
        )}
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface/40">
          {photo ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url("${photo}")` }}
            />
          ) : (
            <Image
              src="/placeholder-person.png"
              alt={name}
              fill
              sizes="256px"
              className="object-contain object-bottom"
              style={{ filter: PERSON_OUTLINE }}
            />
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-white">{name}</h3>
        <p
          className={cn(
            "text-base font-semibold",
            featured
              ? cn("bg-clip-text text-transparent", gradient)
              : accentText[accent],
          )}
        >
          {role}
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
        {quote && (
          <p className="mt-1 text-sm italic leading-snug text-stone-400">
            «{quote}»
          </p>
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
  const teamMembers: Member[] = d.team ?? [];
  const hasAbout = !!d.about?.length;
  const hasResp = !!d.responsibilities?.length;

  const dbDepartments = await safe(fice.departments(), [] as Department[]);
  const dbHead =
    dbDepartments.find((x) => x.name.trim() === d.name.trim())?.head ?? null;
  const head = dbHead
    ? {
        name: `${dbHead.firstName} ${dbHead.lastName}`.trim(),
        telegram: dbHead.telegramTag,
        photo: mediaUrl(dbHead.photo),
      }
    : null;
  const headTg = head?.telegram?.replace(/^@/, "");

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
                        <RichText text={p} linkClassName={accentText[d.accent]} />
                      </p>
                    ))}
                  </div>
                )}

                {hasResp && (
                  <AccentCard
                    accent={d.accent}
                    className="flex flex-col gap-5 self-start p-7 lg:sticky lg:top-28"
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

        {teamMembers.length > 0 ? (
          <section className="relative isolate py-16 lg:py-24">
            <Glow
              color={d.glow[0]}
              className="left-1/2 top-1/2 h-[24rem] w-[40rem] -translate-x-1/2 -translate-y-1/2"
            />
            <Container className="flex flex-col">
              <SectionHeading title="Команда" gradient={d.gradient} />
              <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-10">
                {head && (
                  <MemberCard
                    name={head.name}
                    role="Голова департаменту"
                    telegram={head.telegram}
                    photo={head.photo}
                    quote={d.headQuote}
                    featured
                    accent={d.accent}
                    gradient={d.gradient}
                  />
                )}
                {teamMembers.map((m, i) => (
                  <MemberCard
                    key={i}
                    name={m.name}
                    role={m.role}
                    telegram={m.telegram}
                    accent={d.accent}
                    gradient={d.gradient}
                  />
                ))}
              </div>
            </Container>
          </section>
        ) : head ? (
          <section className="relative isolate py-16 lg:py-24">
            <Glow
              color={d.glow[0]}
              className="left-1/2 top-1/2 h-[24rem] w-[40rem] -translate-x-1/2 -translate-y-1/2"
            />
            <Container>
              <div className={cn("overflow-hidden rounded-3xl p-px", d.gradient)}>
                <div className="grid grid-cols-1 overflow-hidden rounded-3xl bg-bg sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <div className="relative min-h-[22rem] bg-surface/40">
                    {head.photo ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url("${head.photo}")` }}
                      />
                    ) : (
                      <Image
                        src="/placeholder-person.png"
                        alt={head.name}
                        fill
                        sizes="(min-width: 640px) 40vw, 100vw"
                        className="object-contain object-bottom"
                        style={{ filter: PERSON_OUTLINE }}
                      />
                    )}
                  </div>
                  <div className="flex flex-col justify-center gap-4 p-8 text-center sm:p-10 sm:text-left">
                    <span
                      className={cn(
                        "self-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-black sm:self-start",
                        d.gradient,
                      )}
                    >
                      Голова департаменту
                    </span>
                    <h2 className="text-3xl font-bold sm:text-4xl">
                      {head.name}
                    </h2>
                    {d.headQuote && (
                      <p className="text-xl leading-relaxed text-muted">
                        «{d.headQuote}»
                      </p>
                    )}
                    {headTg && (
                      <a
                        href={`https://t.me/${headTg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mx-auto inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 font-semibold text-stone-200 transition-colors hover:border-brand-cyan hover:text-brand-cyan sm:mx-0 sm:self-start"
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
        ) : null}

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
