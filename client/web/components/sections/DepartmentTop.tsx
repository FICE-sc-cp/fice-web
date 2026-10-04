import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { ProjectPeopleWall } from "@/components/sections/ProjectPeopleWall";
import { RichText } from "@/components/ui/RichText";
import {
  FocusedPhoto,
  photoFocus,
  type PhotoFocus,
} from "@/components/ui/FocusedPhoto";
import {
  AccentCard,
  accentBorder,
  accentText,
  accentGradient,
  type Accent,
} from "@/components/ui/AccentCard";
import { TelegramIcon, PeopleIcon, CheckDoneIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { DepartmentData, Member } from "@/lib/departments";
import {
  fice,
  safe,
  mediaUrl,
  type Department,
  type DepartmentMember,
  type ProjectParticipant,
} from "@/lib/api";
import { presidiumMembers, presidiumTitle } from "@/lib/presidium";

const PERSON_OUTLINE =
  "drop-shadow(3px 3px 0 #fff) drop-shadow(-3px -3px 0 #fff) drop-shadow(3px -3px 0 #fff) drop-shadow(-3px 3px 0 #fff)";

const PRESIDIUM_TOP_ROW = new Set(["HEAD", "FIRST_DEPUTY", "SECRETARY"]);

async function presidiumTeam(): Promise<{ top: Member[]; rest: Member[] }> {
  const members = presidiumMembers(
    await safe(fice.members(), [] as DepartmentMember[]),
  );
  const leadId = members.find((m) => m.role === "HEAD")?.id;
  const toMember = (m: DepartmentMember): Member => ({
    name: `${m.firstName} ${m.lastName}`.trim(),
    role: presidiumTitle(m),
    telegram: m.telegramTag,
    description: m.description,
    photo: mediaUrl(m.photo),
    focus: photoFocus(m),
    lead: m.id === leadId,
  });
  return {
    top: members.filter((m) => PRESIDIUM_TOP_ROW.has(m.role)).map(toMember),
    rest: members.filter((m) => !PRESIDIUM_TOP_ROW.has(m.role)).map(toMember),
  };
}

function MemberCard({
  name,
  role,
  telegram,
  photo,
  focus,
  quote,
  description,
  featured,
  accent,
  gradient,
  className,
}: {
  name: string;
  role: string;
  telegram: string | null;
  photo?: string | null;
  focus?: PhotoFocus;
  quote?: string | null;
  description?: string | null;
  featured?: boolean;
  accent: Accent;
  gradient: string;
  className?: string;
}) {
  const tg = telegram?.replace(/^@/, "");
  return (
    <article
      className={cn(
        "flex max-w-full flex-col gap-2.5",
        description ? "w-72" : "w-64",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-2xl",
          featured ? cn("p-px", gradient) : cn("border", accentBorder[accent]),
        )}
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface/40">
          {photo ? (
            <FocusedPhoto src={photo} alt={name} focus={focus} />
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
        <h3 className="text-base font-bold text-white sm:text-lg">{name}</h3>
        <p
          className={cn(
            "text-xs sm:text-sm font-semibold",
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
            <span className="size-3.5 shrink-0">
              <TelegramIcon />
            </span>
            <span className="text-xs sm:text-sm">@{tg}</span>
          </a>
        )}
        {quote && (
          <p className="mt-1 text-xs italic leading-snug text-stone-400">
            «{quote}»
          </p>
        )}
        {description && (
          <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-stone-400">
            {description}
          </p>
        )}
      </div>
    </article>
  );
}

export function DepartmentSectionHeading({
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

export async function DepartmentTop({ d }: { d: DepartmentData }) {
  const iconGrad = accentGradient[d.accent];
  const joinHref = `/join?dept=${encodeURIComponent(d.slug)}`;
  const presidium =
    d.slug === "presidium" ? await presidiumTeam() : { top: [], rest: [] };
  const teamMembers: Member[] =
    d.slug === "presidium"
      ? [...presidium.top, ...presidium.rest]
      : (d.team ?? []);
  const teamLead = teamMembers.find((m) => m.lead) ?? null;
  const teamRest = teamMembers.filter((m) => !m.lead);
  const hasAbout = !!d.about?.length;
  const hasResp = !!d.responsibilities?.length;
  const hasCover = !!d.cover;

  const dbDepartments = await safe(fice.departments(), [] as Department[]);
  const dbDept = dbDepartments.find((x) => x.slug === d.slug);
  const dbHead = dbDept?.head ?? null;
  const memberCount =
    dbDept?.memberCount ??
    (d.slug === "presidium" && teamMembers.length > 0
      ? teamMembers.length
      : d.memberCount);
  const projectPeople = dbDept
    ? await safe(
        fice.projectParticipants(dbDept.id),
        [] as ProjectParticipant[],
      )
    : [];
  const head = dbHead
    ? {
        name: `${dbHead.firstName} ${dbHead.lastName}`.trim(),
        telegram: dbHead.telegramTag,
        photo: mediaUrl(dbHead.photo),
        focus: photoFocus(dbHead),
      }
    : null;
  const headTg = head?.telegram?.replace(/^@/, "");

  return (
    <>
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
          <div
            className={cn(
              "grid grid-cols-1 items-center gap-10",
              hasCover && "lg:grid-cols-2 lg:gap-14",
            )}
          >
            <div
              className={cn(
                "flex flex-col items-center gap-5 text-center",
                hasCover ? "lg:items-start lg:text-left" : "mx-auto max-w-3xl",
              )}
            >
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
                <p className="max-w-xl whitespace-pre-line text-xl text-muted sm:text-2xl">
                  {d.slogan}
                </p>
              )}
              <div
                className={cn(
                  "mt-1 flex flex-wrap items-center justify-center gap-3",
                  hasCover && "lg:justify-start",
                )}
              >
                {d.memberCount != null && (
                  <span className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-surface/50 px-4 text-base font-semibold text-fg">
                    <span className="size-5">
                      <PeopleIcon gradient={iconGrad} />
                    </span>
                    {memberCount} учасників
                  </span>
                )}
                <Link
                  href={joinHref}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full px-6 text-base font-bold text-black transition-transform hover:scale-[1.03] active:scale-95",
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

      {projectPeople.length > 0 && (
        <ProjectPeopleWall
          title={d.heartTitle ?? d.name}
          people={projectPeople}
          glow={d.glow}
        />
      )}

      {teamMembers.length > 0 ? (
        <section className="relative isolate py-16 lg:py-24">
          <Glow
            color={d.glow[0]}
            className="left-1/2 top-1/2 h-[24rem] w-[40rem] -translate-x-1/2 -translate-y-1/2"
          />
          <Container className="flex flex-col">
            <DepartmentSectionHeading
              title={d.teamTitle ?? "Команда"}
              gradient={d.gradient}
            />
            {d.slug === "presidium" ? (
              <div className="mt-12 flex flex-col gap-8 lg:gap-10">
                {/* Рядок 1: Голова СР, перший зам, секретар */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto w-full justify-items-center">
                  {presidium.top.map((m, i) => (
                    <MemberCard
                      key={m.name}
                      name={m.name}
                      role={m.role}
                      telegram={m.telegram}
                      photo={m.photo}
                      focus={m.focus}
                      description={m.description}
                      featured={m.lead}
                      accent={d.accent}
                      gradient={d.gradient}
                      className={cn(
                        "w-full max-w-[270px]",
                        i === 2 && "sm:col-span-2 sm:max-w-[270px] lg:col-span-1",
                      )}
                    />
                  ))}
                </div>

                {/* Рядок 2: заступники */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 max-w-6xl mx-auto w-full justify-items-center">
                  {presidium.rest.map((m) => (
                    <MemberCard
                      key={m.name}
                      name={m.name}
                      role={m.role}
                      telegram={m.telegram}
                      photo={m.photo}
                      focus={m.focus}
                      description={m.description}
                      accent={d.accent}
                      gradient={d.gradient}
                      className="w-full max-w-[270px]"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {(teamLead || head) && (
                  <div className="mt-12 flex justify-center">
                    {teamLead ? (
                      <MemberCard
                        name={teamLead.name}
                        role={teamLead.role}
                        telegram={teamLead.telegram}
                        photo={teamLead.photo}
                        focus={teamLead.focus}
                        description={teamLead.description}
                        featured
                        accent={d.accent}
                        gradient={d.gradient}
                      />
                    ) : (
                      head && (
                        <MemberCard
                          name={head.name}
                          role="Голова департаменту"
                          telegram={head.telegram}
                          photo={head.photo}
                          focus={head.focus}
                          quote={d.headQuote}
                          featured
                          accent={d.accent}
                          gradient={d.gradient}
                        />
                      )
                    )}
                  </div>
                )}
                <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-10">
                  {teamRest.map((m, i) => (
                    <MemberCard
                      key={i}
                      name={m.name}
                      role={m.role}
                      telegram={m.telegram}
                      photo={m.photo}
                      focus={m.focus}
                      description={m.description}
                      accent={d.accent}
                      gradient={d.gradient}
                    />
                  ))}
                </div>
              </>
            )}
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
                <div className="relative min-h-[22rem] overflow-hidden bg-surface/40">
                  {head.photo ? (
                    <FocusedPhoto
                      src={head.photo}
                      alt={head.name}
                      focus={head.focus}
                      sizes="(min-width: 640px) 32rem, 100vw"
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
    </>
  );
}
