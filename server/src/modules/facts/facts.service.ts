import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/** Canonical set of stats shown in the "facts & results" landing section. */
export const STAT_KEYS = [
  'eventsHeld',
  'moneyRaised',
  'charityRaised',
  'visitorsReached',
  'partnersCount',
  'departmentsCount',
  'membersCount',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

@Injectable()
export class FactsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Computes every stat straight from the database. */
  async computeStats(): Promise<Record<StatKey, number>> {
    const [
      eventsHeld,
      eventAgg,
      partnersCount,
      departmentsCount,
      membersCount,
    ] = await this.prisma.$transaction([
      this.prisma.event.count(),
      this.prisma.eventDetails.aggregate({
        _sum: {
          moneyCollected: true,
          charityAmount: true,
          visitorsAmount: true,
        },
      }),
      this.prisma.partner.count({ where: { isApproved: true } }),
      this.prisma.department.count(),
      this.prisma.departmentMember.count(),
    ]);

    return {
      eventsHeld,
      moneyRaised: this.toNumber(eventAgg._sum.moneyCollected),
      charityRaised: this.toNumber(eventAgg._sum.charityAmount),
      visitorsReached: eventAgg._sum.visitorsAmount ?? 0,
      partnersCount,
      departmentsCount,
      membersCount,
    };
  }

  /** Computed stats with any admin overrides applied on top. */
  async getFacts(): Promise<Record<StatKey, number>> {
    const computed = await this.computeStats();
    const overrides = await this.prisma.statOverride.findMany();
    for (const override of overrides) {
      if (this.isStatKey(override.key)) {
        computed[override.key] = override.value.toNumber();
      }
    }
    return computed;
  }

  listOverrides() {
    return this.prisma.statOverride.findMany({ orderBy: { key: 'asc' } });
  }

  setOverride(key: string, value: number) {
    if (!this.isStatKey(key)) {
      throw new BadRequestException(
        `Unknown stat key "${key}". Allowed keys: ${STAT_KEYS.join(', ')}`,
      );
    }
    return this.prisma.statOverride.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async removeOverride(key: string) {
    // Throws P2025 -> 404 if the override does not exist.
    await this.prisma.statOverride.delete({ where: { key } });
    return { key, removed: true };
  }

  private isStatKey(key: string): key is StatKey {
    return (STAT_KEYS as readonly string[]).includes(key);
  }

  private toNumber(value: Prisma.Decimal | null): number {
    return value ? value.toNumber() : 0;
  }
}
