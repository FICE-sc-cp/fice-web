import type { ConfigService } from '@nestjs/config';
import type { BotService } from '../bot/bot.service';

/**
 * Presidium members are found by their Telegram tag, but anyone can register
 * a tag its owner has renamed away from. So a tag only counts together with
 * membership in the admin group, checked by Telegram id, which can't be taken
 * over. Without ADMIN_GROUP_CHAT_ID (local development) the tag is enough.
 */
export function inAdminGroup(
  config: ConfigService,
  bot: Pick<BotService, 'isUserInChat'>,
  telegramId: bigint,
): Promise<boolean> {
  const groupId = config.get<string>('ADMIN_GROUP_CHAT_ID');
  if (!groupId) return Promise.resolve(true);
  return bot.isUserInChat(groupId, Number(telegramId));
}
