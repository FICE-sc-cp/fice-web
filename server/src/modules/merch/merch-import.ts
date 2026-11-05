import type { MerchDeliveryMethod, MerchOrderStatus } from '@prisma/client';
import {
  isTime,
  NO_SIZE,
  normalizePhone,
  slotDate,
  TRANSITIONS,
} from './merch-rules';

// The pure half of scripts/import-merch.ts. `pg` hands bigint and numeric over
// as strings, so telegram ids and money stay exact, and selectExpr makes text
// of every timestamp.

export const PREORDER_TAG = 'Передзамовлення';

export const DEFAULT_NO_SIZE = [
  'ONE',
  'ONE SIZE',
  'ONESIZE',
  'UNI',
  'UNIVERSAL',
  'STANDARD',
  '-',
  'УНІВЕРСАЛЬНИЙ',
  'СТАНДАРТ',
  'ОДИН РОЗМІР',
];

export interface OldProduct {
  id: number;
  title: string;
  description: string;
  photo_file_id: string | null;
  photo_black_file_id: string | null;
  is_active: boolean;
  requires_color: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OldVariant {
  id: number;
  product_id: number;
  size: string;
  color: string | null;
  price: string;
  stock_quantity: number | null;
}

export interface OldOrder {
  id: number;
  telegram_id: string;
  status: string;
  delivery_method: string | null;
  address: string;
  phone: string;
  recipient_name: string | null;
  total_amount: string;
  currency: string;
  receipt_photo_id: string | null;
  admin_message_id: number | null;
  processed_by_admin: string | null;
  pickup_slot_id: number | null;
  needs_individual_pickup: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OldItem {
  id: number;
  order_id: number;
  product_id: number | null;
  title: string;
  size: string;
  color: string | null;
  unit_price: string;
  quantity: number;
}

export interface OldProfile {
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
}

export interface OldRecipient {
  id: number;
  telegram_id: string;
  full_name: string;
  phone: string;
  is_default: boolean;
  created_at: string | null;
}

export interface OldBinding {
  id: number;
  chat_id: string;
  title: string;
  is_active: boolean;
  orders_thread_id: number | null;
  support_thread_id: number | null;
}

export interface OldConfig {
  id: number;
  welcome_text: string;
  currency: string;
  mono_jar_url: string;
  card_number: string | null;
  is_dayf_delivery_enabled: boolean | null;
}

export interface OldGroup {
  id: number;
  name: string;
  created_at: string | null;
}

export interface OldMember {
  id: number;
  group_id: number;
  telegram_id: string | null;
  username: string | null;
  created_at: string | null;
}

export interface OldVisibility {
  id: number;
  product_id: number;
  group_id: number;
}

export interface OldSlot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface OldData {
  products: OldProduct[];
  product_variants: OldVariant[];
  orders: OldOrder[];
  order_items: OldItem[];
  user_profiles: OldProfile[];
  recipients: OldRecipient[];
  admin_chat_bindings: OldBinding[];
  shop_configs: OldConfig[];
  user_groups: OldGroup[];
  user_group_members: OldMember[];
  product_visibility: OldVisibility[];
  pickup_slots: OldSlot[];
}

/** What is read, table by table. These twelve tables are also the proof of production. */
export const OLD_COLUMNS: Record<keyof OldData, string[]> = {
  products: [
    'id',
    'title',
    'description',
    'photo_file_id',
    'photo_black_file_id',
    'is_active',
    'requires_color',
    'created_at',
    'updated_at',
  ],
  product_variants: [
    'id',
    'product_id',
    'size',
    'color',
    'price',
    'stock_quantity',
  ],
  orders: [
    'id',
    'telegram_id',
    'status',
    'delivery_method',
    'address',
    'phone',
    'recipient_name',
    'total_amount',
    'currency',
    'receipt_photo_id',
    'admin_message_id',
    'processed_by_admin',
    'pickup_slot_id',
    'needs_individual_pickup',
    'created_at',
    'updated_at',
  ],
  order_items: [
    'id',
    'order_id',
    'product_id',
    'title',
    'size',
    'color',
    'unit_price',
    'quantity',
  ],
  user_profiles: [
    'telegram_id',
    'username',
    'first_name',
    'last_name',
    'created_at',
  ],
  recipients: [
    'id',
    'telegram_id',
    'full_name',
    'phone',
    'is_default',
    'created_at',
  ],
  admin_chat_bindings: [
    'id',
    'chat_id',
    'title',
    'is_active',
    'orders_thread_id',
    'support_thread_id',
  ],
  shop_configs: [
    'id',
    'welcome_text',
    'currency',
    'mono_jar_url',
    'card_number',
    'is_dayf_delivery_enabled',
  ],
  user_groups: ['id', 'name', 'created_at'],
  user_group_members: [
    'id',
    'group_id',
    'telegram_id',
    'username',
    'created_at',
  ],
  product_visibility: ['id', 'product_id', 'group_id'],
  pickup_slots: ['id', 'date', 'start_time', 'end_time', 'is_active'],
};

export const missingTables = (present: Set<string>): string[] =>
  Object.keys(OLD_COLUMNS).filter((table) => !present.has(table));

export function selectExpr(column: string, dataType?: string): string {
  if (!dataType) return `NULL AS "${column}"`; // column added later than this DB
  if (dataType === 'USER-DEFINED') return `"${column}"::text AS "${column}"`; // enums as text
  if (dataType.startsWith('timestamp') || dataType === 'date') {
    return `("${column}"::timestamp)::text AS "${column}"`;
  }
  return `"${column}"`;
}

/** The UTC session makes both timestamp and timestamptz read as UTC wall clock text. */
export const parseOldTime = (text: string | null): Date | null =>
  text ? new Date(text.replace(' ', 'T') + 'Z') : null;

const oldTime = (text: string | null) => parseOldTime(text) ?? undefined;

export function mapStatus(text: string): MerchOrderStatus {
  const status = text.toUpperCase();
  if (!(status in TRANSITIONS)) {
    throw new Error(`Unknown order status: ${text}`);
  }
  return status as MerchOrderStatus;
}

const DELIVERIES: MerchDeliveryMethod[] = [
  'NOVA_POSHTA',
  'CAMPUS',
  'DAYF',
  'LATER_CAMPUS',
];

export function mapDelivery(text: string | null): MerchDeliveryMethod | null {
  if (text === null) return null;
  const delivery = text.toUpperCase() as MerchDeliveryMethod;
  if (!DELIVERIES.includes(delivery)) {
    throw new Error(`Unknown delivery method: ${text}`);
  }
  return delivery;
}

const aliasOf = (size: string) => size.trim().toUpperCase();

/**
 * Rows of one product. color = requires_color ? (color ?? '') : ''. stock < 0 becomes 0.
 * Duplicates: lowest id wins. A product whose variants all share one size listed in noSize gets NO_SIZE.
 * A real size such as M is never rewritten. order = sizeIndex * 100 + colorIndex, first-seen order.
 */
export function normalizeOldVariants(
  rows: OldVariant[],
  requiresColor: boolean,
  noSize: string[],
) {
  const seen = new Set<string>();
  const kept: (OldVariant & { color: string })[] = [];
  const dropped: OldVariant[] = [];
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    const color = requiresColor ? (row.color ?? '') : '';
    const key = JSON.stringify([row.size, color]);
    if (seen.has(key)) {
      dropped.push(row);
      continue;
    }
    seen.add(key);
    kept.push({ ...row, color });
  }

