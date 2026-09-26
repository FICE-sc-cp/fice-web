import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FundraiserStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { CreateFundraiserDto } from './dto/create-fundraiser.dto';
import { UpdateFundraiserDto } from './dto/update-fundraiser.dto';
import {
  JAR_REUSE_MS,
  JarWidgetLink,
  MonobankJarClient,
  jarPublicUrl,
  jarSnapshotData,
  parseJarWidget,
} from './monobank-jar.client';

interface JarFields {
  jarWidgetUrl: string | null;
  jarHasGoal?: boolean;
  jarSyncedAt?: Date | null;
  jarSyncError?: string | null;
  currentAmount?: Prisma.Decimal;
  goalAmount?: Prisma.Decimal;
  jarUrl?: string;
  status?: FundraiserStatus;
}

export type JarPreview =
  | {
      status: 'ok';
      currentAmount: string;
      goalAmount: string | null;
      jarUrl: string | null;
      closed: boolean;
    }
  | { status: 'unavailable'; reason: string };

const UNLINKED: JarFields = {
  jarWidgetUrl: null,
  jarHasGoal: false,
  jarSyncedAt: null,
  jarSyncError: null,
};

const INVALID_WIDGET_LINK =
  'jarWidgetUrl Встав посилання на віджет банки Monobank — воно має містити параметр jar=';
const JAR_NOT_FOUND =
  'jarWidgetUrl Monobank не знайшов таку банку — перевір посилання на віджет';
const MONOBANK_BUSY =
  'Monobank тимчасово обмежив запити — спробуй за кілька хвилин';
const START_REQUIRED =
  'startDate Вкажи дату початку — без неї не можна задати дату завершення';
const END_BEFORE_START =
  'endDate Дата завершення не може бути раніше за дату початку';

