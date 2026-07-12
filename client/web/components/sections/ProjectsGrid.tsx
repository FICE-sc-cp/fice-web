"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/departments";

export function ProjectsGrid({
  projects,
  gradient,
}: {
  projects: Project[];
  gradient: string;
}) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);

  return (
    <>
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p, i) => {
          const hasText = !!(p.metric || p.title || p.description);
          const open = p.image ? () => setActive(p.image!) : undefined;
          return (
            <div
              key={i}
              className={cn(
                "relative rounded-2xl p-px transition-transform duration-300 hover:z-10 hover:scale-[1.03]",
                gradient,
              )}
            >
              <div
                onClick={open}
                onKeyDown={
                  open
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          open();
                        }
                      }
                    : undefined
                }
                role={open ? "button" : undefined}
                tabIndex={open ? 0 : undefined}
                aria-label={
                  open
                    ? p.title
                      ? `Переглянути зображення: ${p.title}`
                      : "Переглянути зображення"
                    : undefined
                }
                className={cn(
                  "relative flex h-full flex-col overflow-hidden rounded-2xl bg-surface",
                  p.image && "cursor-pointer",
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 opacity-20",
                    gradient,
                  )}
                />
                {p.image && (
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={p.image}
                      alt={p.title ?? ""}
                      fill
                      sizes="(min-width: 1024px) 22rem, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                {hasText && (
                  <div className="relative flex flex-1 flex-col gap-3 p-7">
                    {p.metric && (
                      <span
                        className={cn(
                          "bg-clip-text text-2xl font-extrabold text-transparent",
                          gradient,
                        )}
                      >
                        {p.metric}
                      </span>
                    )}
                    {p.title && (
                      <h3 className="text-xl font-bold text-white">{p.title}</h3>
                    )}
                    {p.description && (
                      <p className="text-lg leading-relaxed text-stone-300">
                        {p.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {active &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setActive(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Закрити"
              className="absolute right-5 top-5 z-10 flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-2xl text-white transition-colors hover:bg-white/20"
            >
              ✕
            </button>
            <div className="relative h-[88vh] w-[92vw]">
              <Image
                src={active}
                alt=""
                fill
                sizes="92vw"
                className="object-contain"
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
