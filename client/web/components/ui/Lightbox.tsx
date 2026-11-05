"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Lightbox({
  onClose,
  children,
}: {
  onClose(): void;
  children: ReactNode;
}) {
  const close = useRef<HTMLButtonElement>(null);

  // In an effect rather than autoFocus, which would move focus before the opener is read.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => opener?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        e.preventDefault(); // the close button is all there is to reach
        close.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Перегляд зображення"
      onClick={(e) => {
        e.stopPropagation(); // portal clicks still bubble to the React parent, which may be the opener
        onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <button
        ref={close}
        type="button"
        aria-label="Закрити"
        className="absolute right-5 top-5 z-10 flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-2xl text-white transition-colors hover:bg-white/20"
      >
        ✕
      </button>
      {children}
    </div>,
    document.body,
  );
}
