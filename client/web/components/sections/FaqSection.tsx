"use client";

import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal, RevealGroup } from "@/components/ui/Reveal";
import { ChevronIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    question:
      "Скільки додаткових балів дають за активну участь у роботі департаменту?",
    answer:
      "За активну участь у департаменті ти можеш отримати до 20 додаткових балів від Студради.",
  },
  {
    question:
      "Викладач не дотримується вимог силабусу. Що робити і куди мені звертатись?",
    answer: "Плакати хз",
  },
  {
    question:
      "Викладач не дотримується вимог силабусу. Що робити і куди мені звертатись?",
    answer: "Плакати хз",
  },
  {
    question:
      "Викладач не дотримується вимог силабусу. Що робити і куди мені звертатись?",
    answer:
      "ввпнапгувріоивс рпнап урапугірарвиірапі гаурнпаурірануппн гупагнкуцгпарові ввпнапгувріоивс рпнап урапугірарвиірапі гаурнпаурірануппн гупагнкуцгпарові ввпнапгувріоивс рпнап урапугірарвиірапі гаурнпаурірануппн гупагнкуцгпарові ввпнапгувріоивс рпнап урапугірарвиірапі гаурнпаурірануппн гупагнкуцгпарові.",
  },
  {
    question:
      "Викладач не дотримується вимог силабусу. Що робити і куди мені звертатись?",
    answer: "Текст відповіді на питання.",
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
                          {faq.answer}
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
