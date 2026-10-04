"use client";

import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal, RevealGroup } from "@/components/ui/Reveal";
import { ChevronIcon } from "@/components/ui/icons";
import { RichText } from "@/components/ui/RichText";
import { accentText } from "@/components/ui/AccentCard";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    question: "Що я отримаю від участі в студентській раді ФІОТ?",
    answer:
      "Практичний досвід у напрямі, який обереш, прокачані командні, організаційні та комунікативні навички, а ще — нові знайомства й однодумців. Що саме дає кожен департамент, читай на його сторінці.",
  },
  {
    question: "Скільки часу і залученості від мене вимагає участь в студраді?",
    answer:
      "Навантаження залежить від департаменту та від того, скільки завдань ти береш на себе. Департаменти намагаються розподіляти роботу так, щоб участь у студраді комфортно поєднувалася з навчанням. Детальніше про навантаження — у запитаннях на сторінці кожного департаменту.",
  },
  {
    question: "Чи можу я прийти в студраду без конкретних навичок?",
    answer:
      "Так, досвід не обовʼязковий: головне — бажання розвиватися й працювати в команді, а всього необхідного ти навчишся в процесі. У деяких департаментах після анкети є тестове завдання — про нього розповідаємо на сторінках департаментів.",
  },
  {
    question:
      "Чи можу я бути одразу в декількох департаментах і працювати над декількома проєктами?",
    answer:
      "Так. В [анкеті вступу](/join) можна обрати до двох департаментів, а всередині департаменту — пробувати кілька напрямів одночасно. Зважай лише на те, щоб навантаження комфортно поєднувалося з навчанням.",
  },
  {
    question:
      "Скільки додаткових балів дають за активну участь у роботі департаменту?",
    answer:
      "За активну участь у департаменті ти можеш отримати до 20 додаткових балів від Студради.",
  },
  {
    question: "Чи зможу я втілювати свої ідеї і керувати командою?",
    answer:
      "Ми будемо раді допомогти, якщо ти маєш власну ідею або думки щодо розширення нашої сфери діяльності. Департамент стане твоєю опорою: разом продумаємо концепт, знайдемо людей в команду та реалізуємо задум. Також протягом своєї роботи в департаменті ти можеш стати відповідальним за напрямок, заступником або навіть головою департаменту і координувати роботу команди.",
  },
  {
    question:
      "Викладач не дотримується вимог силабусу. Що робити і куди мені звертатись?",
    answer:
      "Оцінювання дисципліни визначається силабусом і рейтинговою системою оцінювання (РСО). Якщо викладач змінює критерії чи висуває вимоги, які їм суперечать, напиши в бот Студради [@fice_robot](https://t.me/fice_robot). Департамент якості освіти розглядає кожне звернення, за потреби — анонімно, і допоможе врегулювати питання в межах правил університету. Більше відповідей — на [сторінці департаменту](/departments/education).",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (index: number) =>
    setOpen((prev) => (prev === index ? null : index));

  return (
    <section id="faq" className="scroll-mt-28 py-20 lg:py-28">
      <Container>
        <Reveal>
          <SectionHeader
            title="Поширені запитання"
            subtitle="Відповіді на найчастіші питання студентів"
            gradient="bg-gradient-magenta"
          />
        </Reveal>

        <RevealGroup className="mx-auto mt-14 flex max-w-5xl flex-col gap-4">
          {FAQS.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div
                key={index}
                className={cn(
                  "rounded-2xl p-px transition-colors",
                  isOpen ? "bg-gradient-blue" : "bg-zinc-600",
                )}
              >
                <div className="overflow-hidden rounded-2xl bg-bg">
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    aria-expanded={isOpen}
                    className="flex w-full cursor-pointer items-center justify-between gap-8 p-6 text-left lg:p-8"
                  >
                    <span
                      className={cn(
                        "text-lg font-bold lg:text-xl",
                        isOpen
                          ? "bg-gradient-blue bg-clip-text text-transparent"
                          : "text-white",
                      )}
                    >
                      {faq.question}
                    </span>
                    <span
                      className={cn(
                        "size-6 shrink-0 transition-transform",
                        isOpen ? "rotate-180" : "text-white",
                      )}
                    >
                      <ChevronIcon
                        stroke={isOpen ? "url(#grad-blue)" : "currentColor"}
                      />
                    </span>
                  </button>

                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-out",
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="px-6 pb-6 lg:px-8 lg:pb-8">
                        <div className="h-px bg-gradient-blue" />
                        <p className="pt-6 text-lg text-stone-300 lg:text-xl">
                          <RichText
                            text={faq.answer}
                            linkClassName={accentText.cyan}
                          />
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </RevealGroup>
      </Container>
    </section>
  );
}
