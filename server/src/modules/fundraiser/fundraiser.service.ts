import { Injectable, NotFoundException } from '@nestjs/common';
import { FundraiserStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { CreateFundraiserDto } from './dto/create-fundraiser.dto';
import { UpdateFundraiserDto } from './dto/update-fundraiser.dto';
import { CreateDonationDto } from './dto/create-donation.dto';

const RECENT_DONATIONS = 12;

@Injectable()
export class FundraiserService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateFundraiserDto) {
    return this.prisma.fundraiser.create({
      data: {
        name: dto.name,
        status: dto.status ?? FundraiserStatus.ACTIVE,
        description: dto.description,
        story: dto.story,
        imageUrl: dto.imageUrl,
        location: dto.location,
        goalAmount: dto.goalAmount,
        currentAmount: dto.currentAmount ?? 0,
        donationsCount: dto.donationsCount ?? 0,
        cardNumber: dto.cardNumber,
        jarUrl: dto.jarUrl,
        monoJarId: dto.monoJarId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        detailsLink: dto.detailsLink,
      },
    });
  }

  async closeExpired() {
    const { count } = await this.prisma.fundraiser.updateMany({
      where: {
        status: FundraiserStatus.ACTIVE,
        endDate: { lt: new Date() },
      },
      data: { status: FundraiserStatus.CLOSED },
    });
    return count;
  }

  async findAll({ page, limit }: PaginationQueryDto, status?: FundraiserStatus) {
    const where = status ? { status } : undefined;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.fundraiser.findMany({
        where,
        skip: skipFor(page, limit),
        take: limit,
        orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      }),
      this.prisma.fundraiser.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id },
      include: {
        donations: {
          orderBy: { createdAt: 'desc' },
          take: RECENT_DONATIONS,
        },
      },
    });
    if (!fundraiser) {
      throw new NotFoundException(`Fundraiser ${id} not found`);
    }
    return fundraiser;
  }

  async update(id: string, dto: UpdateFundraiserDto) {
    await this.ensureExists(id);
    return this.prisma.fundraiser.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.fundraiser.delete({ where: { id } });
  }

  listDonations(id: string, limit = RECENT_DONATIONS) {
    return this.prisma.donation.findMany({
      where: { fundraiserId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Records a donation and bumps the fundraiser progress + counter so the
   * public page reflects it immediately (manual / live mode).
   */
  async addDonation(id: string, dto: CreateDonationDto) {
    await this.ensureExists(id);
    const [donation] = await this.prisma.$transaction([
      this.prisma.donation.create({
        data: {
          fundraiserId: id,
          name: dto.name?.trim() || null,
          amount: dto.amount,
          comment: dto.comment?.trim() || null,
          createdAt: dto.createdAt,
        },
      }),
      this.prisma.fundraiser.update({
        where: { id },
        data: {
          currentAmount: { increment: dto.amount },
          donationsCount: { increment: 1 },
        },
      }),
    ]);
    return donation;
  }

  async removeDonation(id: string, donationId: string) {
    const donation = await this.prisma.donation.findFirst({
      where: { id: donationId, fundraiserId: id },
    });
    if (!donation) {
      throw new NotFoundException(`Donation ${donationId} not found`);
    }
    await this.prisma.$transaction([
      this.prisma.donation.delete({ where: { id: donationId } }),
      this.prisma.fundraiser.update({
        where: { id },
        data: {
          currentAmount: { decrement: donation.amount },
          donationsCount: { decrement: 1 },
        },
      }),
    ]);
    return { id: donationId, removed: true };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.fundraiser.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Fundraiser ${id} not found`);
    }
  }

  /** Used by the Monobank sync to find fundraisers tied to a jar. */
  fundraisersWithJars() {
    return this.prisma.fundraiser.findMany({
      where: { monoJarId: { not: null } },
      select: { id: true, monoJarId: true },
    });
  }

  /** Authoritative balance update from Monobank (overwrites currentAmount). */
  setBalance(id: string, currentAmount: Prisma.Decimal | number) {
    return this.prisma.fundraiser.update({
      where: { id },
      data: { currentAmount },
    });
  }

  /**
   * Idempotently imports a Monobank statement item as a donation. Returns true
   * when a new row was created (so callers can bump the counter).
   */
  async importMonoDonation(
    id: string,
    item: { externalId: string; name: string | null; amount: number; createdAt: Date },
  ): Promise<boolean> {
    try {
      await this.prisma.donation.create({
        data: {
          fundraiserId: id,
          externalId: item.externalId,
          name: item.name,
          amount: item.amount,
          createdAt: item.createdAt,
        },
      });
      await this.prisma.fundraiser.update({
        where: { id },
        data: { donationsCount: { increment: 1 } },
      });
      return true;
    } catch (e) {
      // Unique violation => already imported; ignore.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return false;
      }
      throw e;
    }
  }
}
