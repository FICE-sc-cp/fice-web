import type { MerchDeliveryMethod, MerchOrderStatus } from '@prisma/client';
import { kyivParts } from '../event/event-timing';

export const NO_SIZE = '-';
export const MAX_QTY = 99;
export const MAX_PENDING_ORDERS = 10;
export const MAX_RECIPIENTS = 20;
export const LINK_TTL_MS = 15 * 60_000;
export const SESSION_TTL_MS = 180 * 86_400_000;
export const ADMIN_PROMPT_MS = 30 * 60_000;
export const SUPPORT_PROMPT_MS = 24 * 3_600_000;
export const CONFIRM_TTL_S = { clearOrders: 120, broadcast: 300 } as const;
/** Telegram's limits for a caption and a message. */
export const CAPTION_LIMIT = 1024;
export const TEXT_LIMIT = 4096;

// ---- Money ----------------------------------------------------------------

/** All money arithmetic is in kopecks; Decimal strings go in and come out. */
export const toKopecks = (
  v: string | number | { toString(): string },
): number => Math.round(Number(v.toString()) * 100);
export const fromKopecks = (k: number): string => (k / 100).toFixed(2);

// ---- Catalog and display --------------------------------------------------

export interface VariantLike {
  size: string;
  color: string;
  order: number;
  stock: number | null;
}

export interface ProductVariant {
  id: number;
  size: string;
  color: string;
  price: string;
  stock: number | null;
}

export interface ProductPhoto {
  color: string;
  url: string;
  thumbUrl: string;
}

/** One row of the product query in merch-catalog.service.ts. */
export interface ProductRow {
  id: number;
  title: string;
  description: string;
  isActive: boolean;
  categoryId: number | null;
  variants: (ProductVariant & { order: number })[];
  photos: ProductPhoto[];
  tagIds: number[];
  groupIds: number[];
}

/** Mirrors ProductView in client/web/lib/merch-types.ts. */
export interface ProductView {
  id: number;
  title: string;
  description: string;
  archived: boolean;
  categoryId: number | null;
  tagIds: number[];
  colors: string[];
  sizes: string[];
  fixedSize: string | null;
  defaultColor: string;
  minPrice: string | null;
  variants: ProductVariant[];
  photos: ProductPhoto[];
  botUsername: string | null;
}

export const isAvailable = (v: { stock: number | null }) =>
  v.stock === null || v.stock > 0;

/** Matrix axes. order is sizeIndex * 100 + colorIndex. */
export function sizesOf(variants: VariantLike[]): string[] {
  const rows = [...variants].sort(
    (a, b) => Math.floor(a.order / 100) - Math.floor(b.order / 100),
  );
  return [...new Set(rows.map((v) => v.size))];
}

export function colorsOf(variants: VariantLike[]): string[] {
  const rows = [...variants].sort((a, b) => (a.order % 100) - (b.order % 100));
  return [...new Set(rows.map((v) => v.color).filter(Boolean))];
}

/** First colour that has something to sell, else the first colour, else ''. Never hard-coded. */
export function defaultColor(variants: VariantLike[]): string {
  const colors = colorsOf(variants);
  const selling = colors.find((c) =>
    variants.some((v) => v.color === c && isAvailable(v)),
  );
  return selling ?? colors[0] ?? '';
}

/** First size with stock in that colour, else its first size, else ''. */
export function defaultSize(variants: VariantLike[], color: string): string {
  const inColor = variants.filter((v) => v.color === color);
  const sizes = sizesOf(inColor);
  const selling = sizes.find((s) =>
    inColor.some((v) => v.size === s && isAvailable(v)),
  );
  return selling ?? sizes[0] ?? '';
}

/** What the product page asks for. Also covers colours without sizes. */
export function optionSteps(variants: VariantLike[]): {
  colors: string[];
  sizes: string[];
  fixedSize: string | null;
} {
  const colors = colorsOf(variants);
  const sizes = sizesOf(variants);
  const noSize = sizes.length === 1 && sizes[0] === NO_SIZE;
  const single = variants.length === 1 && colors.length === 0;
  if (noSize) return { colors, sizes: [], fixedSize: null };
  if (single) return { colors, sizes: [], fixedSize: sizes[0] };
  return { colors, sizes, fixedSize: null };
}

