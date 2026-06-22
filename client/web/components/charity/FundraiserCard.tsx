import Link from "next/link";
import { cn } from "@/lib/utils";
import { mediaUrl, type Fundraiser } from "@/lib/api";
import { formatUAH, fundraiserPct, fundraiserTheme } from "@/lib/utils";

export function FundraiserCard({ fundraiser }: { fundraiser: Fundraiser }) {
  const closed = fundraiser.status === "CLOSED";
  const theme = fundraiserTheme(fundraiser.id);
  const fill = theme.gradient;
  const pct = fundraiserPct(fundraiser.currentAmount, fundraiser.goalAmount);
  const cover = mediaUrl(fundraiser.imageUrl);

  return (
    <Link
      href={`/charity/${fundraiser.id}`}
      className={cn(
        "group flex flex-col gap-6 rounded-2xl border border-border p-6 transition-colors",
        theme.borderHover,
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={fundraiser.name}
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={cn("absolute inset-0 opacity-25", fill)} />
        )}
        <span
          className={cn(
            "absolute right-4 top-4 inline-flex items-center gap-2.5 rounded-lg px-4 py-2 text-sm font-bold text-black",
            closed ? "bg-brand-red/30" : "bg-brand-green/30",
          )}
        >
          <span
            className={cn(
              "size-2.5 rounded-full",
              closed ? "bg-brand-red" : "bg-brand-green",
            )}
          />
          {closed ? "Закритий" : "Активний"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col gap-2">
          <h3 className="line-clamp-2 text-xl font-bold text-white">
            {fundraiser.name}
          </h3>
          <p className="line-clamp-3 text-lg font-medium leading-6 text-muted">
            {fundraiser.description}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
            <div
              className={cn("h-full rounded-full", fill)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-lg text-white">
            <span className="font-bold">{formatUAH(fundraiser.currentAmount)} ₴</span>
            <span className="text-subtle">з {formatUAH(fundraiser.goalAmount)} ₴</span>
          </div>
        </div>

        {closed ? (
          <span className="rounded-lg bg-gray-400 px-7 py-3.5 text-center text-lg font-bold text-neutral-600">
            Збір закритий
          </span>
        ) : (
          <span
            className={cn(
              "rounded-lg px-7 py-3.5 text-center text-lg font-bold text-black transition-opacity group-hover:opacity-90",
              fill,
            )}
          >
            Задонатити
          </span>
        )}
      </div>
    </Link>
  );
}
