import type { BlockedUser, PrismaClient } from '@prisma/client';

type BlocklistDb = Pick<PrismaClient, 'blockedUser'>;
type BotUserDb = Pick<PrismaClient, 'botUser'>;

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function findActiveBlock(
  prisma: BlocklistDb,
  telegramTag: string,
  telegramUserId?: bigint,
): Promise<BlockedUser | null> {
  const block = await prisma.blockedUser.findFirst({
    where: {
      isBlocked: true,
      OR: [
        { telegramTag },
        ...(telegramUserId !== undefined ? [{ telegramUserId }] : []),
      ],
    },
  });
  if (block && telegramUserId !== undefined && block.telegramUserId === null) {
    await prisma.blockedUser.update({
      where: { id: block.id },
      data: { telegramUserId },
    });
  }
  return block;
}

export async function resolveTelegramUserId(
  prisma: BotUserDb,
  username: string,
): Promise<bigint | undefined> {
  const matches = await prisma.botUser.findMany({
    where: {
      username: { equals: escapeLikePattern(username), mode: 'insensitive' },
    },
    select: { telegramId: true },
    take: 2,
  });
  return matches.length === 1 ? matches[0].telegramId : undefined;
}
