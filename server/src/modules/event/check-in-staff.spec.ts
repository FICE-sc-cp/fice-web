import {
  isCheckInStaff,
  normalizeStaffTags,
  resolveStaffTags,
  unresolvedStaffTags,
} from './check-in-staff';
import { EventService, toPublicEvent } from './event.service';

describe('check-in staff helpers', () => {
  it('normalizes and de-duplicates tags', () => {
    expect(normalizeStaffTags([' @Denys ', 'denys', '@@helper', ''])).toEqual([
      '@denys',
      '@helper',
    ]);
  });

  it('resolves tags to Telegram ids of known bot users', async () => {
    const prisma: any = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ username: 'denys', telegramId: 42n }]),
    };
    const resolved = await resolveStaffTags(prisma, ['@denys', '@ghost']);

    expect(resolved).toEqual(new Map([['@denys', 42n]]));
  });

  it('reports tags that have no stored id yet', () => {
    const resolved = new Map([
      ['@denys', 42n],
      ['@late', 7n],
    ]);
    expect(
      unresolvedStaffTags(['@denys', '@late', '@ghost'], resolved, [42n]),
    ).toEqual(['@late', '@ghost']);
  });

  it('authorizes by Telegram id, not by username', () => {
    expect(isCheckInStaff([42n], 42n)).toBe(true);
    expect(isCheckInStaff([42n], 43n)).toBe(false);
    expect(isCheckInStaff([42n], undefined)).toBe(false);
  });

  it('never returns the staff list in public event responses', () => {
    const event = {
      id: 'e1',
      name: 'Event',
      checkInStaffTags: ['@denys'],
      checkInStaffIds: [42n],
    };
    expect(toPublicEvent(event)).toEqual({ id: 'e1', name: 'Event' });
  });
});

describe('EventService check-in access', () => {
  const REG = {
    id: 'r1',
    fullName: 'Іван Іваненко',
    telegramTag: '@ivan',
    group: 'ІП-31',
    birthDate: new Date('2000-01-01'),
    source: 'WEB',
    payment: 'DONATED',
    paymentStatus: 'CONFIRMED',
    paymentRejectionReason: null,
    ticketCode: '11111111-2222-3333-4444-555555555555',
    receiptUrl: '/uploads/receipt.jpg',
    attended: false,
    attendedAt: null,
    attendedBy: null,
    createdAt: new Date(),
    answers: [{ id: 'a1', value: 'secret', question: { label: 'Q' } }],
  };

  const serviceFor = (staffIds: bigint[]) => {
    const prisma: any = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'e1',
          name: 'Event',
          checkInStaffIds: staffIds,
        }),
      },
      eventRegistration: { findMany: jest.fn().mockResolvedValue([REG]) },
    };
    const env: Record<string, string> = { ADMIN_GROUP_CHAT_ID: '-100' };
    const bot = { isUserInChat: jest.fn().mockResolvedValue(false) };
    return new EventService(
      prisma,
      { get: (k: string) => env[k] } as never,
      bot as never,
      {} as never,
    );
  };

  it('refuses someone whose username is listed but whose id is not', async () => {
    const service = serviceFor([42n]);
    const access = await service.verifyCheckInAccess('e1', 99n, 'denys');

    expect(access.canCheckIn).toBe(false);
  });

  it('gives volunteers the list without birth dates, receipts, answers or ticket codes', async () => {
    const service = serviceFor([42n]);
    const list = await service.getCheckInList('e1', 42n, 'denys');
    const item: any = list.items[0];

    expect(item.fullName).toBe('Іван Іваненко');
    expect(item.isAdult).toBe(true);
    expect(item.birthDate).toBeUndefined();
    expect(item.ticketCode).toBeUndefined();
    expect(item.receiptUrl).toBeNull();
    expect(item.answers).toEqual([]);
  });
});
