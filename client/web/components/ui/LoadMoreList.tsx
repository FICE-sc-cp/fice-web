"use client";

import { useState, type ReactNode } from "react";

// Client-side "показати ще" over server-rendered cards: items arrive fully
// rendered, we just reveal them page by page.
export function LoadMoreList({
  items,
  pageSize = 12,
  className,
}: {
  items: ReactNode[];
  pageSize?: number;
  className: string;
}) {
  const [shown, setShown] = useState(pageSize);

  return (
    <>
      <div className={className}>{items.slice(0, shown)}</div>
      {shown < items.length && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setShown((s) => s + pageSize)}
            className="rounded-2xl bg-neutral-600/40 px-10 py-4 text-lg font-bold text-white transition-all hover:bg-neutral-600/60 hover:scale-[1.02] active:scale-95"
          >
            Показати ще
          </button>
        </div>
      )}
    </>
  );
}
