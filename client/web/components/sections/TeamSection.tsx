import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { TelegramIcon } from "@/components/ui/icons";

const MEMBERS = Array.from({ length: 9 }).map((_, i) => ({
  id: i,
  name: "Максим Коваль",
  role: "Голова",
  telegram: "@Maks_Koval",
}));

export function TeamSection() {
  return (
    <section id="team" className="relative isolate scroll-mt-28 py-20 lg:py-28">
      <Container>
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-10">
          {MEMBERS.map((member) => (
            <article
              key={member.id}
              className="flex w-72 max-w-full flex-col gap-3"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-brand-magenta bg-surface/40">
                <Glow
                  color="#9810FA"
                  className="absolute left-1/2 top-1/2 h-[50%] w-[300%] -translate-x-1/2
                  -translate-y-1/2 opacity-100 blur-2xl pointer-events-none -z-10"
                />
                <Image
                  src="/placeholder-person.png"
                  alt={member.name}
                  fill
                  sizes="288px"
                  className="object-contain object-bottom z-10"
                  style={{
                    filter: 'drop-shadow(3px 3px 0 #fff) drop-shadow(-3px -3px 0 #fff) drop-shadow(3px -3px 0 #fff) drop-shadow(-3px 3px 0 #fff)'
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold text-white">{member.name}</h3>
                <p className="text-xl text-stone-300">{member.role}</p>
                <div className="flex items-center gap-1.5 text-stone-300">
                  <span className="size-5 shrink-0">
                    <TelegramIcon />
                  </span>
                  <span className="text-xl">{member.telegram}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
