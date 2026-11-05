'use client';

import { useSyncExternalStore } from 'react';

const CART_KEY = 'merch-cart';
const DRAFT_KEY = 'merch-checkout';
/** Pending bot link: { token, botUrl, expiresAt }, so the poll resumes after the Telegram trip. */
export const LINK_KEY = 'merch-link';

// ---- Storage helpers ----------------------------------------------------------

/** Holds what localStorage refused (blocked or full), so the page still works for this load. */
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

export function readStore(key: string): string | null {
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** null removes. Tells this tab's stores too, because `storage` fires only in the other tabs. */
export function writeStore(key: string, value: string | null): void {
  memory.delete(key);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    if (value !== null) memory.set(key, value);
  }
  listeners.forEach((listener) => listener());
}

/** For useSyncExternalStore over readCart and the session token. */
export function subscribeStore(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

// ---- Cart ---------------------------------------------------------------------

export interface StoredLine {
  variantId: number;
  quantity: number;
  label: string;
}

// ponytail: POST /merch/cart/preview takes 50 lines, so the 51st variant is refused with the
// "no more" toast. Raise it together with ArrayMaxSize if anyone ever gets that far.
const MAX_LINES = 50;

const EMPTY: StoredLine[] = [];
let rawCache: string | null = null;
let parsedCache = EMPTY;

const isLine = (l: StoredLine | null) =>
  !!l &&
  Number.isInteger(l.variantId) &&
  l.variantId > 0 &&
  Number.isInteger(l.quantity) &&
  l.quantity > 0 &&
  typeof l.label === 'string';

function parseCart(raw: string | null): StoredLine[] {
  if (!raw) return EMPTY;
  try {
    const lines: unknown = JSON.parse(raw);
    return Array.isArray(lines) ? (lines as StoredLine[]).filter(isLine) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Direct read. The same array until the raw string changes, or React loops on a new snapshot. */
export function readCart(): StoredLine[] {
  const raw = readStore(CART_KEY);
  if (raw !== rawCache) {
    rawCache = raw;
    parsedCache = parseCart(raw);
  }
  return parsedCache;
}

export const useCart = (): StoredLine[] => useSyncExternalStore(subscribeStore, readCart, () => EMPTY);

const writeCart = (lines: StoredLine[]) =>
  writeStore(CART_KEY, lines.length ? JSON.stringify(lines) : null);

/** min(old + qty, max); returns what was really added. */
export function addLine(line: StoredLine, max: number): number {
  const lines = readCart();
  const old = lines.find((l) => l.variantId === line.variantId);
  if (!old && lines.length >= MAX_LINES) return 0;
  const before = old?.quantity ?? 0;
  const next = Math.min(before + line.quantity, max);
  if (next <= before) return 0;
  const updated = { ...line, quantity: next };
  writeCart(old ? lines.map((l) => (l === old ? updated : l)) : [...lines, updated]);
  return next - before;
}

/** 0 removes. */
export function setQuantity(variantId: number, quantity: number): void {
  writeCart(
    readCart().flatMap((l) => {
      if (l.variantId !== variantId) return [l];
      return quantity > 0 ? [{ ...l, quantity }] : [];
    }),
  );
}

export const removeLine = (variantId: number): void => setQuantity(variantId, 0);

export const clearCart = (): void => writeStore(CART_KEY, null);

export const cartCount = (lines: StoredLine[]): number =>
  lines.reduce((sum, l) => sum + l.quantity, 0);

// ---- Checkout draft -----------------------------------------------------------

export interface CheckoutDraft {
  cartHash: string; // sorted variantId:quantity joined by ,
  clientKey: string; // new when cartHash changes or a new receipt is uploaded, deleted on success
  shownTotal: string; // the amount put in the payment block
  recipientId?: number;
  fullName?: string;
  phone?: string;
  save?: boolean;
  delivery?: 'NOVA_POSHTA' | 'DAYF' | 'LATER_CAMPUS';
  address?: string;
  receiptUrl?: string; // after upload, so a retry does not upload again
}

export const cartHash = (lines: StoredLine[]): string =>
  [...lines]
    .sort((a, b) => a.variantId - b.variantId)
    .map((l) => `${l.variantId}:${l.quantity}`)
    .join(',');

/** crypto.randomUUID needs a recent WebView and a secure context; the server wants a UUID. */
export const newKey = (): string => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
};

function storedDraft(): CheckoutDraft | null {
  try {
    const draft = JSON.parse(readStore(DRAFT_KEY) ?? 'null') as CheckoutDraft | null;
    return typeof draft?.clientKey === 'string' && typeof draft.shownTotal === 'string' ? draft : null;
  } catch {
    return null;
  }
}

/** The stored draft for this hash, never a new one. */
export function peekDraft(hash: string): CheckoutDraft | null {
  const draft = storedDraft();
  return draft?.cartHash === hash ? draft : null;
}

/**
 * New draft when absent or the hash differs. A cart edited at checkout keeps who and where;
 * never the payment, which belonged to the old amount.
 */
export function loadDraft(hash: string, total: string): CheckoutDraft {
  const stored = storedDraft();
  if (stored?.cartHash === hash) return stored;
  const { recipientId, fullName, phone, save, delivery, address } = stored ?? {};
  return { cartHash: hash, clientKey: newKey(), shownTotal: total, recipientId, fullName, phone, save, delivery, address };
}

export const saveDraft = (draft: CheckoutDraft): void =>
  writeStore(DRAFT_KEY, JSON.stringify(draft));

export const dropDraft = (): void => writeStore(DRAFT_KEY, null);
