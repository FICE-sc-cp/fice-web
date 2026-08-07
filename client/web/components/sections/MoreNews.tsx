"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { fice, mediaUrl, type News, type NewsCategory } from "@/lib/api";
import { Container } from "@/components/ui/Container";
import { ViewAllButton } from "@/components/ui/ViewAllLink";
import { cn } from "@/lib/utils";
import {
  NEWS_CATEGORIES,
  categoryLabel,
  excerpt,
  formatNewsDate,
} from "@/lib/news";

type Filter = NewsCategory | "all";

function CardImage({
  item,
  className,
  children,
}: {
  item: News;
  className?: string;
  children?: React.ReactNode;
}) {
  const url = mediaUrl(item.image);
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
        style={url ? { backgroundImage: `url("${url}")` } : undefined}
      >
        {!url && <div className="absolute inset-0 bg-gradient-main opacity-20" />}
      </div>
      {children}
    </div>
  );
}

export function MoreNews({
  initial,
  total,
  pageSize,
}: {
  initial: News[];
  total: number;
  pageSize: number;
}) {
  const [items, setItems] = useState(initial);
  const [count, setCount] = useState(total);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const initialSize = useRef(initial.length || pageSize);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtersFor = (nextFilter: Filter, nextQuery: string) => ({
    search: nextQuery.trim() || undefined,
    category: nextFilter === "all" ? undefined : nextFilter,
  });

  const search = (nextFilter: Filter, nextQuery: string) => {
    setLoading(true);
    setFailed(false);
    fice
      .news(initialSize.current, 1, filtersFor(nextFilter, nextQuery))
      .then((res) => {
        setItems(res.items);
        setCount(res.total);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  const changeFilter = (next: Filter) => {
    setFilter(next);
    if (debounce.current) clearTimeout(debounce.current);
    search(next, query);
  };

  const changeQuery = (next: string) => {
    setQuery(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(filter, next), 350);
  };

  const loadMore = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const loaded = items.length;
      const page = Math.floor(loaded / pageSize) + 1;
      const skip = loaded % pageSize;
      const filters = filtersFor(filter, query);
      const pages = await Promise.all(
        skip === 0
          ? [fice.news(pageSize, page, filters)]
          : [
              fice.news(pageSize, page, filters),
              fice.news(pageSize, page + 1, filters),
            ],
      );
      const chunk = pages.flatMap((p) => p.items).slice(skip, skip + pageSize);
      setItems((prev) => [...prev, ...chunk]);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const clean = filter === "all" && !query.trim();

  const featured = clean ? items[0] : null;
  const visible = clean ? items.slice(1) : items;

  return (
    <>
      <section className="relative z-10 py-4">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <FilterChip
                active={filter === "all"}
                onClick={() => changeFilter("all")}
                label="Усі"
              />
              {NEWS_CATEGORIES.map((c) => (
                <FilterChip
                  key={c.key}
                  active={filter === c.key}
                  onClick={() => changeFilter(c.key)}
                  label={c.label}
                />
              ))}
            </div>
            <label className="flex min-w-[16rem] flex-[0_1_20rem] items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 focus-within:border-brand-cyan">
              <SearchIcon />
              <input
                type="text"
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
                placeholder="Пошук новин…"
                className="flex-1 bg-transparent py-3 text-[15px] text-fg outline-none placeholder:text-subtle"
              />
            </label>
          </div>
        </Container>
      </section>

      {featured && (
        <section className="relative z-[1] py-7">
          <Container>
            <Link
              href={`/news/${featured.id}`}
              className="group grid overflow-hidden rounded-3xl border border-white/10 bg-surface/45 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-cyan/60 hover:shadow-2xl hover:shadow-black/40 lg:grid-cols-[1.15fr_1fr]"
            >
              <CardImage item={featured} className="min-h-[20rem]">
                <span className="absolute left-[18px] top-[18px] inline-flex items-center rounded-full bg-gradient-main px-3.5 py-1.5 text-[12.5px] font-extrabold uppercase tracking-wide text-stone-950">
                  {categoryLabel(featured.category)}
                </span>
              </CardImage>
              <div className="flex flex-col justify-center gap-4 p-9 lg:p-10">
                <span className="text-[13px] font-bold uppercase tracking-wide text-brand-cyan">
                  Головна новина · {formatNewsDate(featured.publishDate)}
                </span>
                <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
                  {featured.title}
                </h2>
                <p className="line-clamp-3 text-[17px] leading-relaxed text-subtle">
                  {excerpt(featured.details, 220)}
                </p>
                <span className="mt-1.5 inline-flex items-center gap-2 text-base font-extrabold text-brand-green">
                  Читати повністю →
                </span>
              </div>
            </Link>
          </Container>
        </section>
      )}

      <section className="relative z-[1] pb-16 pt-3">
        <Container>
          {visible.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
              {visible.map((item) => (
                <Link
                  key={item.id}
                  href={`/news/${item.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface/45 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-cyan/60 hover:shadow-2xl hover:shadow-black/40"
                >
                  <CardImage item={item} className="h-48">
                    <span className="absolute left-3.5 top-3.5 inline-flex items-center rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wide text-white backdrop-blur-sm">
                      {categoryLabel(item.category)}
                    </span>
                  </CardImage>
                  <div className="flex flex-1 flex-col gap-2.5 p-5">
                    <span className="text-[13px] font-bold text-subtle">
                      {formatNewsDate(item.publishDate)}
                    </span>
                    <h3 className="line-clamp-2 text-xl font-extrabold leading-snug">
                      {item.title}
                    </h3>
                    <p className="line-clamp-2 text-[15px] leading-relaxed text-subtle">
                      {excerpt(item.details)}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[14.5px] font-extrabold text-brand-cyan">
                      Читати →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : !clean ? (
            <div className="flex flex-col items-center gap-2.5 px-4 py-20 text-center">
              <span className="text-4xl">🔍</span>
              <h3 className="text-2xl font-extrabold">Нічого не знайшли</h3>
              <p className="max-w-md text-base text-subtle">
                Спробуй іншу категорію або зміни пошуковий запит.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
                className="mt-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:border-brand-cyan hover:text-brand-cyan"
              >
                Скинути фільтри
              </button>
            </div>
          ) : null}

          {failed && (
            <p className="mt-6 text-center text-sm text-brand-red">
              Не вдалося завантажити. Спробуй ще раз.
            </p>
          )}

          {items.length < count && (
            <div className="mt-10 flex justify-center">
              <ViewAllButton
                onClick={loadMore}
                disabled={loading}
                gradient="bg-gradient-blue"
                accent="text-brand-cyan"
              >
                {loading ? "Завантаження…" : "Переглянути ще"}
              </ViewAllButton>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-extrabold transition-all",
        active
          ? "bg-gradient-main text-stone-950"
          : "border border-border bg-surface/50 text-muted hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px] shrink-0 text-subtle"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
