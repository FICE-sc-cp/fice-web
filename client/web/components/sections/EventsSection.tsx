import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Glow } from "@/components/ui/Glow";
import { CalendarIcon, ClockIcon, PinIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const EVENTS = [
  {
    category: "Розваги",
    badge: "from-brand-green/40 to-brand-teal/40",
    open: true,
  },
  {
    category: "Освіта",
    badge: "from-brand-orange/40 to-brand-red/40",
    open: false,
  },
  {
    category: "Культура",
    badge: "from-brand-cyan/40 to-brand-blue/40",
    open: false,
  },
];

const DETAILS = [
  { Icon: CalendarIcon, text: "14 лютого", Icon2: ClockIcon, text2: "17:00" },
  { Icon: PinIcon, text: "Ливарка КПІ" },
];

export function EventsSection() {
  return (
    <section
      id="events"
      className="relative isolate scroll-mt-28 py-20 lg:py-28"
    >
      <Glow
        color="#00E3F3"
        className="bottom-0 left-1/2 h-[20rem] w-[36rem] -translate-x-full -translate-y-1/4 rotate-30"
      />
      <Container>
        <SectionHeader
          title="Заходи"
          subtitle="Приєднуйся до найцікавіших подій факультету"
          gradient="bg-gradient-green"
        />

        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {EVENTS.map((event, i) => (
            <article
              key={i}
              className="flex flex-col gap-6 rounded-lg border border-border p-6"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-stone-300">
                <Image
                  src="/placeholder-for-fundraisers-and-events.png"
                  alt={event.category}
                  fill
                  sizes="(min-width: 1024px) 24rem, 100vw"
                  className="object-cover"
                />
                <span
                  className={cn(
                    "absolute right-4 top-4 rounded-lg bg-gradient-to-r px-5 py-2.5 text-lg font-bold text-black",
                    event.badge,
                  )}
                >
                  {event.category}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <h3 className="text-xl font-bold text-white">
                    День святого Валентина
                  </h3>
                  <div className="flex flex-col gap-2 text-xl text-stone-300">
                    {DETAILS.map(({ Icon, text, Icon2, text2 }) => (
                      <div key={text} className="flex items-center gap-2">
                        <span className="size-6 shrink-0">
                          <Icon />
                        </span>
                        {text}
                        {Icon2 && text2 ? (
                          <>
                            <span className="size-6 shrink-0">
                              <Icon2 />
                            </span>
                            {text2}
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                {event.open ? (
                  <a
                    href="#"
                    className="rounded-lg bg-gradient-green px-7 py-3.5 text-center text-xl font-bold text-black transition-opacity hover:opacity-90"
                  >
                    Дізнатись більше
                  </a>
                ) : (
                  <span className="rounded-lg bg-neutral-600 px-7 py-3.5 text-center text-xl font-bold text-zinc-800">
                    {/* Напевно потрібно змінити колір кнопки */}
                    Переглянути фотографії
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <button
            type="button"
            className="rounded-2xl bg-neutral-600/40 px-16 py-5 text-2xl font-bold text-white transition-colors hover:bg-neutral-600/60 lg:text-3xl"
          >
            Переглянути всі
          </button>
        </div>
      </Container>
    </section>
  );
}