@Injectable()
export class FundraiserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jarClient: MonobankJarClient,
  ) {}

  async create(dto: CreateFundraiserDto) {
    const {
      jarWidgetUrl,
      currentAmount,
      jarUrl,
      goalAmount,
      startDate,
      endDate,
      ...rest
    } = dto;
    const start = startDate === undefined ? todayInKyiv() : startDate;
    const end = endDate ?? null;
    assertDateRange(start, end);

    const status = dto.status ?? FundraiserStatus.ACTIVE;
    const link = normalizeLink(jarWidgetUrl);
    const jar = link ? await this.resolveJar(link, status, true) : UNLINKED;

    return this.prisma.fundraiser.create({
      data: {
        ...rest,
        status,
        startDate: start,
        endDate: end,
        goalAmount: goalAmount ?? 0,
        currentAmount: link ? 0 : (currentAmount ?? 0),
        jarUrl: link ? null : jarUrl,
        ...jar,
      },
    });
  }

  async closeExpired() {
    const { count } = await this.prisma.fundraiser.updateMany({
      where: {
        status: FundraiserStatus.ACTIVE,
        endDate: { lt: todayInKyiv() },
      },
      data: { status: FundraiserStatus.CLOSED },
    });
    return count;
  }

  async findAll(
    { page, limit }: PaginationQueryDto,
    status?: FundraiserStatus,
  ) {
    const where = status
      ? { status }
      : { status: { not: FundraiserStatus.DRAFT } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.fundraiser.findMany({
        where,
        skip: skipFor(page, limit),
        take: limit,
        orderBy: [
          { status: 'asc' },
          { startDate: { sort: 'desc', nulls: 'last' } },
          { id: 'asc' },
        ],
      }),
      this.prisma.fundraiser.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id },
    });
    if (!fundraiser) {
      throw new NotFoundException(`Fundraiser ${id} not found`);
    }
    return fundraiser;
  }

  async update(id: string, dto: UpdateFundraiserDto) {
    const existing = await this.prisma.fundraiser.findUnique({
      where: { id },
      select: {
        status: true,
        jarWidgetUrl: true,
        jarHasGoal: true,
        startDate: true,
        endDate: true,
      },
    });
    if (!existing) {
      throw new NotFoundException(`Fundraiser ${id} not found`);
    }

    assertDateRange(
      dto.startDate !== undefined ? dto.startDate : existing.startDate,
      dto.endDate !== undefined ? dto.endDate : existing.endDate,
    );

    const { jarWidgetUrl, currentAmount, jarUrl, ...rest } = dto;
    const linkTouched = jarWidgetUrl !== undefined;
    const link = linkTouched
      ? normalizeLink(jarWidgetUrl)
      : existing.jarWidgetUrl;
    const data: Prisma.FundraiserUncheckedUpdateInput = { ...rest };

    if (!link) {
      if (linkTouched || existing.jarWidgetUrl) Object.assign(data, UNLINKED);
      if (currentAmount !== undefined) data.currentAmount = currentAmount;
      if (jarUrl !== undefined) data.jarUrl = jarUrl;
      return this.prisma.fundraiser.update({ where: { id }, data });
    }

    const sameLink = link === existing.jarWidgetUrl;
    const jar = linkTouched
      ? await this.resolveJar(link, dto.status ?? existing.status, !sameLink)
      : undefined;
    if (jar) Object.assign(data, jar);
    if (jar?.jarHasGoal === undefined && sameLink && existing.jarHasGoal) {
      delete data.goalAmount;
    }

    return this.prisma.fundraiser.update({ where: { id }, data });
  }

  async remove(id: string) {
    const exists = await this.prisma.fundraiser.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Fundraiser ${id} not found`);
    }
    return this.prisma.fundraiser.delete({ where: { id } });
  }

  async previewJar(link: string): Promise<JarPreview> {
    const widget = parseWidgetOrThrow(link);
    const result = await this.jarClient.fetch(widget.widgetId, JAR_REUSE_MS);
    switch (result.kind) {
      case 'ok': {
        const data = jarSnapshotData(result.jar, widget.sendId);
        return {
          status: 'ok',
          currentAmount: data.currentAmount.toString(),
          goalAmount: data.goalAmount?.toString() ?? null,
          jarUrl: data.jarUrl ?? null,
          closed: result.jar.closed,
        };
      }
      case 'invalid':
        throw new BadRequestException(JAR_NOT_FOUND);
      case 'unsupported':
        throw new BadRequestException(`jarWidgetUrl ${result.reason}`);
      case 'rate-limited':
        return { status: 'unavailable', reason: MONOBANK_BUSY };
      case 'unavailable':
        return { status: 'unavailable', reason: result.reason };
    }
  }

  private async resolveJar(
    link: string,
    status: FundraiserStatus,
    isNewLink: boolean,
  ): Promise<JarFields> {
    const widget = parseWidgetOrThrow(link);
    const result = await this.jarClient.fetch(widget.widgetId, JAR_REUSE_MS);
    switch (result.kind) {
      case 'ok':
        return {
          jarWidgetUrl: link,
          ...jarSnapshotData(result.jar, widget.sendId),
          ...(result.jar.closed &&
            status === FundraiserStatus.ACTIVE && {
              status: FundraiserStatus.CLOSED,
            }),
        };
      case 'invalid':
        throw new BadRequestException(JAR_NOT_FOUND);
      case 'unsupported':
        throw new BadRequestException(`jarWidgetUrl ${result.reason}`);
      case 'rate-limited':
      case 'unavailable': {
        const fallbackUrl = jarPublicUrl(widget.sendId);
        return {
          jarWidgetUrl: link,
          jarSyncError: null,
          ...(isNewLink && { jarSyncedAt: null, jarHasGoal: false }),
          ...(fallbackUrl && { jarUrl: fallbackUrl }),
        };
      }
    }
  }
}

function parseWidgetOrThrow(link: string): JarWidgetLink {
  const widget = parseJarWidget(link);
  if (!widget) throw new BadRequestException(INVALID_WIDGET_LINK);
  return widget;
}

function assertDateRange(
  start: Date | null | undefined,
  end: Date | null | undefined,
): void {
  if (!end) return;
  if (!start) throw new BadRequestException(START_REQUIRED);
  if (end.getTime() < start.getTime()) {
    throw new BadRequestException(END_BEFORE_START);
  }
}

function todayInKyiv(): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00.000Z`);
}

function normalizeLink(link: string | null | undefined): string | null {
  const trimmed = link?.trim();
  return trimmed ? trimmed : null;
}
