import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]){
    return twMerge(clsx(inputs));
}

export function eventRegistrationOpen(event: {
  date: string;
  registrationCloseDate: string | null;
}): boolean {
  const closeTs = event.registrationCloseDate
    ? new Date(event.registrationCloseDate).getTime()
    : new Date(event.date).getTime();
  return Date.now() < closeTs;
}

export function isEventPast(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}

/** Money formatted the Ukrainian way: thin-grouped thousands, no decimals. */
export function formatUAH(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('uk-UA').replace(/ /g, ' ');
}

/** Whole days left until `endDate`, clamped at 0. Null if no date. */
export function daysLeft(endDate?: string | null): number | null {
  if (!endDate) return null;
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function fundraiserPct(current: number | string, goal: number | string): number {
  const c = Number(current);
  const g = Number(goal);
  if (!Number.isFinite(g) || g <= 0) return 0;
  return Math.min(100, Math.round((c / g) * 100));
}

const rtf = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' });
const RT_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "2 хвилини тому", "щойно", … from a timestamp. */
export function relativeTimeUk(dateStr: string): string {
  const diffS = Math.round((new Date(dateStr).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffS);
  if (abs < 45) return 'щойно';
  for (const [unit, secs] of RT_STEPS) {
    if (abs >= secs) return rtf.format(Math.round(diffS / secs), unit);
  }
  return 'щойно';
}

export interface FundraiserTheme {
  gradient: string;
  accentText: string;
  border: string;
  borderFocus: string;
  borderHover: string;
  glowA: string;
  glowB: string;
}

// One consistent brand palette for every fundraiser — per-card random colours
// made the cards stand out from the rest of the site.
const FUNDRAISER_THEME: FundraiserTheme = {
  gradient: 'bg-gradient-main',
  accentText: 'text-brand-green',
  border: 'border-brand-green',
  borderFocus: 'focus:border-brand-green/60',
  borderHover: 'hover:border-brand-green/60',
  glowA: '#2EFF97',
  glowB: '#00E3F3',
};

export function fundraiserTheme(_id: string): FundraiserTheme {
  return FUNDRAISER_THEME;
}

/**
 * Builds a Monobank jar/send link with the chosen amount pre-filled. Monobank
 * send pages accept `a` (amount) and `t` (comment) query params.
 */
export function donateJarUrl(jarUrl: string, amount?: number): string {
  if (!amount || amount <= 0) return jarUrl;
  try {
    const url = new URL(jarUrl);
    url.searchParams.set('a', String(amount));
    return url.toString();
  } catch {
    return jarUrl;
  }
}