/** "M — Білий", "Білий", "M" or ''. The only place sizes become text, so NO_SIZE never shows. */
export function optionsLabel(size: string, color: string, sep = ' — '): string {
  return [size === NO_SIZE ? '' : size, color].filter(Boolean).join(sep);
}

/** Customer text inside a plain text card: a newline in a name must not print a fake card line. */
export const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

export type ProductAccess = 'ok' | 'archived' | 'hidden';

export function productAccess(
  p: { isActive: boolean; groupIds: number[] },
  viewerGroups: number[],
): ProductAccess {
  if (p.groupIds.length && !p.groupIds.some((g) => viewerGroups.includes(g))) {
    return 'hidden';
  }
  return p.isActive ? 'ok' : 'archived';
}

/** Lowest available price, else lowest of all, null without variants. */
function lowestPrice(
  variants: { price: string; stock: number | null }[],
): string | null {
  const available = variants.filter(isAvailable);
  const pool = available.length ? available : variants;
  return pool.length
    ? fromKopecks(Math.min(...pool.map((v) => toKopecks(v.price))))
    : null;
}

/**
 * null: hidden from this viewer (404). Archived: archived true, variants, colors, sizes [],
 * minPrice null, photos kept. Otherwise full: colors, sizes, fixedSize, defaultColor, minPrice
 * (lowest available, else lowest of all). The browser has no copy of these rules.
 */
export function viewProduct(
  row: ProductRow,
  viewerGroups: number[],
  botUsername: string | null,
): ProductView | null {
  const access = productAccess(row, viewerGroups);
  if (access === 'hidden') return null;
  const { id, title, description, categoryId, tagIds, photos, variants } = row;
  const base = {
    id,
    title,
    description,
    categoryId,
    tagIds,
    photos,
    botUsername,
    // Archived pages keep it: it picks their photo and og:image.
    defaultColor: defaultColor(variants),
  };
  if (access === 'archived') {
    return {
      ...base,
      archived: true,
      colors: [],
      sizes: [],
      fixedSize: null,
      minPrice: null,
      variants: [],
    };
  }
  return {
    ...base,
    archived: false,
    ...optionSteps(variants),
    minPrice: lowestPrice(variants),
    variants: variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      price: v.price,
      stock: v.stock,
    })),
  };
}

// ---- Cart and stock -------------------------------------------------------

export type LineStatus = 'ok' | 'short' | 'soldout' | 'archived' | 'gone';

/** Mirrors CartLineView in client/web/lib/merch-types.ts. */
export interface CartLineView {
  variantId: number;
  productId: number | null;
  title: string | null;
  size: string | null;
  color: string;
  options: string;
  thumbUrl: string | null;
  unitPrice: string | null;
  lineTotal: string;
  quantity: number;
  maxQuantity: number;
  status: LineStatus;
}

export interface CartPreview {
  lines: CartLineView[];
  total: string;
  hasProblems: boolean;
}

export interface VariantNow {
  id: number;
  productId: number;
  title: string;
  isActive: boolean;
  groupIds: number[];
  size: string;
  color: string;
  price: string;
  stock: number | null;
}

/** Same variant twice: first line kept, quantities summed, cap MAX_QTY. */
export function mergeLines<T extends { variantId: number; quantity: number }>(
  lines: T[],
): T[] {
  const merged = new Map<number, T>();
  for (const line of lines) {
    const seen = merged.get(line.variantId);
    const quantity = Math.min((seen?.quantity ?? 0) + line.quantity, MAX_QTY);
    merged.set(line.variantId, { ...(seen ?? line), quantity });
  }
  return [...merged.values()];
}

/** Cart level limit (decision 8). maxQuantity is min(stock, MAX_QTY), or MAX_QTY when unlimited. */
export function checkLine(
  quantity: number,
  variant: VariantNow | undefined,
  viewerGroups: number[],
): { status: LineStatus; maxQuantity: number } {
  const access = variant ? productAccess(variant, viewerGroups) : 'hidden';
  if (!variant || access === 'hidden')
    return { status: 'gone', maxQuantity: 0 };
  if (access === 'archived') return { status: 'archived', maxQuantity: 0 };
  if (!isAvailable(variant)) return { status: 'soldout', maxQuantity: 0 };
  const maxQuantity = Math.min(variant.stock ?? MAX_QTY, MAX_QTY);
  return { status: quantity > maxQuantity ? 'short' : 'ok', maxQuantity };
}

