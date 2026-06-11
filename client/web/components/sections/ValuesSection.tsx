import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Glow } from "@/components/ui/Glow";
import {
  AccentCard,
  accentGradient,
  type Accent,
} from "@/components/ui/AccentCard";
import {
  PeopleIcon,
  JarIcon,
  CheckDoneIcon,
  MoneyBagIcon,
  type IconComponent,
} from "@/components/ui/icons";

const VALUES: { title: string; accent: Accent; Icon: IconComponent }[] = [
  { title: "Якісна освіта", accent: "cyan", Icon: PeopleIcon },
  { title: "Прозорість", accent: "green", Icon: JarIcon },
  { title: "Екологічність", accent: "orange", Icon: CheckDoneIcon },
  { title: "Свобода", accent: "magenta", Icon: MoneyBagIcon },
];

export function ValuesSection() {
  return (
    <section
      id="values"
      className="relative isolate scroll-mt-28 py-20 lg:py-28"
    >
      <Glow
        color="#FF791B"
        className="left-1/2 top-[6%] h-[22.97094rem] w-[52.03669rem] -translate-x-1/2 -translate-y-1/2 -ml-[12rem] rotate-[29.245deg] opacity-60"
      />

      <Container>
        <SectionTitle gradient="bg-gradient-orange">Наші цінності</SectionTitle>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {VALUES.map(({ title, accent, Icon }) => (
            <AccentCard
              key={title}
              accent={accent}
              className="flex flex-col items-start gap-6 px-6 py-12"
            >
              <span className="size-14">
                <Icon gradient={accentGradient[accent]} />
              </span>
              <h3 className="text-3xl font-bold leading-tight break-words">
                {title}
              </h3>
            </AccentCard>
          ))}
        </div>
      </Container>
    </section>
  );
}