  const badPrice = kept.find((r) => Number(r.price) < 0);
  if (badPrice) {
    throw new Error(
      `product_variants row ${badPrice.id}: price ${badPrice.price} is below 0`,
    );
  }

  const sizes = [...new Set(kept.map((r) => r.size))];
  const colors = [...new Set(kept.map((r) => r.color))];
  const aliases = noSize.map(aliasOf);
  const dummy = sizes.length === 1 && aliases.includes(aliasOf(sizes[0]));
  const stored = (size: string) => (dummy ? NO_SIZE : size);
  return {
    rows: kept.map((r) => ({
      size: stored(r.size),
      color: r.color,
      price: r.price,
      stock: r.stock_quantity === null ? null : Math.max(r.stock_quantity, 0),
      order: sizes.indexOf(r.size) * 100 + colors.indexOf(r.color),
    })),
    sizeMap: new Map(sizes.map((size) => [size, stored(size)])), // raw size to stored size, for order items
    dropped,
    clamped: kept.filter((r) => (r.stock_quantity ?? 0) < 0) as OldVariant[],
  };
}

const OPEN_STATUSES: MerchOrderStatus[] = [
  'PENDING',
  'IN_PROCESS',
  'READY_FOR_PICKUP',
];

/** Open orders really took stock at the old checkout, so a later cancel returns it, once.
 *  Unlimited or unmatched variants took nothing we can give back. */
// ponytail: a variant clamped from negative stock gains one phantom unit per cancel of such an
// order. The report lists those variants; the owner sets real numbers, no ledger of the debt.
export const stockTakenFor = (
  status: MerchOrderStatus,
  quantity: number,
  variantStock: number | null | undefined,
) => (OPEN_STATUSES.includes(status) && variantStock != null ? quantity : 0);

export function photoTargets(
  p: Pick<
    OldProduct,
    'requires_color' | 'photo_file_id' | 'photo_black_file_id'
  >,
  colors: string[],
): { fileId: string; color: string }[] {
  const main = p.photo_file_id;
  const black = p.photo_black_file_id;
  if (!p.requires_color) return main ? [{ fileId: main, color: '' }] : [];

  const targets: { fileId: string; color: string }[] = [];
  const mainColor = colors.includes('Білий')
    ? 'Білий'
    : (colors.find((c) => c !== 'Чорний') ?? (black ? undefined : colors[0]));
  if (main && mainColor !== undefined) {
    targets.push({ fileId: main, color: mainColor });
  }
  if (black && colors.includes('Чорний')) {
    targets.push({ fileId: black, color: 'Чорний' });
  }
  return targets;
}

/** Lowercase, without @. The old shop's _normalize_username. */
/** The target says whose photo it is: `files` may be a row of the last run, on another product. */
export const photoRow = (
  {
    productId,
    color,
    fileId,
  }: { productId: number; color: string; fileId: string },
  files: { url: string; thumbUrl: string },
) => ({
  productId,
  color,
  sourceFileId: fileId,
  url: files.url,
  thumbUrl: files.thumbUrl,
});

export const cleanUsername = (value: string | null): string | null =>
  value?.trim().replace(/^@+/, '').trim().toLowerCase() || null;

/** First row of each (telegramId, fullName, phone) keeps its id. The newest default stays the only one. */
export function mergeRecipients(rows: OldRecipient[]) {
  const kept = new Map<
    string,
    {
      id: number;
      telegramId: bigint;
      fullName: string;
      phone: string;
      isDefault: boolean;
      createdAt?: Date;
    }
  >();
  const defaults = new Map<string, { isDefault: boolean }>();
  for (const row of rows) {
    const phone = normalizePhone(row.phone) ?? row.phone;
    const key = JSON.stringify([row.telegram_id, row.full_name, phone]);
    const recipient = kept.get(key) ?? {
      id: row.id,
      telegramId: BigInt(row.telegram_id),
      fullName: row.full_name,
      phone,
      isDefault: false,
      createdAt: oldTime(row.created_at),
    };
    kept.set(key, recipient);
    if (row.is_default) defaults.set(row.telegram_id, recipient);
  }
  for (const recipient of defaults.values()) recipient.isDefault = true;
  return { rows: [...kept.values()], merged: rows.length - kept.size };
}

/** Exactly one identity per row: a telegram id beats a username, a row with neither is skipped. */
export function mergeMembers(rows: OldMember[]) {
  const kept = new Map<
    string,
    {
      groupId: number;
      telegramId: bigint | null;
      username: string | null;
      createdAt?: Date;
    }
  >();
  let skipped = 0;
  for (const row of rows) {
    const username = row.telegram_id ? null : cleanUsername(row.username);
    if (!row.telegram_id && !username) {
      skipped++;
      continue;
    }
    const key = JSON.stringify([row.group_id, row.telegram_id, username]);
    kept.set(key, {
      groupId: row.group_id,
      telegramId: row.telegram_id ? BigInt(row.telegram_id) : null,
      username,
      createdAt: oldTime(row.created_at),
    });
  }
  return {
    rows: [...kept.values()],
    merged: rows.length - kept.size - skipped,
    skipped,
  };
}

export function mapOrder(o: OldOrder, slotIds: Set<number>) {
  const status = mapStatus(o.status);
  return {
    id: o.id,
    telegramId: BigInt(o.telegram_id),
    status,
    deliveryMethod: mapDelivery(o.delivery_method),
    address: o.address,
    phone: o.phone,
    recipientName: o.recipient_name,
    totalAmount: o.total_amount,
    currency: o.currency,
    receiptFileId: o.receipt_photo_id,
    adminMessageId: o.admin_message_id,
    processedByAdmin: o.processed_by_admin,
    // The old shop kept only the taker; the sheet and a rebuilt card read this.
    statusBy: status === 'CANCELLED' ? null : o.processed_by_admin,
    pickupSlotId:
      o.pickup_slot_id !== null && slotIds.has(o.pickup_slot_id)
        ? o.pickup_slot_id
        : null,
    needsIndividualPickup: o.needs_individual_pickup ?? false,
    createdAt: oldTime(o.created_at),
    updatedAt: oldTime(o.updated_at),
  };
}

const goodTimes = (s: OldSlot) => isTime(s.start_time) && isTime(s.end_time);

export const mapSlot = (s: OldSlot) => ({
  id: s.id,
  date: slotDate(s.date.slice(0, 10)),
  startTime: isTime(s.start_time) ? s.start_time : '00:00',
  endTime: isTime(s.end_time) ? s.end_time : '00:00',
  isActive: s.is_active && goodTimes(s),
});

/** The newest active binding; thread id 0 means General, which is null here. */
export function pickBinding(rows: OldBinding[]) {
  const active = rows.filter((b) => b.is_active).sort((a, b) => b.id - a.id);
  const chat = active[0];
  return {
    active: active.length,
    chat: chat && {
      adminChatId: BigInt(chat.chat_id),
      adminChatTitle: chat.title,
      ordersThreadId: chat.orders_thread_id || null,
      supportThreadId: chat.support_thread_id || null,
    },
  };
}

/** The setval arguments for a table that keeps its old ids. A /clear_orders gap survives,
 *  so a number once given to a customer is never given again. */
export function sequenceTarget(
  seq: { last_value: string | number; is_called: boolean } | null,
  maxId: number,
): { value: number; called: boolean } {
  const last = Number(seq?.last_value ?? 1);
  return {
    value: Math.max(last, maxId),
    called: (seq?.is_called ?? false) || maxId >= last,
  };
}

export function isImageBytes(data: Buffer): boolean {
  const jpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.toString('latin1', 0, 8) === '\x89PNG\r\n\x1a\n';
  const webp =
    data.toString('latin1', 0, 4) === 'RIFF' &&
    data.toString('latin1', 8, 12) === 'WEBP';
  return jpeg || png || webp;
}

export const variantKey = (productId: number, size: string, color: string) =>
  JSON.stringify([productId, size, color]);

/** Everything the import writes, and what the report says about it. Throws on a value it must not guess. */
export function planImport(old: OldData, noSize: string[]) {
  const variantsOf = new Map<number, OldVariant[]>();
  for (const v of old.product_variants) {
    const rows = variantsOf.get(v.product_id);
    if (rows) rows.push(v);
    else variantsOf.set(v.product_id, [v]);
  }

  const sizeMaps = new Map<number, Map<string, string>>();
  const stockOf = new Map<string, number | null>();
  const variants: ({ productId: number } & ReturnType<
    typeof normalizeOldVariants
  >['rows'][number])[] = [];
  const targets: { productId: number; fileId: string; color: string }[] = [];
  const preorderProductIds: number[] = [];
  const droppedVariants: { productId: number; size: string }[] = [];
  const clampedStock: {
    productId: number;
    size: string;
    color: string;
    stock: number | null;
  }[] = [];
  const ignoredPhotos: number[] = [];
  const sizeHistogram: Record<string, number> = {};

  for (const p of old.products) {
    const rows = variantsOf.get(p.id) ?? [];
    const n = normalizeOldVariants(rows, !!p.requires_color, noSize);
    sizeMaps.set(p.id, n.sizeMap);
    for (const row of n.rows) {
      variants.push({ productId: p.id, ...row });
      stockOf.set(variantKey(p.id, row.size, row.color), row.stock);
    }
    if (n.rows.some((row) => row.stock === null)) {
      preorderProductIds.push(p.id);
    }
    for (const r of n.dropped) {
      droppedVariants.push({ productId: p.id, size: r.size });
    }
    for (const r of n.clamped) {
      clampedStock.push({
        productId: p.id,
        size: r.size,
        color: r.color ?? '',
        stock: r.stock_quantity,
      });
    }
    if (n.sizeMap.size === 1) {
      const [size] = n.sizeMap.keys();
      sizeHistogram[size] = (sizeHistogram[size] ?? 0) + 1;
    }

    const colors = [...new Set(n.rows.map((row) => row.color))];
    const photos = photoTargets(p, colors);
    targets.push(...photos.map((t) => ({ productId: p.id, ...t })));
    const unused = [p.photo_file_id, p.photo_black_file_id].some(
      (id) => id && !photos.some((t) => t.fileId === id),
    );
    if (unused) ignoredPhotos.push(p.id);
  }

  const products = new Map(old.products.map((p) => [p.id, p]));
  const groupIds = new Set(old.user_groups.map((g) => g.id));
  const pairs = new Map<string, { productId: number; groupId: number }>();
  const skippedVisibility: { productId: number; groupId: number }[] = [];
  for (const v of old.product_visibility) {
    const pair = { productId: v.product_id, groupId: v.group_id };
    const key = JSON.stringify(pair);
    if (
      products.has(v.product_id) &&
      groupIds.has(v.group_id) &&
      !pairs.has(key)
    ) {
      pairs.set(key, pair);
    } else {
      skippedVisibility.push(pair);
    }
  }

  const known = new Set(old.user_profiles.map((p) => p.telegram_id));
  const stubs = [
    ...new Set(
      [...old.orders, ...old.recipients].map((row) => row.telegram_id),
    ),
  ].filter((id) => !known.has(id));

  const slotIds = new Set(old.pickup_slots.map((s) => s.id));
  const orders = old.orders.map((o) => mapOrder(o, slotIds));
  const statusOf = new Map(orders.map((o) => [o.id, o.status]));
  const inFlightOrders: Record<string, number> = {};
  for (const { status } of orders) {
    if (OPEN_STATUSES.includes(status)) {
      inFlightOrders[status] = (inFlightOrders[status] ?? 0) + 1;
    }
  }

  const items = old.order_items.map((item) => {
    if (item.quantity < 1) {
      throw new Error(
        `order_items row ${item.id}: quantity ${item.quantity} is below 1`,
      );
    }
    const product =
      item.product_id === null ? undefined : products.get(item.product_id);
    const size = product
      ? (sizeMaps.get(product.id)?.get(item.size) ?? item.size)
      : item.size;
    const color = item.color ?? '';
    // A product without colours stores '', whatever its old lines say.
    const key = product
      ? variantKey(product.id, size, product.requires_color ? color : '')
      : null;
    return {
      orderId: item.order_id,
      productId: product?.id ?? null,
      title: item.title,
      size,
      color,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      stockTaken: stockTakenFor(
        statusOf.get(item.order_id) as MerchOrderStatus,
        item.quantity,
        key === null ? undefined : stockOf.get(key),
      ),
      variantKey: key,
    };
  });

  const recipients = mergeRecipients(old.recipients);
  const members = mergeMembers(old.user_group_members);
  const binding = pickBinding(old.admin_chat_bindings);
  const config = old.shop_configs.find((c) => c.id === 1);

  return {
    config: config && {
      welcomeText: config.welcome_text,
      currency: config.currency,
      monoJarUrl: config.mono_jar_url,
      cardNumber: config.card_number,
      dayfEnabled: config.is_dayf_delivery_enabled ?? false,
    },
    chat: binding.chat,
    customers: [
      ...old.user_profiles.map((p) => ({
        telegramId: BigInt(p.telegram_id),
        username: cleanUsername(p.username),
        firstName: p.first_name,
        lastName: p.last_name,
        createdAt: oldTime(p.created_at),
      })),
      ...stubs.map((id) => ({ telegramId: BigInt(id) })),
    ],
    groups: old.user_groups.map((g) => ({
      id: g.id,
      name: g.name,
      createdAt: oldTime(g.created_at),
    })),
    members: members.rows,
    products: old.products.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      isActive: p.is_active,
      order: -p.id,
      categoryId: null,
      createdAt: oldTime(p.created_at),
      updatedAt: oldTime(p.updated_at),
    })),
    variants,
    productGroups: [...pairs.values()],
    preorderProductIds,
    photoTargets: targets,
    recipients: recipients.rows,
    slots: old.pickup_slots.map(mapSlot),
    orders,
    items,
    notes: {
      customerStubs: stubs.length,
      mergedRecipients: recipients.merged,
      mergedMembers: members.merged,
      skippedMembers: members.skipped,
      skippedVisibility,
      droppedVariants,
      clampedStock,
      badSlots: old.pickup_slots.filter((s) => !goodTimes(s)).map((s) => s.id),
      danglingSlotRefs: old.orders.filter(
        (o) => o.pickup_slot_id !== null && !slotIds.has(o.pickup_slot_id),
      ).length,
      activeBindings: binding.active,
      ignoredPhotos,
      sizeHistogram,
      inFlightOrders,
      activeWithoutVariants: old.products
        .filter((p) => p.is_active && !variantsOf.has(p.id))
        .map((p) => p.id),
    },
  };
}

export type ImportPlan = ReturnType<typeof planImport>;
