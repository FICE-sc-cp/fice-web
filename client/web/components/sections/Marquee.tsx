import { Fragment } from "react";

const REPEAT = 12;
const DURATION = `${REPEAT * 7.5}s`;

export function Marquee() {
  const group = (
    <div className="flex shrink-0 items-center gap-8 pr-8">
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
    <div className="overflow-hidden bg-gradient-main py-6">
      <div
        className="flex w-max animate-marquee"
        style={{ animationDuration: DURATION }}
      >
        {group}
        {group}
      </div>
    </div>
  );
}
