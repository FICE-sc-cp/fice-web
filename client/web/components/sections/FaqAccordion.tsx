"use client";

import { useState } from "react";
import { RevealGroup } from "@/components/ui/Reveal";
import { ChevronIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function FaqAccordion({
  items,
  gradient = "bg-gradient-blue",
  gradId = "grad-blue",
}: {
  items: { question: string; answer: string }[];
  gradient?: string;
  gradId?: string;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const toggle = (index: number) =>
    setOpen((prev) => (prev === index ? null : index));

  return (
    <RevealGroup className="mx-auto mt-14 flex max-w-5xl flex-col gap-4">
      {items.map((faq, index) => {
        const isOpen = open === index;
        return (
          <div
            key={index}
            className={cn(
              "rounded-2xl p-px transition-colors",
              isOpen ? gradient : "bg-zinc-600",
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
                      ? `${gradient} bg-clip-text text-transparent`
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
                    stroke={isOpen ? `url(#${gradId})` : "currentColor"}
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
                    <div className={cn("h-px", gradient)} />
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
  );
}
