import { Fragment } from "react";
import Link from "next/link";

const REPEAT = 12;
const DURATION = `${REPEAT * 7.5}s`;

export function Marquee() {
  const group = (
    <div className="flex shrink-0 items-center gap-8 pr-8" aria-hidden>
      {Array.from({ length: REPEAT }).map((_, i) => (
        <Fragment key={i}>
          <span className="whitespace-nowrap text-xl font-semibold uppercase text-black">
            Приєднатись до команди
          </span>
          <span className="size-6 shrink-0 rounded-full bg-black" />
        </Fragment>
      ))}
    </div>
  );

  return (
    <Link
      href="/join"
<<<<<<< HEAD
      className="transition-opacity hover:opacity-90"
    >
      <div className="overflow-hidden bg-gradient-main py-6">
        <div
          className="flex w-max animate-marquee"
          style={{ animationDuration: DURATION }}
        >
          {group}
          {group}
        </div>
=======
      aria-label="Приєднатись до команди"
      className="group block overflow-hidden bg-gradient-main py-6 transition-opacity hover:opacity-90"
    >
      <div
        className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        style={{ animationDuration: DURATION }}
      >
        {group}
        {group}
>>>>>>> b957ad1 (feat: event registration system (backend, web, admin))
      </div>
    </Link>
  );
}