/**
 * Live prices only, nothing from the client. A gone line, hidden ones included, is exactly
 * { variantId, productId: null, title: null, size: null, color: '', options: '', thumbUrl: null,
 *   unitPrice: null, lineTotal: '0.00', quantity, maxQuantity: 0, status: 'gone' },
 * so sweeping ids anonymously cannot tell a curator product from a missing one.
 */
export function priceCart(
  lines: { variantId: number; quantity: number }[],
  variants: (VariantNow & { thumbUrl: string | null })[],
  viewerGroups: number[],
): CartPreview {
  const byId = new Map(variants.map((v) => [v.id, v]));
  let totalKopecks = 0;
  const views = lines.map(({ variantId, quantity }): CartLineView => {
    const v = byId.get(variantId);
    const { status, maxQuantity } = checkLine(quantity, v, viewerGroups);
    if (!v || status === 'gone') {
      return {
        variantId,
        productId: null,
        title: null,
        size: null,
        color: '',
        options: '',
        thumbUrl: null,
        unitPrice: null,
        lineTotal: '0.00',
        quantity,
        maxQuantity: 0,
        status: 'gone',
      };
    }
    const unit = toKopecks(v.price);
    // The full quantity, as decideOrder charges, so a checkout left open on a short
    // line asks for what the order will total.
    const lineKopecks = unit * quantity;
    totalKopecks += lineKopecks;
    return {
      variantId,
      productId: v.productId,
      title: v.title,
      size: v.size === NO_SIZE ? null : v.size,
      color: v.color,
      options: optionsLabel(v.size, v.color),
      thumbUrl: v.thumbUrl,
      unitPrice: fromKopecks(unit),
      lineTotal: fromKopecks(lineKopecks),
      quantity,
      maxQuantity,
      status,
    };
  });
  return {
    lines: views,
    total: fromKopecks(totalKopecks),
    hasProblems: views.some((l) => l.status !== 'ok'),
  };
}

/** Floor at 0: the customer already paid, so a short line is a warning, not a refusal. */
export function takeStock(stock: number | null, quantity: number) {
  if (stock === null) return { left: null, taken: 0, short: 0 };
  const taken = Math.min(stock, quantity);
  return { left: stock - taken, taken, short: quantity - taken };
}

export interface OrderDecision {
  items: {
    variantId: number;
    productId: number;
    title: string;
    size: string;
    color: string;
    unitKopecks: number;
    quantity: number;
    stockTaken: number;
  }[];
  /** Only variants that change. */
  stock: { id: number; left: number }[];
  totalKopecks: number;
  warnings: string[];
}

/**
 * Never throws: the customer has paid, so everything odd becomes a warning for
 * the admin who checks the receipt. A hidden line adds no item, stock or price,
 * because the order goes back to the customer and warnings never do.
 */
export function decideOrder(
  lines: { variantId: number; quantity: number; label: string }[],
  variants: Map<number, VariantNow>,
  viewerGroups: number[],
  expectedKopecks: number,
): OrderDecision {
  const decision: OrderDecision = {
    items: [],
    stock: [],
    totalKopecks: 0,
    warnings: [],
  };
  const { warnings } = decision;
  for (const { variantId, quantity, label } of lines) {
    const v = variants.get(variantId);
    if (!v) {
      warnings.push(
        `⚠️ Позицію видалено: ${label.slice(0, 120)} × ${quantity}. Ціну не перевірено.`,
      );
      continue;
    }
    const access = productAccess(v, viewerGroups);
    if (access === 'hidden') {
      warnings.push(`⚠️ Товар не для цього покупця: ${v.title} × ${quantity}`);
      continue;
    }
    if (access === 'archived')
      warnings.push(`⚠️ Товар уже в архіві: ${v.title}`);
    const { left, taken, short } = takeStock(v.stock, quantity);
    if (short > 0) {
      const name = [v.title, optionsLabel(v.size, v.color)]
        .filter(Boolean)
        .join(' ');
      warnings.push(
        `⚠️ Не вистачило: ${name}: замовлено ${quantity}, було ${v.stock}`,
      );
    }
    if (left !== null && taken > 0) decision.stock.push({ id: v.id, left });
    const unitKopecks = toKopecks(v.price);
    decision.items.push({
      variantId: v.id,
      productId: v.productId,
      title: v.title,
      size: v.size,
      color: v.color,
      unitKopecks,
      quantity,
      stockTaken: taken,
    });
    decision.totalKopecks += unitKopecks * quantity;
  }
  if (decision.totalKopecks !== expectedKopecks) {
    warnings.push(
      `⚠️ Сума не збігається: клієнт бачив ${fromKopecks(expectedKopecks)}, сервер порахував ${fromKopecks(decision.totalKopecks)} грн`,
    );
  }
  return decision;
}

