import type { PrismaClient } from '@prisma/client';

type Db = Pick<PrismaClient, '$queryRaw'>;

export function normalizeStaffTags(tags?: string[]): string[] {
  const normalized = (tags ?? [])
    .map((t) => t.trim().toLowerCase().replace(/^@+/, ''))
    .filter(Boolean)
    .map((t) => `@${t}`);
  return [...new Set(normalized)];
}

export async function resolveStaffTags(
  prisma: Db,
  tags: string[],
): Promise<Map<string, bigint>> {
  const usernames = tags.map((t) => t.replace(/^@/, ''));
  if (usernames.length === 0) return new Map();
  const rows = await prisma.$queryRaw<
    { username: string; telegramId: bigint }[]
  >`
    SELECT DISTINCT ON (lower("username"))
      lower("username") AS username, "telegramId"
    FROM "BotUser"
    WHERE lower("username") = ANY(${usernames})
    ORDER BY lower("username"), "updatedAt" DESC
  `;
  return new Map(rows.map((r) => [`@${r.username}`, BigInt(r.telegramId)]));
}

export function unresolvedStaffTags(
  tags: string[],
  resolved: Map<string, bigint>,
  storedIds: bigint[],
): string[] {
  return tags.filter((tag) => {
    const id = resolved.get(tag);
    return id === undefined || !storedIds.some((stored) => stored === id);
  });
}

export function isCheckInStaff(
  staffIds: bigint[],
  telegramId?: bigint,
): boolean {
  return telegramId !== undefined && staffIds.some((id) => id === telegramId);
}
