import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { TelegramIcon } from "@/components/ui/icons";
import {
  fice,
  mediaUrl,
  safe,
  type Department,
  type DepartmentMember,
  type DepartmentMemberRole,
} from "@/lib/api";

interface TeamCard {
  id: string;
  name: string;
  role: string;
  detail: string | null;
  telegram: string | null;
  photo: string | null;
}

const ROLE_LABEL: Record<DepartmentMemberRole, string> = {
  HEAD: "Голова студради",
  FIRST_DEPUTY: "Перший заступник",
  SECRETARY: "Секретар",
  DEPUTY: "Заступник",
  HR: "HR",
  MEMBER: "Учасник",
};

const PRESIDIUM: DepartmentMemberRole[] = [
  "HEAD",
  "FIRST_DEPUTY",
  "SECRETARY",
  "DEPUTY",
  "HR",
];

function memberCard(m: DepartmentMember): TeamCard {
  return {
    id: m.id,
    name: `${m.firstName} ${m.lastName}`.trim(),
    role: ROLE_LABEL[m.role] ?? m.role,
    detail: m.specialization,
    telegram: m.telegramTag,
    photo: m.photo,
  };
}

function headCard(d: Department): TeamCard | null {
  if (!d.head) return null;
  return {
    id: d.head.id,
    name: `${d.head.firstName} ${d.head.lastName}`.trim(),
    role: `Голова департаменту «${d.name}»`,
    detail: null,
    telegram: d.head.telegramTag,
    photo: d.head.photo,
  };
}

function byRole(
  members: DepartmentMember[],
  roles: DepartmentMemberRole[],
): TeamCard[] {
  return roles.flatMap((role) =>
    members.filter((m) => m.role === role).map(memberCard),
  );
}

export async function TeamSection() {
  const [members, departments] = await Promise.all([
    safe(fice.members(), [] as DepartmentMember[]),
    safe(fice.departments(), [] as Department[]),
  ]);

  const groups = [
    { title: "Президія", cards: byRole(members, PRESIDIUM) },
    {
      title: "Голови департаментів",
      cards: departments.map(headCard).filter((c): c is TeamCard => c !== null),
    },
  ].filter((g) => g.cards.length > 0);

  return (
    <section id="team" className="relative isolate scroll-mt-28 py-20 lg:py-28">
      <Container className="flex flex-col gap-16">
        {groups.length === 0 ? (
          <p className="text-center text-lg text-muted">
            Скоро познайомимо тебе з командою 👀
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-8">
              <div className="inline-flex flex-col items-center gap-3 self-center text-center">
                <h2 className="text-2xl font-bold sm:text-3xl">{g.title}</h2>
                <span className="h-1.5 w-full rounded-full bg-gradient-main" />
              </div>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-10">
                {g.cards.map((c) => (
                  <TeamCardView key={c.id} card={c} />
                ))}
              </div>
            </div>
          ))
        )}

        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg text-muted">
            Хочеш долучитись до нашої команди?
          </p>
          <a
            href="/join"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-main px-10 py-4 text-lg font-bold text-black transition-opacity hover:opacity-90"
          >
            Долучайся до команди
          </a>
        </div>
      </Container>
    </section>
  );
}

function TeamCardView({ card }: { card: TeamCard }) {
  const photo = mediaUrl(card.photo);
  const tg = card.telegram?.replace(/^@/, "");
  return (
    <article className="flex w-72 max-w-full flex-col gap-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-brand-magenta bg-surface/40">
        <Glow
          color="#9810FA"
          className="absolute left-1/2 top-1/2 h-[50%] w-[300%] -translate-x-1/2 -translate-y-1/2 opacity-100 blur-2xl pointer-events-none -z-10"
        />
        {photo ? (
          <div
            className="absolute inset-0 z-10 bg-cover bg-center"
            style={{ backgroundImage: `url("${photo}")` }}
          />
        ) : (
          <Image
            src="/placeholder-person.png"
            alt={card.name}
            fill
            sizes="288px"
            className="z-10 object-contain object-bottom"
            style={{
              filter:
                "drop-shadow(3px 3px 0 #fff) drop-shadow(-3px -3px 0 #fff) drop-shadow(3px -3px 0 #fff) drop-shadow(-3px 3px 0 #fff)",
            }}
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xl font-bold text-white">{card.name}</h3>
        <div className="text-lg font-semibold text-brand-magenta">
          {card.role}
          {card.detail && ` | ${card.detail}`}
        </div>
        {tg && (
          <a
            href={`https://t.me/${tg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 flex items-center gap-1.5 text-stone-300 transition-colors hover:text-brand-cyan"
          >
            <span className="size-5 shrink-0">
              <TelegramIcon />
            </span>
            <span className="text-base">@{tg}</span>
          </a>
        )}
      </div>
    </article>
  );
}