// ---- Status, delivery, pickup ---------------------------------------------

export const TRANSITIONS: Record<MerchOrderStatus, MerchOrderStatus[]> = {
  PENDING: ['IN_PROCESS', 'CANCELLED'],
  IN_PROCESS: ['READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const canTransition = (from: MerchOrderStatus, to: MerchOrderStatus) =>
  TRANSITIONS[from].includes(to);

/** Statuses a card still has working buttons in. */
export const OPEN_STATUSES = (
  Object.keys(TRANSITIONS) as MerchOrderStatus[]
).filter((status) => TRANSITIONS[status].length > 0);

/** Statuses an order may be in to move to `to`: the where clause of the status CAS. */
export const sourcesOf = (to: MerchOrderStatus): MerchOrderStatus[] =>
  (Object.keys(TRANSITIONS) as MerchOrderStatus[]).filter((from) =>
    TRANSITIONS[from].includes(to),
  );

/** "ostatus:123:in_process"; null for anything malformed or not a status. */
export function parseStatusCallback(
  data: string,
): { orderId: number; status: MerchOrderStatus } | null {
  const match = /^ostatus:([1-9]\d{0,8}):([a-z_]+)$/.exec(data);
  if (!match) return null;
  const status = match[2].toUpperCase() as MerchOrderStatus;
  return status in TRANSITIONS ? { orderId: Number(match[1]), status } : null;
}

export const isPickupDelivery = (m: MerchDeliveryMethod | null) =>
  m === 'CAMPUS' || m === 'DAYF' || m === 'LATER_CAMPUS';

/** null when the customer may choose, else why not. */
export function pickupProblem(o: {
  deliveryMethod: MerchDeliveryMethod | null;
  status: MerchOrderStatus;
}): 'delivery' | 'status' | null {
  if (!isPickupDelivery(o.deliveryMethod)) return 'delivery';
  return o.status === 'READY_FOR_PICKUP' ? null : 'status';
}

/** The profile row and the pickup page; a chosen time is final. */
export const canChoosePickup = (o: {
  deliveryMethod: MerchDeliveryMethod | null;
  status: MerchOrderStatus;
  pickupSlotId: number | null;
  needsIndividualPickup: boolean;
}) =>
  pickupProblem(o) === null &&
  o.pickupSlotId === null &&
  !o.needsIndividualPickup;

/** What goes into MerchOrder.address. */
export function addressFor(
  delivery: MerchDeliveryMethod,
  typed?: string,
): string {
  if (delivery === 'NOVA_POSHTA') return (typed ?? '').trim();
  return delivery === 'LATER_CAMPUS' ? 'Пізніше в корпусі' : 'На DayF';
}

/** "2026-11-12" and "14:05", Kyiv wall clock. */
export function kyivNow(at: Date): { date: string; time: string } {
  const p = kyivParts(at);
  const two = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p.year}-${two(p.month)}-${two(p.day)}`,
    time: `${two(p.hour)}:${two(p.minute)}`,
  };
}

/** MerchPickupSlot.date is a DateTime: Prisma refuses 'YYYY-MM-DD' and returns a Date. Writes use slotDate.
 *  Every read passes date: slotDay(row.date) into slotVisible, slotLabel, slotChatLabel, AdminSlot, PickupSlotView. */
export const slotDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
export const slotDay = (d: Date) => d.toISOString().slice(0, 10);

/** The old rule, on the Kyiv clock instead of UTC. */
export function slotVisible(
  slot: { id: number; date: string; startTime: string; isActive: boolean },
  now: { date: string; time: string },
  booked: Set<number>,
): boolean {
  if (!slot.isActive || slot.date < now.date) return false;
  if (slot.date > now.date) return true;
  return booked.has(slot.id) && slot.startTime >= now.time; // same day: only slots already in use
}

export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** null, or the Ukrainian text. Calendar-valid date, valid times, end after start. */
export function slotProblem(
  date: string,
  start: string,
  end: string,
): string | null {
  const day = slotDate(date);
  const realDay = !Number.isNaN(day.getTime()) && slotDay(day) === date;
  if (!realDay || !isTime(start) || !isTime(end)) {
    return 'Некоректна дата або час.';
  }
  return end > start ? null : 'Кінець має бути пізніше за початок.';
}

/** "12.11, 12:00–14:00" for the profile, with an en dash. */
export function slotLabel(slot: {
  date: string;
  startTime: string;
  endTime: string;
}): string {
  const [, month, day] = slot.date.split('-');
  return `${day}.${month}, ${slot.startTime}–${slot.endTime}`;
}

/** "2026-11-12 12:00-14:00" for chat texts. */
export function slotChatLabel(slot: {
  date: string;
  startTime: string;
  endTime: string;
}): string {
  return `${slot.date} ${slot.startTime}-${slot.endTime}`;
}

/** Strips spaces, hyphens, parentheses, dots; gives +380XXXXXXXXX or null. */
export function normalizePhone(raw: string): string | null {
  const match = /^(?:\+?380|0)(\d{9})$/.exec(raw.replace(/[\s\-().]/g, ''));
  return match ? `+380${match[1]}` : null;
}

// ---- Admin ----------------------------------------------------------------

export interface VariantRow {
  size: string;
  color: string;
  price: string;
  order: number;
  stock?: number | null;
  stockSeen?: number | null;
}

/** Trims; uppercases sizes except NO_SIZE. */
export function normalizeVariants(rows: VariantRow[]): VariantRow[] {
  return rows.map((row) => ({
    ...row,
    size: row.size.trim().toUpperCase(),
    color: row.color.trim(),
  }));
}

const sizeName = (size: string) => (size === NO_SIZE ? 'без розміру' : size);

const variantKey = (v: { size: string; color: string }) =>
  JSON.stringify([v.size, v.color]);

/** First problem as a Ukrainian sentence, or null. Each check runs over every row. */
export function variantProblem(rows: VariantRow[]): string | null {
  if (!rows.length) return 'Додайте хоча б один варіант';
  if (rows.some((r) => !r.size)) return 'Назва розміру не може бути порожньою';
  const sizes = new Set(rows.map((r) => r.size));
  if (sizes.has(NO_SIZE) && sizes.size > 1) {
    return 'Розмір «-» не можна поєднувати з іншими розмірами';
  }
  const badPrice = rows.find((r) => !(toKopecks(r.price) > 0));
  if (badPrice) return `Некоректна ціна для розміру ${sizeName(badPrice.size)}`;
  const badStock = rows.find(
    (r) => r.stock != null && (!Number.isInteger(r.stock) || r.stock < 0),
  );
  if (badStock) {
    return `Некоректна кількість для розміру ${sizeName(badStock.size)}`;
  }
  const seen = new Set<string>();
  for (const row of rows) {
    const key = variantKey(row);
    if (seen.has(key)) {
      const name = [sizeName(row.size), row.color].filter(Boolean).join(' ');
      return `Розмір ${name} повторюється`;
    }
    seen.add(key);
  }
  return null;
}

/** Decision 10. The admin form never overwrites sales made while it was open. */
export function applyStockEdit(
  current: number | null,
  seen: number | null | undefined,
  wanted: number | null | undefined,
): number | null {
  const want = wanted ?? null;
  const saw = seen === undefined ? current : seen;
  if (want === saw) return current; // field not touched
  if (want === null) return null; // now without limit
  if (saw === null || current === null) return want; // a limit was just set
  return Math.max(0, current + (want - saw)); // the difference; a retry stops at saveKey
}

/** Rows matched by (size, color): update in place, never delete and re-insert. */
export function diffVariants(
  existing: { id: number; size: string; color: string; stock: number | null }[],
  incoming: VariantRow[],
): {
  create: {
    size: string;
    color: string;
    price: string;
    stock: number | null;
    order: number;
  }[];
  update: {
    id: number;
    price: string;
    stock: number | null;
    order: number;
  }[];
  remove: number[];
} {
  const left = new Map(existing.map((v) => [variantKey(v), v]));
  const diff: ReturnType<typeof diffVariants> = {
    create: [],
    update: [],
    remove: [],
  };
  for (const row of incoming) {
    const { size, color, price, order } = row;
    const match = left.get(variantKey(row));
    if (!match) {
      diff.create.push({ size, color, price, stock: row.stock ?? null, order });
      continue;
    }
    left.delete(variantKey(row));
    const stock = applyStockEdit(match.stock, row.stockSeen, row.stock);
    diff.update.push({ id: match.id, price, stock, order });
  }
  diff.remove = [...left.values()].map((v) => v.id);
  return diff;
}

export const topOrder = (min: number | null) => (min === null ? 0 : min - 1);

/** Hands the existing values to the ids in their new order. Works on any subset, so hidden rows stay. */
export function redistribute(
  ids: number[],
  rows: { id: number; order: number }[],
): { id: number; order: number }[] {
  const current = new Map(rows.map((r) => [r.id, r.order]));
  const known = ids.filter((id) => current.has(id));
  const values = known.map((id) => current.get(id)!).sort((a, b) => a - b);
  // Two creates can tie on min - 1. Without this, swapping tied rows would do nothing.
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) values[i] = values[i - 1] + 1;
  }
  return known
    .map((id, i) => ({ id, order: values[i] }))
    .filter((row) => current.get(row.id) !== row.order);
}

const MAX_TELEGRAM_ID = 2n ** 63n - 1n; // BIGINT column bound

/** Port of parse_member_values: ids and @usernames, deduped, and what it refused. */
export function parseMemberValues(raw: string): {
  members: { telegramId?: bigint; username?: string }[];
  refused: string[];
} {
  const members: { telegramId?: bigint; username?: string }[] = [];
  const refused: string[] = [];
  const seen = new Set<string>();
  for (const value of raw.split(/[\s,;]+/).filter(Boolean)) {
    const telegramId = /^\d{1,19}$/.test(value) ? BigInt(value) : null;
    const username = value.replace(/^@+/, '').toLowerCase();
    const valid =
      telegramId === null
        ? /^[a-z][a-z0-9_]{4,31}$/.test(username)
        : telegramId <= MAX_TELEGRAM_ID;
    if (!valid) {
      refused.push(value);
      continue;
    }
    const key = telegramId === null ? username : `#${telegramId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    members.push(telegramId === null ? { username } : { telegramId });
  }
  return { members, refused };
}

