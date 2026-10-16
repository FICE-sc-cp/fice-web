import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { inAdminGroup } from '../../auth/admin-group';
import { BotService } from '../../bot/bot.service';
import { PrismaService } from '../../database/prisma.service';
import { telegramTagOf } from '../event/registration-identity';
import { PRESIDIUM_ROLES, tagUsername } from '../interview/interview-rules';

export const MEDIA_DEPARTMENT_SLUG = 'media';

export interface Person {
  id: number;
  username?: string;
}

/**
 * Who may publish from the media chat. The media department head (by the tag
 * in Департаменти) and the presidium (tag + admin group, see admin-group.ts)
 * always may and grant it to others in the admin panel.
 */
@Injectable()
export class PublishAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bot: BotService,
  ) {}

  private mediaHead() {
    return this.prisma.department
      .findUnique({
        where: { slug: MEDIA_DEPARTMENT_SLUG },
        select: { head: { select: { telegramTag: true } } },
      })
      .then((d) => tagUsername(d?.head?.telegramTag));
  }

  async isManager(user: Person): Promise<boolean> {
    const username = tagUsername(user.username);
    if (!username) return false;
    const [head, presidium] = await Promise.all([
      this.mediaHead(),
      this.prisma.departmentMember.findMany({
        where: { role: { in: PRESIDIUM_ROLES }, telegramTag: { not: null } },
        select: { telegramTag: true },
      }),
    ]);
    if (head === username) return true;
    if (!presidium.some((m) => tagUsername(m.telegramTag) === username)) {
      return false;
    }
    return inAdminGroup(this.config, this.bot, BigInt(user.id));
  }

  async canPublish(user: Person): Promise<boolean> {
    const username = tagUsername(user.username);
    if (!username) return false;
    const granted = await this.prisma.publisher.findUnique({
      where: { telegramTag: telegramTagOf(username) },
    });
    return granted ? true : this.isManager(user);
  }

  /** Pinged about a request: everyone granted access plus the media head. */
  async approverTags(): Promise<string[]> {
    const [publishers, head] = await Promise.all([
      this.prisma.publisher.findMany({ select: { telegramTag: true } }),
      this.mediaHead(),
    ]);
    const tags = publishers.map((p) => p.telegramTag);
    if (head) tags.push(telegramTagOf(head));
    return [...new Set(tags)];
  }

  list() {
    return this.prisma.publisher.findMany({ orderBy: { createdAt: 'asc' } });
  }

  add(tag: string, addedBy?: string) {
    const telegramTag = this.tagOf(tag);
    return this.prisma.publisher.upsert({
      where: { telegramTag },
      update: {},
      create: { telegramTag, addedBy },
    });
  }

  async remove(tag: string) {
    await this.prisma.publisher.deleteMany({
      where: { telegramTag: this.tagOf(tag) },
    });
  }

  private tagOf(raw: string): string {
    const username = tagUsername(raw);
    if (!username) {
      throw new BadRequestException(
        'Невірний Telegram-тег (наприклад, @username)',
      );
    }
    return telegramTagOf(username);
  }
}
