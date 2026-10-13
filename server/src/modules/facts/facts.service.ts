import { BadRequestException, Injectable } from '@nestjs/common';
import { FundraiserStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export const STAT_KEYS = [
  'eventsHeld',
  'charityRaised',
  'membersCount',
  'closedFundraisers',
  'activeStudents',
  'activePartners',
  'eventsPerYear',
  'projectsDone',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

// Marketing stats with no automatic source — shown as defaults until
// overridden from the admin "Факти" page.
const MANUAL_DEFAULTS: Record<string, number> = {
  activeStudents: 1000,
  activePartners: 15,
  eventsPerYear: 20,
  projectsDone: 50,
};

// Per-stat caption under the number on the site, e.g. "з вересня 2023".
const NOTE_PREFIX = 'factNote:';

@Injectable()
export class FactsService {
  constructor(private readonly prisma: PrismaService) {}

  async computeStats(): Promise<Record<StatKey, number>> {
    const [eventsHeld, eventAgg, membersCount, closedFundraisers] =
      await this.prisma.$transaction([
        this.prisma.event.count(),
        this.prisma.eventDetails.aggregate({ _sum: { charityAmount: true } }),
        this.prisma.departmentMember.count(),
        this.prisma.fundraiser.count({
          where: { status: FundraiserStatus.CLOSED },
        }),
      ]);

    return {
      eventsHeld,
      charityRaised: this.toNumber(eventAgg._sum.charityAmount),
      membersCount,
      closedFundraisers,
      activeStudents: MANUAL_DEFAULTS.activeStudents,
      activePartners: MANUAL_DEFAULTS.activePartners,
      eventsPerYear: MANUAL_DEFAULTS.eventsPerYear,
      projectsDone: MANUAL_DEFAULTS.projectsDone,
    };
  }

  async getFacts() {
    const computed = await this.computeStats();
    const [overrides, notes] = await Promise.all([
      this.prisma.statOverride.findMany(),
      this.prisma.siteSetting.findMany({
        where: { key: { startsWith: NOTE_PREFIX } },
      }),
    ]);
    for (const override of overrides) {
      if (this.isStatKey(override.key)) {
        computed[override.key] = override.value.toNumber();
      }
    }
    return {
      ...computed,
      notes: Object.fromEntries(
        notes.map((n) => [n.key.slice(NOTE_PREFIX.length), n.value]),
      ) as Partial<Record<StatKey, string>>,
    };
  }

  async setNote(key: string, note: string) {
    this.assertStatKey(key);
    const settingKey = NOTE_PREFIX + key;
    const value = note.trim();
    if (!value) {
      await this.prisma.siteSetting.deleteMany({ where: { key: settingKey } });
      return { key, note: null };
    }
    await this.prisma.siteSetting.upsert({
      where: { key: settingKey },
      create: { key: settingKey, value },
      update: { value },
    });
    return { key, note: value };
  }

  listOverrides() {
    return this.prisma.statOverride.findMany({ orderBy: { key: 'asc' } });
  }

  setOverride(key: string, value: number) {
    this.assertStatKey(key);
    return this.prisma.statOverride.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async removeOverride(key: string) {
    await this.prisma.statOverride.delete({ where: { key } });
    return { key, removed: true };
  }

  private assertStatKey(key: string) {
    if (!this.isStatKey(key)) {
      throw new BadRequestException(
        `Unknown stat key "${key}". Allowed keys: ${STAT_KEYS.join(', ')}`,
      );
    }
  }

  private isStatKey(key: string): key is StatKey {
    return (STAT_KEYS as readonly string[]).includes(key);
  }

  private toNumber(value: Prisma.Decimal | null): number {
    return value ? value.toNumber() : 0;
  }
}