/** null or the Ukrainian text. */
export function templateProblem(dto: {
  sizes: string[];
  colors: string[];
  prices: { size: string; color: string; price: string }[];
}): string | null {
  if (!dto.prices.length) return 'Вкажіть хоча б одну ціну';
  for (const { size, color, price } of dto.prices) {
    const knownColor = dto.colors.length
      ? dto.colors.includes(color)
      : color === '';
    if (!dto.sizes.includes(size) || !knownColor) {
      return 'Ціна для варіанта, якого немає в шаблоні';
    }
    if (!(toKopecks(price) > 0)) {
      return `Некоректна ціна для розміру ${sizeName(size)}`;
    }
  }
  return null;
}

// ---- Bot inputs and Telegram failures -------------------------------------

export type StartPayload =
  | { kind: 'link'; token: string }
  | { kind: 'item'; id: number }
  | { kind: 'plain' };

/** link_<32hex>, item_<digits up to 9>; anything else is plain. */
export function parseStart(payload: string): StartPayload {
  const link = /^link_([0-9a-f]{32})$/.exec(payload);
  if (link) return { kind: 'link', token: link[1] };
  const item = /^item_(\d{1,9})$/.exec(payload);
  return item ? { kind: 'item', id: Number(item[1]) } : { kind: 'plain' };
}

