import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { BotService, parseChatRef } from '../../bot/bot.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Injectable()
export class PartnerService {
  private readonly logger = new Logger(PartnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly config: ConfigService,
  ) {}

  async apply(dto: CreatePartnerDto) {
    const partner = await this.prisma.partner.create({
      data: { ...dto, isApproved: false },
    });

    void this.notifyHeads(partner).catch((err) =>
      this.logger.warn('Partner notification failed: ' + String(err)),
    );

    return partner;
  }

  private async notifyHeads(partner: {
    name: string;
    websiteLink: string | null;
  }) {
    const mentions = [
      this.config.get<string>('PARTNERSHIP_HEAD_TG'),
      this.config.get<string>('COUNCIL_HEAD_TG'),
    ]
      .filter((t): t is string => !!t)
      .map((t) => (t.startsWith('@') ? t : `@${t}`))
      .join(' ');

    const text = [
      '🤝 Нова заявка на партнерство',
      partner.name,
      partner.websiteLink ? `Сайт: ${partner.websiteLink}` : '',
      'Деталі — в адмінці.',
      mentions ? `${mentions} — погляньте, будь ласка` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Deliver to the partnerships department chat/topic when configured,
    // otherwise fall back to the shared admin group.
    const ref = parseChatRef(this.config.get<string>('PARTNERSHIP_CHAT_ID'));
    if (ref) {
      await this.bot.sendToChat(ref.chatId, text, ref.threadId);
    } else {
      await this.bot.notifyGroup(text);
    }
  }

  create(dto: CreatePartnerDto) {
    return this.prisma.partner.create({
      data: { ...dto, isApproved: true },
    });
  }

  async findAll({ page, limit }: PaginationQueryDto, includePending = false) {
    const where = includePending ? undefined : { isApproved: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.partner.findMany({
        where,
        skip: skipFor(page, limit),
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.partner.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (!partner) {
      throw new NotFoundException(`Partner ${id} not found`);
    }
    return partner;
  }

  async approve(id: string) {
    await this.findOne(id);
    return this.prisma.partner.update({
      where: { id },
      data: { isApproved: true },
    });
  }

  async update(id: string, dto: UpdatePartnerDto) {
    await this.findOne(id);
    return this.prisma.partner.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.partner.delete({ where: { id } });
  }
}
