import { BadRequestException } from '@nestjs/common';
import {
  createRegistrationGuarded,
  NewRegistration,
} from './registration-writer';

const NOW = new Date('2026-12-01T12:00:00Z');

const EVENT = {
  date: new Date('2026-12-10T16:00:00Z'),
  hasTime: true,
  registrationCloseDate: null,
  noRegistration: false,
  isDraft: false,
  maxRegistrations: null,
};

const DATA: NewRegistration = {
  eventId: '11111111-1111-1111-1111-111111111111',
  botUserId: 'b1',
  telegramUserId: 42n,
  telegramTag: '@denys',
  fullName: 'Іван Іваненко',
  group: 'ІП-31',
  birthDate: null,
  source: 'WEB',
  payment: 'NONE',
  paymentStatus: 'NOT_REQUIRED',
  receiptUrl: null,
  answers: [],
};

function db(event: object | null, count = 0, existing: object | null = null) {
  const calls: string[] = [];
  const tx: any = {
    $queryRaw: jest.fn(() => {
      calls.push('lock');
      return Promise.resolve([]);
    }),
    event: { findUnique: jest.fn().mockResolvedValue(event) },
    eventRegistration: {
      findFirst: jest.fn().mockResolvedValue(existing),
      count: jest.fn(() => {
        calls.push('count');
        return Promise.resolve(count);
      }),
      create: jest.fn(() => {
        calls.push('create');
        return Promise.resolve({ id: 'r1' });
      }),
    },
  };
  const prisma: any = { $transaction: jest.fn((fn: any) => fn(tx)) };
  return { prisma, tx, calls };
}

describe('createRegistrationGuarded', () => {
  it('locks the event row before counting and inserting', async () => {
    const { prisma, calls } = db(EVENT);
    const result = await createRegistrationGuarded(prisma, DATA, NOW);

    expect(result.created).toEqual({ id: 'r1' });
    expect(calls).toEqual(['lock', 'count', 'create']);
  });

  it('refuses once the deadline has passed (e.g. a late bot confirmation)', async () => {
    const { prisma, tx } = db({
      ...EVENT,
      registrationCloseDate: new Date('2026-11-30T12:00:00Z'),
    });

    await expect(
      createRegistrationGuarded(prisma, DATA, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.eventRegistration.create).not.toHaveBeenCalled();
  });

  it('refuses when the event is full', async () => {
    const { prisma, tx } = db({ ...EVENT, maxRegistrations: 3 }, 3);

    await expect(createRegistrationGuarded(prisma, DATA, NOW)).rejects.toThrow(
      'ліміт у 3',
    );
    expect(tx.eventRegistration.create).not.toHaveBeenCalled();
  });

  it('refuses drafts and events without registration', async () => {
    for (const event of [
      { ...EVENT, isDraft: true },
      { ...EVENT, noRegistration: true },
    ]) {
      const { prisma } = db(event);
      await expect(
        createRegistrationGuarded(prisma, DATA, NOW),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('returns the existing registration instead of creating a duplicate', async () => {
    const { prisma, tx } = db(EVENT, 0, { id: 'old' });
    const result = await createRegistrationGuarded(prisma, DATA, NOW);

    expect(result.existing).toEqual({ id: 'old' });
    expect(tx.eventRegistration.create).not.toHaveBeenCalled();
  });
});
