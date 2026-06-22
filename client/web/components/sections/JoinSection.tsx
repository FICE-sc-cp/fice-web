// this component is not used, I keeped it here just in case

import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { SunglassesIcon } from "@/components/ui/icons";

const COLUMNS: { title: string; text: string }[][] = [
  [
    {
      title: "Розвиток навичок",
      text: "Організаторські, лідерські та комунікативні навички",
    },
    {
      title: "Реальний вплив",
      text: "Беріть участь у важливих рішеннях та ініціативах",
    },
  ],
  [
    {
      title: "Нова знайомства",
      text: "Розширюйте коло спілкування з активними студентами",
    },
    { title: "Цікаві проєкти", text: "Реалізуйте свої ідеї та креативність" },
  ],
];

export function JoinSection() {
  return (
    <section
      id="join-cta"
      className="relative isolate scroll-mt-28 py-20 lg:py-28"
    >
      <Glow
        color="#AD46FF"
        className="left-1/2 top-[18%] h-[20rem] w-[35rem] -translate-x-1/2 -translate-y-1/3 -ml-[32rem] rotate-30"
      />
      <Glow
        color="#3BCA5B"
        className="left-1/2 top-[62%] h-[22rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 ml-[32rem] -rotate-45"
      />

      <Container>
        <div className="flex flex-col items-center gap-16">
          <h2 className="text-center text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Приєднатись до команди
          </h2>

          <div className="flex w-full flex-col items-center gap-16 rounded-lg border border-white/5 bg-zinc-800/20 p-8 lg:p-16">
            <h3 className="text-center text-3xl font-bold lg:text-4xl">
              Чому варто приєднатися?
            </h3>

            <div className="flex w-full flex-col gap-16 lg:flex-row">
              {COLUMNS.map((column, c) => (
                <div key={c} className="flex flex-1 flex-col gap-16">
                  {column.map((benefit) => (
                    <div key={benefit.title} className="flex items-start gap-4">
                      <span className="inline-flex shrink-0 rounded-xl bg-gradient-green p-2.5 text-white">
                        <span className="block h-9 w-10">
                          <SunglassesIcon />
                        </span>
                      </span>
                      <div className="flex flex-col gap-4">
                        <span className="text-xl font-bold leading-6 text-white">
                          {benefit.title}
                        </span>
                        <span className="text-3xl font-medium leading-9 text-white">
                          {benefit.text}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <a
              href="#join"
              className="w-full rounded-lg bg-gradient-main px-12 py-6 text-center text-3xl font-bold text-black transition-opacity hover:opacity-90"
            >
              Приєднатись
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
