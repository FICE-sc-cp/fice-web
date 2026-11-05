/**
 * Moves the old merch shop into this database. One repeatable run that replaces
 * whatever the last run wrote, and a dry run unless --apply is given.
 *
 *   npx ts-node --transpile-only scripts/import-merch.ts [--apply] [--skip-photos] [--no-size=ONE,...]
 *
 * Env: OLD_MERCH_DATABASE_URL, OLD_MERCH_BOT_TOKEN, DATABASE_URL, UPLOAD_DIR.
 * No dotenv on purpose: every variable comes from the command line, so a stray
 * server/.env can change nothing. Progress goes to stderr, the report to stdout.
 * Exit code: 0 clean, 1 refused or mismatch, 2 clean with listed problems (photos).
 */
import { randomUUID } from 'crypto';
import {
  copyFile,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'fs/promises';
import { basename, join } from 'path';
import { setTimeout as sleep } from 'timers/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { errorMessage } from '../src/common/log-safe';
import {
  DEFAULT_NO_SIZE,
  ImportPlan,
  isImageBytes,
  missingTables,
  OLD_COLUMNS,
  OldData,
  photoRow,
  planImport,
  PREORDER_TAG,
  selectExpr,
  sequenceTarget,
  variantKey,
} from '../src/modules/merch/merch-import';
import { toKopecks } from '../src/modules/merch/merch-rules';
import { imageDimensions } from '../src/upload/image-dimensions';
import { reencodeImage } from '../src/upload/image-processing';
import { OWN_IMAGE_URL, ownUploadExists } from '../src/upload/own-upload';
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from '../src/upload/upload.constants';

const BATCH = 500;
const TELEGRAM_PAUSE_MS = 100;
const TELEGRAM_TRIES = 3;
const FETCH_TIMEOUT_MS = 60_000;
const THUMB_PROFILE = { maxDimension: 640, quality: 80 };
// Local checks point this at a fake. Never set in compose.
const TELEGRAM = process.env.MERCH_BOT_API_ROOT ?? 'https://api.telegram.org';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const skipPhotos = args.includes('--skip-photos');
const noSizeArg = args.find((a) => a.startsWith('--no-size='));
const noSize =
  noSizeArg?.slice('--no-size='.length).split(',') ?? DEFAULT_NO_SIZE;

const host = (url: string) => new URL(url).hostname;
const maxId = (rows: { id: number }[]) =>
  rows.reduce((max, row) => Math.max(max, row.id), 0);

type Sequence = { last_value: string; is_called: boolean } | null;

interface OldFacts {
  counts: Record<string, number>;
  statuses: { status: string; count: number; sum: string }[];
  quantity: string;
  fractionalPrices: number;
  enums: Record<string, string[]>;
  ordersSeq: Sequence;
  productsSeq: Sequence;
}

async function readTable(
  old: Client,
  table: string,
  columns: string[],
  drift: string[],
) {
  const { rows: meta } = await old.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  const types = new Map<string, string>(
    meta.map((c) => [c.column_name, c.data_type]),
  );
  for (const c of columns) {
    if (!types.has(c)) drift.push(`${table}.${c} is missing`);
  }
  const list = columns.map((c) => selectExpr(c, types.get(c))).join(', ');
  return (await old.query(`SELECT ${list} FROM ${table} ORDER BY id`)).rows;
}

async function oldSequence(old: Client, table: string, drift: string[]) {
  const { rows } = await old.query(
    `SELECT pg_get_serial_sequence($1, 'id') AS name`,
    [table],
  );
  if (!rows[0].name) {
    drift.push(`${table}.id has no sequence`);
    return null;
  }
  return (await old.query(`SELECT last_value, is_called FROM ${rows[0].name}`))
    .rows[0];
}

/** Rows and aggregates from one snapshot, so the comparison after the write
 *  holds while a sale goes on: the sale is simply not in this snapshot. */
// ponytail: every old row in memory at once. A shop's worth of rows fits the one-off container's
// 1 GB by far; page through the tables if it ever does not.
async function readOld(old: Client, counts: Record<string, number>) {
  const drift: string[] = [];
  const data = {} as OldData;
  for (const [table, columns] of Object.entries(OLD_COLUMNS)) {
    data[table] = await readTable(old, table, columns, drift);
  }
  const facts: OldFacts = {
    counts,
    statuses: (
      await old.query(
        `SELECT upper(status::text) AS status, count(*)::int AS count,
                sum(total_amount)::numeric(14, 2)::text AS sum
           FROM orders GROUP BY 1 ORDER BY 1`,
      )
    ).rows,
    quantity: (
      await old.query(
        `SELECT coalesce(sum(quantity), 0)::text AS sum FROM order_items`,
      )
    ).rows[0].sum,
    fractionalPrices: (
      await old.query(
        `SELECT count(*)::int AS n FROM product_variants WHERE price <> trunc(price)`,
      )
    ).rows[0].n,
    // pg_enum, not enum_range: a missing type must not abort the snapshot.
    enums: Object.fromEntries(
      (
        await old.query(
          `SELECT t.typname::text AS name,
                  array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
             FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname IN ('orderstatus', 'deliverymethod')
            GROUP BY 1 ORDER BY 1`,
        )
      ).rows.map((row) => [row.name, row.labels]),
    ),
    ordersSeq: await oldSequence(old, 'orders', drift),
    productsSeq: await oldSequence(old, 'products', drift),
  };
  return { data, drift, facts };
}

async function telegramFile(token: string, fileId: string): Promise<Buffer> {
  const signal = () => AbortSignal.timeout(FETCH_TIMEOUT_MS);
  for (let attempt = 1; ; attempt++) {
    let pause = TELEGRAM_PAUSE_MS;
    try {
      const res = await fetch(
        `${TELEGRAM}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
        { signal: signal() },
      );
      const body: any = await res.json();
      if (!body.ok) {
        const retryAfter = body.parameters?.retry_after;
        if (retryAfter) pause = retryAfter * 1000;
        throw new Error(body.description ?? `getFile answered ${res.status}`);
      }
      const file = await fetch(
        `${TELEGRAM}/file/bot${token}/${body.result.file_path}`,
        { signal: signal() },
      );
      if (!file.ok) throw new Error(`download answered ${file.status}`);
      return Buffer.from(await file.arrayBuffer());
    } catch (err) {
      if (attempt >= TELEGRAM_TRIES) throw err;
      await sleep(pause);
    }
  }
}

/** Encoded in this process, so a Jimp fallback stalls nothing live. Null means use the full image. */
async function makeThumb(fullPath: string): Promise<string | null> {
  const thumb = `${randomUUID()}.jpg`;
  const thumbPath = join(UPLOAD_DIR, thumb);
  try {
    await copyFile(fullPath, thumbPath);
    await reencodeImage(thumbPath, '.jpg', THUMB_PROFILE);
    return thumb;
  } catch {
    await unlink(thumbPath).catch(() => undefined);
    return null;
  }
}

/** Telegram's bytes stay as they are. */
async function downloadPhoto(token: string, fileId: string) {
  const bytes = await telegramFile(token, fileId);
  if (!isImageBytes(bytes)) throw new Error('not a JPEG, PNG or WebP');

  const full = `${randomUUID()}.jpg`;
  const fullPath = join(UPLOAD_DIR, full);
  await writeFile(`${fullPath}.tmp`, bytes);
  await rename(`${fullPath}.tmp`, fullPath);

  const thumb = await makeThumb(fullPath);
  return {
    url: `${UPLOAD_URL_PREFIX}/${full}`,
    thumbUrl: `${UPLOAD_URL_PREFIX}/${thumb ?? full}`,
    files: thumb ? [full, thumb] : [full],
    thumbMade: thumb !== null,
  };
}

/** H5. Before the transaction: it is slow and needs no lock. */
// ponytail: a failed transaction strands this run's downloads with no PublicUpload row, so GC
// never sees them. A few files per failure; record the rows before the write if it ever matters.
async function collectPhotos(
  prisma: PrismaClient,
  plan: ImportPlan,
  token: string | undefined,
) {
  const known = new Map<string, { url: string; thumbUrl: string }>();
  const existing = await prisma.merchPhoto.findMany({
    where: { sourceFileId: { not: null } },
  });
  for (const p of existing) {
    if (
      ownUploadExists(p.url, OWN_IMAGE_URL) &&
      ownUploadExists(p.thumbUrl, OWN_IMAGE_URL)
    ) {
      known.set(p.sourceFileId as string, p);
    }
  }

  const rows: Prisma.MerchPhotoCreateManyInput[] = [];
  const files: string[] = [];
  const toDownload: { productId: number; color: string }[] = [];
  const notImported: { productId: number; color: string }[] = [];
  const failed: { productId: number; color: string; reason: string }[] = [];
  const thumbFallback: { productId: number; color: string }[] = [];
  let reused = 0;
  let downloaded = 0;

  for (const target of plan.photoTargets) {
    const { productId, color, fileId } = target;
    const seen = known.get(fileId);
    if (seen) {
      reused++;
      rows.push(photoRow(target, seen));
      continue;
    }
    if (skipPhotos) {
      notImported.push({ productId, color });
      continue;
    }
    if (!apply) {
      toDownload.push({ productId, color });
      continue;
    }
    try {
      const photo = await downloadPhoto(token as string, fileId);
      const { url, thumbUrl } = photo;
      known.set(fileId, { url, thumbUrl });
      files.push(...photo.files);
      if (!photo.thumbMade) thumbFallback.push({ productId, color });
      rows.push(photoRow(target, photo));
      downloaded++;
    } catch (err) {
      failed.push({ productId, color, reason: errorMessage(err) });
    }
    await sleep(TELEGRAM_PAUSE_MS);
  }
  console.error(`photos: ${reused} reused, ${downloaded} downloaded`);

  const uploads = await Promise.all(
    files.map(async (filename) => ({
      filename,
      size: (await stat(join(UPLOAD_DIR, filename))).size,
      ipHash: 'merch-import',
      unreferencedSince: null,
    })),
  );
  const dimensions: {
    productId: number;
    color: string;
    width: number | null;
    height: number | null;
  }[] = [];
  for (const row of rows) {
    const size = imageDimensions(
      await readFile(join(UPLOAD_DIR, basename(row.url))),
    );
    dimensions.push({
      productId: row.productId,
      color: row.color ?? '',
      width: size?.width ?? null,
      height: size?.height ?? null,
    });
  }
  return {
    rows,
    uploads,
    report: {
      targets: plan.photoTargets.length,
      imported: rows.length,
      toDownload,
      notImported,
      failed,
      thumbFallback,
      ignored: plan.notes.ignoredPhotos,
      dimensions,
    },
  };
}

async function inBatches<T>(
  rows: T[],
  write: (batch: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await write(rows.slice(i, i + BATCH));
  }
}

const setval = (
  tx: Prisma.TransactionClient,
  table: string,
  { value, called }: { value: number; called: boolean },
) =>
  tx.$queryRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), $1::bigint, $2::boolean)`,
    value,
    called,
  );

/** H6. One transaction, replace all: a partial import cannot exist, and rows
 *  deleted on the old side disappear here too. The live data guard makes it safe. */
async function writeAll(
  prisma: PrismaClient,
  plan: ImportPlan,
  photos: Awaited<ReturnType<typeof collectPhotos>>,
  facts: OldFacts,
) {
  await prisma.$transaction(
    async (tx) => {
      // Children first. Categories, templates and non-import tags are left alone.
      await tx.merchOrderItem.deleteMany();
      await tx.merchOrder.deleteMany();
      await tx.merchPickupSlot.deleteMany();
      await tx.merchRecipient.deleteMany();
      await tx.merchLink.deleteMany();
      await tx.merchCustomer.deleteMany();
      await tx.merchGroup.deleteMany(); // members and product groups cascade
      await tx.merchProduct.deleteMany(); // variants, photos, product tags cascade

      await inBatches(plan.customers, (data) =>
        tx.merchCustomer.createMany({ data }),
      );
      await inBatches(plan.groups, (data) =>
        tx.merchGroup.createMany({ data }),
      );
      await inBatches(plan.members, (data) =>
        tx.merchGroupMember.createMany({ data }),
      );
      await inBatches(plan.products, (data) =>
        tx.merchProduct.createMany({ data }),
      );
      await inBatches(plan.variants, (data) =>
        tx.merchVariant.createMany({ data }),
      );
      await inBatches(plan.productGroups, (data) =>
        tx.merchProductGroup.createMany({ data }),
      );
      const tag = await tx.merchTag.upsert({
        where: { name: PREORDER_TAG },
        create: { name: PREORDER_TAG },
        update: {},
      });
      await inBatches(plan.preorderProductIds, (ids) =>
        tx.merchProductTag.createMany({
          data: ids.map((productId) => ({ productId, tagId: tag.id })),
        }),
      );
      await inBatches(photos.rows, (data) =>
        tx.merchPhoto.createMany({ data }),
      );
      await inBatches(plan.recipients, (data) =>
        tx.merchRecipient.createMany({ data }),
      );
      await inBatches(plan.slots, (data) =>
        tx.merchPickupSlot.createMany({ data }),
      );
      await inBatches(plan.orders, (data) =>
        tx.merchOrder.createMany({ data }),
      );

      const variantIds = new Map(
        (
          await tx.merchVariant.findMany({
            select: { id: true, productId: true, size: true, color: true },
          })
        ).map((v) => [variantKey(v.productId, v.size, v.color), v.id]),
      );
      const items = plan.items.map(({ variantKey: key, ...item }) => ({
        ...item,
        variantId: key === null ? null : (variantIds.get(key) ?? null),
      }));
      await inBatches(items, (data) => tx.merchOrderItem.createMany({ data }));

      if (plan.config || plan.chat) {
        await tx.merchConfig.update({
          where: { id: 1 },
          data: { ...plan.config, ...plan.chat },
        });
      }
      await tx.publicUpload.createMany({
        data: photos.uploads,
        skipDuplicates: true,
      });

      // The old sequence, not max(id): /clear_orders leaves it ahead of the
      // rows, and a reused order number would mix up chats and the sheet.
      await setval(
        tx,
        'MerchOrder',
        sequenceTarget(facts.ordersSeq, maxId(plan.orders)),
      );
      await setval(
        tx,
        'MerchProduct',
        sequenceTarget(facts.productsSeq, maxId(plan.products)),
      );
      const kept: [string, { id: number }[]][] = [
        ['MerchGroup', plan.groups],
        ['MerchPickupSlot', plan.slots],
        ['MerchRecipient', plan.recipients],
      ];
      for (const [table, rows] of kept) {
        if (rows.length) {
          await setval(tx, table, { value: maxId(rows), called: true });
        }
      }
    },
    { timeout: 120_000 },
  );
}

const targetCounts = async (prisma: PrismaClient) => ({
  MerchCustomer: await prisma.merchCustomer.count(),
  MerchGroup: await prisma.merchGroup.count(),
  MerchGroupMember: await prisma.merchGroupMember.count(),
  MerchProduct: await prisma.merchProduct.count(),
  MerchVariant: await prisma.merchVariant.count(),
  MerchProductGroup: await prisma.merchProductGroup.count(),
  MerchPhoto: await prisma.merchPhoto.count(),
  MerchRecipient: await prisma.merchRecipient.count(),
  MerchPickupSlot: await prisma.merchPickupSlot.count(),
  MerchOrder: await prisma.merchOrder.count(),
  MerchOrderItem: await prisma.merchOrderItem.count(),
});

/** H7. The old side comes from the imported snapshot, the new side is read fresh. */
async function verify(
  prisma: PrismaClient,
  plan: ImportPlan,
  photoRows: number,
  facts: OldFacts,
) {
  const checks: {
    check: string;
    expected: unknown;
    actual: unknown;
    ok: boolean;
  }[] = [];
  const equal = (check: string, expected: unknown, actual: unknown) =>
    checks.push({
      check,
      expected,
      actual,
      ok: JSON.stringify(expected) === JSON.stringify(actual),
    });

  const c = facts.counts;
  const n = plan.notes;
  const actual = await targetCounts(prisma);
  const expected: Record<keyof typeof actual, number> = {
    MerchCustomer: c.user_profiles + n.customerStubs,
    MerchGroup: c.user_groups,
    MerchGroupMember: c.user_group_members - n.mergedMembers - n.skippedMembers,
    MerchProduct: c.products,
    MerchVariant: c.product_variants - n.droppedVariants.length,
    MerchProductGroup: c.product_visibility - n.skippedVisibility.length,
    MerchPhoto: photoRows,
    MerchRecipient: c.recipients - n.mergedRecipients,
    MerchPickupSlot: c.pickup_slots,
    MerchOrder: c.orders,
    MerchOrderItem: c.order_items,
  };
  for (const table of Object.keys(actual)) {
    equal(`rows ${table}`, expected[table], actual[table]);
  }

  const money = (rows: { status: string; count: number; sum: string }[]) =>
    rows.map((row) => ({ ...row, sum: toKopecks(row.sum) }));
  equal(
    'status, count, sum(total_amount)',
    money(facts.statuses),
    money(
      await prisma.$queryRaw`
        SELECT status::text AS status, count(*)::int AS count,
               sum("totalAmount")::numeric(14, 2)::text AS sum
          FROM "MerchOrder" GROUP BY 1 ORDER BY 1`,
    ),
  );

  const [{ sum }] = await prisma.$queryRaw<{ sum: string }[]>`
    SELECT coalesce(sum(quantity), 0)::text AS sum FROM "MerchOrderItem"`;
  equal('sum(quantity) of order items', facts.quantity, sum);

  const [seq] = await prisma.$queryRaw<
    { last_value: bigint; is_called: boolean }[]
  >`SELECT last_value, is_called FROM "MerchOrder_id_seq"`;
  const nextId = Number(seq.last_value) + (seq.is_called ? 1 : 0);
  const old = facts.ordersSeq;
  const oldNext = old
    ? Number(old.last_value) + (old.is_called ? 1 : 0)
    : maxId(plan.orders) + 1;
  checks.push({
    check: 'next MerchOrder id',
    expected: `above ${maxId(plan.orders)}, at least ${oldNext}`,
    actual: nextId,
    ok: nextId > maxId(plan.orders) && nextId >= oldNext,
  });

  const unlimited = await prisma.merchVariant.findMany({
    where: { stock: null },
    distinct: ['productId'],
    select: { productId: true },
  });
  equal(
    `${PREORDER_TAG} links`,
    unlimited.length,
    await prisma.merchProductTag.count({
      where: { tag: { name: PREORDER_TAG } },
    }),
  );

  equal(
    'dirty flags',
    0,
    await prisma.merchOrder.count({
      where: {
        OR: [{ cardDirty: true }, { notifyDirty: true }, { pickupDirty: true }],
      },
    }),
  );
  return checks;
}

const productIds = async (
  prisma: PrismaClient,
  where: Prisma.MerchProductWhereInput,
) =>
  (
    await prisma.merchProduct.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
    })
  ).map((p) => p.id);

async function main() {
  const unknown = args.find(
    (a) => !/^--(apply|skip-photos|no-size=.+)$/.test(a),
  );
  if (unknown) throw new Error(`Unknown argument: ${unknown}`);
  if (process.env.MERCH_BOT_TOKEN) {
    throw new Error(
      'MERCH_BOT_TOKEN is set: the shop is live. The import would roll orders back.',
    );
  }
  const oldUrl = process.env.OLD_MERCH_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;
  const token = process.env.OLD_MERCH_BOT_TOKEN;
  if (!oldUrl || !targetUrl) {
    throw new Error('OLD_MERCH_DATABASE_URL and DATABASE_URL are required.');
  }
  if (apply && !skipPhotos && !token) {
    throw new Error('OLD_MERCH_BOT_TOKEN is required to download photos.');
  }

  const old = new Client({ connectionString: oldUrl });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: targetUrl }),
  });
  try {
    await old.connect();
    await old.query(`SET TIME ZONE 'UTC'`);
    // One consistent snapshot, and it cannot write.
    await old.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    const { rows: tables } = await old.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const present = new Set<string>(tables.map((t) => t.table_name));
    const counts: Record<string, number> = {};
    for (const table of Object.keys(OLD_COLUMNS)) {
      if (!present.has(table)) continue;
      counts[table] = (
        await old.query(`SELECT count(*)::int AS n FROM ${table}`)
      ).rows[0].n;
    }
    console.error(`old:    ${host(oldUrl)} ${JSON.stringify(counts)}`);
    console.error(
      `target: ${host(targetUrl)} ${JSON.stringify(await targetCounts(prisma))}`,
    );

    const missing = missingTables(present);
    if (missing.length) {
      throw new Error(
        `Not the production database: table ${missing[0]} is missing. The real DATABASE_URL is in the Render dashboard.`,
      );
    }
    const liveOrders = await prisma.merchOrder.count({
      where: { clientKey: { not: null } },
    });
    if (liveOrders) {
      throw new Error('New orders exist. The import would destroy them.');
    }

    const { data, drift, facts } = await readOld(old, counts);
    // The photos can take minutes; no transaction idles on the old side meanwhile.
    await old.end();

    const plan = planImport(data, noSize);
    const photos = await collectPhotos(prisma, plan, token);
    if (apply) await writeAll(prisma, plan, photos, facts);

    const checks = apply
      ? await verify(prisma, plan, photos.rows.length, facts)
      : undefined;

    const n = plan.notes;
    const covered = new Set<number>(
      [...photos.rows, ...photos.report.toDownload].map((p) => p.productId),
    );
    const activeWithoutPhoto = apply
      ? await productIds(prisma, { isActive: true, photos: { none: {} } })
      : plan.products
          .filter((p) => p.isActive && !covered.has(p.id))
          .map((p) => p.id);
    const chatId = apply
      ? (await prisma.merchConfig.findUnique({ where: { id: 1 } }))?.adminChatId
      : plan.chat?.adminChatId;

    const report = {
      mode: apply ? 'apply' : 'dry-run',
      noSize,
      drift,
      merged: {
        variants: n.droppedVariants,
        recipients: n.mergedRecipients,
        members: n.mergedMembers,
      },
      skipped: { members: n.skippedMembers, visibility: n.skippedVisibility },
      customerStubs: n.customerStubs,
      danglingSlotRefs: n.danglingSlotRefs,
      badSlots: n.badSlots,
      clampedStock: n.clampedStock,
      sizeHistogram: n.sizeHistogram,
      fractionalPrices: facts.fractionalPrices,
      enums: facts.enums,
      inFlightOrders: n.inFlightOrders,
      activeBindings: n.activeBindings,
      adminChat: {
        bound: chatId != null,
        sameAsAdminGroup:
          chatId != null && String(chatId) === process.env.ADMIN_GROUP_CHAT_ID,
      },
      photos: photos.report,
      activeWithoutPhoto,
      activeWithoutVariants: apply
        ? await productIds(prisma, { isActive: true, variants: { none: {} } })
        : n.activeWithoutVariants,
      ...(checks && { checks }),
    };
    console.log(JSON.stringify(report, null, 2));

    if (checks?.some((c) => !c.ok)) process.exitCode = 1;
    else if (
      apply &&
      (photos.report.failed.length || activeWithoutPhoto.length)
    ) {
      process.exitCode = 2;
    }
  } finally {
    await old.end();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(errorMessage(err));
  process.exitCode = 1;
});
