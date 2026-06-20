import type { NewsCategory } from '@/lib/api';

export interface CategoryMeta {
  key: NewsCategory;
  label: string;
}

/** Filter/badge categories, in display order. */
export const NEWS_CATEGORIES: CategoryMeta[] = [
  { key: 'EVENTS', label: 'Події' },
  { key: 'EDUCATION', label: 'Освіта' },
  { key: 'PARTNERS', label: 'Партнерства' },
  { key: 'CHARITY', label: 'Благодійність' },
  { key: 'ACHIEVEMENTS', label: 'Досягнення' },
];

const CATEGORY_LABELS: Record<NewsCategory, string> = Object.fromEntries(
  NEWS_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<NewsCategory, string>;

/** Human label for a category, with a sensible fallback for uncategorised news. */
export function categoryLabel(category: NewsCategory | null): string {
  return category ? CATEGORY_LABELS[category] : 'Новини';
}

const MONTHS_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];

/** "12 червня 2026" */
export function formatNewsDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()}`;
}

/** Date and "HH:mm" time, for event announcements. */
export function formatEventDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: formatNewsDate(iso),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** First non-empty chunk of the body, trimmed to a card-friendly length. */
export function excerpt(details: string | null, max = 160): string {
  if (!details) return '';
  const text = details.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

/** Split plain-text body into paragraphs for rendering. */
export function bodyParagraphs(details: string | null): string[] {
  if (!details) return [];
  return details
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Rough reading time in Ukrainian, e.g. "4 хв читання". */
export function readingTime(details: string | null): string {
  const words = (details ?? '').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} хв читання`;
}
