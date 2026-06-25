'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Reveal, RevealGroup } from '@/components/ui/Reveal';
import { ChevronIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const QUESTION =
  'Викладач не дотримується вимог силабусу. Що робити і куди мені звертатись?';

const FAQS = [
  { question: QUESTION, answer: 'Плакати хз' },
  { question: QUESTION, answer: 'Текст відповіді на питання.' },
  { question: QUESTION, answer: 'Текст відповіді на питання.' },
  {
    question: QUESTION,
    answer:
      'ввпнапгувріоивс рпнап урапугірарвиірапі гаурнпаурірануппн гупагнкуцгпарові ввпнапгувріоивс рпнап урапугірарвиірапі гаурнпаурірануппн гупагнкуцгпарові ввпнапгувріоивс рпнап урапугірарвиірапі гаурнпаурірануппн гупагнкуцгпарові ввпнапгувріоивс рпнап урапугірарвиірапі гаурнпаурірануппн гупагнкуцгпарові.',
  },
  { question: QUESTION, answer: 'Текст відповіді на питання.' },
];

export function FaqSection() {
  const [open, setOpen] = useState<number[]>([0]);

  const toggle = (index: number) =>
    setOpen((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index],
    );

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
            const isOpen = open.includes(index);
            return (
              <div
                key={index}
                className={cn(
                  'overflow-hidden rounded-2xl border transition-colors',
                  isOpen ? 'border-brand-cyan' : 'border-zinc-600',
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-8 p-6 text-left lg:p-8"
                >
                  <span
                    className={cn(
                      'text-lg font-bold lg:text-xl',
                      isOpen ? 'text-brand-cyan' : 'text-white',
                    )}
                  >
                    {faq.question}
                  </span>
                  <span
                    className={cn(
                      'size-6 shrink-0 transition-transform',
                      isOpen ? 'rotate-180 text-brand-cyan' : 'text-white',
                    )}
                  >
                    <ChevronIcon />
                  </span>
                </button>

                <div
                  className={cn(
                    'grid transition-all duration-300 ease-out',
                    isOpen
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-brand-cyan px-6 pb-6 lg:px-8 lg:pb-8">
                      <p className="pt-6 text-lg text-stone-300 lg:text-xl">
                        {faq.answer}
                      </p>
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
