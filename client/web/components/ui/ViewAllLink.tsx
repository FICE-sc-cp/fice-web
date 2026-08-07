import Link from "next/link";
import { cn } from "@/lib/utils";

// "Переглянути всі" CTA — the «підкреслення-заливка» variant from the design:
// a text link over a thin grey line that fills with the section gradient
// left-to-right on hover, arrow nudging along.
const SHELL =
  "group relative inline-flex items-center gap-2.5 px-0.5 pb-2 text-lg font-extrabold text-white";

function ViewAllInner({
  gradient,
  accent,
  children,
}: {
  gradient: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "block h-[18px] w-[18px] transition-transform duration-300 ease-[cubic-bezier(.22,.7,.2,1)] group-hover:translate-x-1",
          accent,
        )}
      >
        <path d="M5 12h13" />
        <path d="M12 5l7 7-7 7" />
      </svg>
      <span className="absolute bottom-0 left-0 h-[1.5px] w-full rounded-full bg-[#33333c]" />
      <span
        className={cn(
          "absolute bottom-0 left-0 h-[1.5px] w-0 rounded-full transition-[width] duration-[350ms] ease-[cubic-bezier(.22,.7,.2,1)] group-hover:w-full",
          gradient,
        )}
      />
    </>
  );
}

export function ViewAllButton({
  onClick,
  disabled,
  gradient,
  accent,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  gradient: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(SHELL, "cursor-pointer disabled:opacity-60")}
    >
      <ViewAllInner gradient={gradient} accent={accent}>
        {children}
      </ViewAllInner>
    </button>
  );
}

export function ViewAllLink({
  href,
  gradient,
  accent,
  children,
}: {
  href: string;
  gradient: string; // section gradient, e.g. "bg-gradient-magenta"
  accent: string; // arrow colour, e.g. "text-brand-magenta"
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative inline-flex items-center gap-2.5 px-0.5 pb-2 text-lg font-extrabold text-white"
    >
      {children}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "block h-[18px] w-[18px] transition-transform duration-300 ease-[cubic-bezier(.22,.7,.2,1)] group-hover:translate-x-1",
          accent,
        )}
      >
        <path d="M5 12h13" />
        <path d="M12 5l7 7-7 7" />
      </svg>
      <span className="absolute bottom-0 left-0 h-[1.5px] w-full rounded-full bg-[#33333c]" />
      <span
        className={cn(
          "absolute bottom-0 left-0 h-[1.5px] w-0 rounded-full transition-[width] duration-[350ms] ease-[cubic-bezier(.22,.7,.2,1)] group-hover:w-full",
          gradient,
        )}
      />
    </Link>
  );
}
