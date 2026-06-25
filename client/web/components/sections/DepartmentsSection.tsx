import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Glow } from "@/components/ui/Glow";
import {
  AccentCard,
  //accentText,
  type Accent,
} from "@/components/ui/AccentCard";
import { Reveal, RevealGroup } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

const DEPARTMENTS: {
  name: string;
  accent: Accent;
  description: string;
  wide?: boolean;
}[] = [
  {
    name: "Президія",
    accent: "magenta",
    description:
      "Керівництво студрадою, формування стратегії та координування ключових процесів. Робота спрямована на забезпечення стабільної та ефективної діяльності організації.",
  },
  {
    name: "Секретаріат",
    accent: "magenta",
    description:
      "Організовує комунікацію, документи та внутрішні процеси. Відповідає за порядок та облік важливої інформації.",
  },
  {
    name: "Проєктний департамент",
    accent: "cyan",
    description:
      "Департамент реалізує події та ініціативи для студентів факультету. Створюємо події та можливості, що розвивають студспільноту. Робота з партнерами, планування активностей та формування команд.",
  },
  {
    name: "Департамент медіа",
    accent: "cyan",
    description:
      "Команда працює над контентом студради: фото, відео, дизайн, соцмережі. Ми забезпечуємо актуальну комунікацію, висвітлюємо життя факультету.",
  },
  {
    name: "Департамент партнерств",
    accent: "green",
    description:
      "Співпраця з компаніями та організаціями, пошук можливостей для студентів. Працюємо над проєктами та підтримкою благодійних ініціатив та розширюємо можливості для студспільноти.",
  },
  {
    name: "Департамент мерчу",
    accent: "orange",
    description:
      "Команда розробляє дизайн, створює нові продукти. Працюємо над якістю, стилем і впізнаваністю бренду ФІОТ.",
  },
  {
    name: "Департамент якості освіти",
    accent: "green",
    description:
      "Аналізує освітній процес, збирає фідбек і допомагає вирішувати академічні питання.",
  },
  {
    name: "Департамент по роботі з абітурієнтами",
    accent: "orange",
    description:
      "Проводить заходи для майбутніх студентів, консультує та відповідає на запитання. Займається інформаційною підтримкою вступної кампанії.",
    wide: true,
  },
];

export function DepartmentsSection() {
  return (
    <section
      id="departments"
      className="relative isolate scroll-mt-28 py-20 lg:py-28"
    >
      <Glow
        color="#AD46FF"
        className="left-1/2 top-2/5 h-[25rem] w-[30rem] -translate-x-1/5 -translate-y-1/2 -ml-[18rem]"
      />
      <Glow
        color="#AD46FF"
        className="left-1/2 top-2/3 h-[25rem] w-[30rem] -translate-x-full -translate-y-1/5 -ml-[18rem]"
      />

      <Container>
        <Reveal>
          <SectionHeader
            title="Структура та департаменти"
            subtitle="Кожен відділ — це команда однодумців"
            gradient="bg-gradient-green"
          />
        </Reveal>

        <RevealGroup className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((dept) => (
            <AccentCard
              key={dept.name}
              accent={dept.accent}
              interactive
              className={cn(
                "flex flex-col gap-4 px-6 py-8",
                dept.wide && "lg:col-span-2",
              )}
            >
              <h3 className="text-2xl font-bold text-white">{dept.name}</h3>
              {/*<p className={cn("text-xl font-bold", accentText[dept.accent])}>
                Голова — @user_name
              </p>*/}
              <p className="flex-1 text-xl font-medium leading-6 text-zinc-400">
                {dept.description}
              </p>
              <a
                href="#"
                className="group/link inline-flex items-center gap-1 text-xl font-black text-gray-200 transition-opacity hover:opacity-70"
              >
                Читати більше{" "}
                <span className="transition-transform duration-300 group-hover/link:translate-x-1">
                  →
                </span>
              </a>
            </AccentCard>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