/** "/setthreads orders:633 support:629" without the command; 0 means clear. Empty object when nothing parsed. */
export function parseThreads(text: string): {
  orders?: number | null;
  support?: number | null;
} {
  const threads: { orders?: number | null; support?: number | null } = {};
  for (const arg of text.trim().split(/\s+/)) {
    const match = /^(orders|support):(\d{1,9})$/.exec(arg);
    if (match) {
      threads[match[1] as 'orders' | 'support'] = Number(match[2]) || null;
    }
  }
  return threads;
}

/** Confirm buttons carry their own timestamp, so a restart changes nothing. */
export const isFreshConfirm = (sentAt: number, now: number, ttl: number) =>
  now - sentAt <= ttl;

/** The user id from the header of a support message. Anchored: a #T in a name or a caption proves nothing. */
export const supportTarget = (text: string) =>
  /^📩[^\n]*\n#T(\d+)\n/.exec(text)?.[1] ?? null;

/** Comma list, invalid chunks skipped. */
export const parseOwnerIds = (raw: string | undefined): number[] =>
  (raw ?? '')
    .split(',')
    .map((chunk) => chunk.trim())
    .filter((chunk) => /^\d+$/.test(chunk))
    .map(Number);

export type TgFailure =
  | { kind: 'rate'; seconds: number } // 429
  | { kind: 'blocked' } // 403
  | { kind: 'migrated'; chatId: number } // 400 with parameters.migrate_to_chat_id
  | { kind: 'thread' } // message thread not found, TOPIC_CLOSED
  | { kind: 'unchanged' } // message is not modified
  | { kind: 'wrongEdit' } // no caption or no text in the message to edit
  | { kind: 'gone' } // message to edit not found, chat not found, other 400
  | { kind: 'media' } // PHOTO_*, IMAGE_PROCESS_FAILED, wrong file identifier, ENOENT
  | { kind: 'retry' }; // network, 5xx, anything unknown

/**
 * Reads the fields of a GrammyError by name, so this file stays free of grammY.
 * Unknown errors are `retry`: being wrong there costs a repeat, being wrong the
 * other way costs a lost card.
 */
export function telegramFailure(err: unknown): TgFailure {
  const e = (err ?? {}) as {
    error_code?: number;
    description?: string;
    parameters?: { retry_after?: number; migrate_to_chat_id?: number };
    code?: string;
    error?: { code?: string }; // grammY's HttpError wraps what fetch threw
  };
  if (e.code === 'ENOENT' || e.error?.code === 'ENOENT') {
    return { kind: 'media' };
  }
  if (e.error_code === 429) {
    return { kind: 'rate', seconds: e.parameters?.retry_after ?? 1 };
  }
  if (e.error_code === 403) return { kind: 'blocked' };
  if (e.error_code !== 400) return { kind: 'retry' };
  const chatId = e.parameters?.migrate_to_chat_id;
  if (chatId) return { kind: 'migrated', chatId };
  const text = e.description ?? '';
  if (/message thread not found|TOPIC_/i.test(text)) return { kind: 'thread' };
  if (/message is not modified/i.test(text)) return { kind: 'unchanged' };
  if (/no (caption|text) in the message to edit/i.test(text)) {
    return { kind: 'wrongEdit' };
  }
  if (/PHOTO_|IMAGE_PROCESS_FAILED|wrong file identifier/i.test(text)) {
    return { kind: 'media' };
  }
  return { kind: 'gone' };
}

/** A wrong /setthreads must not lose anything: one more try in General. */
export async function inThread<T>(
  thread: number | null,
  send: (thread?: number) => Promise<T>,
  logger: { warn(text: string): void },
): Promise<T> {
  try {
    return await send(thread ?? undefined);
  } catch (err) {
    if (!thread || telegramFailure(err).kind !== 'thread') throw err;
    logger.warn(`Merch thread ${thread} refused, sending to General.`);
    return send();
  }
}
