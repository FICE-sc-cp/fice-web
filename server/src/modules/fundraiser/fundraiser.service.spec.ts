import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FundraiserStatus, Prisma } from '@prisma/client';
import { FundraiserService } from './fundraiser.service';
import { JAR_REUSE_MS } from './monobank-jar.client';

const WIDGET =
  'https://send.monobank.ua/widget.html?jar=3nzmmsWPvF88kT6FKrnpUwSaLkF2pwMK&sendId=6MJtUJ8B8d&type=qrp';

const base = {
  name: 'Пікап',
  description: 'Опис',
  startDate: new Date('2026-09-01'),
  endDate: new Date('2026-12-01'),
};

describe('FundraiserService jar linking', () => {
  let service: FundraiserService;
  let prisma: any;
  let jarClient: { fetch: jest.Mock };

  const created = () => prisma.fundraiser.create.mock.calls[0][0].data;
  const updated = () => prisma.fundraiser.update.mock.calls[0][0].data;

  beforeEach(() => {
    prisma = {
      fundraiser: {
        create: jest.fn().mockResolvedValue({ id: 'f-1' }),
        update: jest.fn().mockResolvedValue({ id: 'f-1' }),
        findUnique: jest.fn(),
      },
    };
    jarClient = {
      fetch: jest.fn().mockResolvedValue({
        kind: 'ok',
        jar: {
          amountKopecks: 32650000,
          goalKopecks: 48000000,
          closed: false,
          sendId: '6MJtUJ8B8d',
        },
      }),
    };
    service = new FundraiserService(prisma, jarClient as any);
  });

  describe('create', () => {
    it('saves a manual fundraiser without calling Monobank', async () => {
      await service.create({
        ...base,
        goalAmount: 1000,
        currentAmount: 10,
        jarUrl: 'https://send.monobank.ua/jar/abc',
      });
      expect(jarClient.fetch).not.toHaveBeenCalled();
      expect(created()).toMatchObject({
        goalAmount: 1000,
        currentAmount: 10,
        jarUrl: 'https://send.monobank.ua/jar/abc',
        jarWidgetUrl: null,
      });
    });

    it('fills amounts, goal and jar link from a linked jar', async () => {
      await service.create({
        ...base,
        jarWidgetUrl: WIDGET,
        currentAmount: 999,
        jarUrl: 'https://example.com',
      });
      const data = created();
      expect(data.currentAmount).toEqual(new Prisma.Decimal('326500'));
      expect(data.goalAmount).toEqual(new Prisma.Decimal('480000'));
      expect(data.jarUrl).toBe('https://send.monobank.ua/jar/6MJtUJ8B8d');
      expect(data.jarWidgetUrl).toBe(WIDGET);
      expect(data.jarSyncedAt).toBeInstanceOf(Date);
      expect(data.status).toBe(FundraiserStatus.ACTIVE);
    });

    it('keeps the admin goal when the jar has none', async () => {
      jarClient.fetch.mockResolvedValue({
        kind: 'ok',
        jar: { amountKopecks: 0, goalKopecks: 0, closed: false, sendId: null },
      });
      await service.create({ ...base, jarWidgetUrl: WIDGET, goalAmount: 7000 });
      expect(created().goalAmount).toBe(7000);
    });

    it('creates an active fundraiser for a closed jar as closed', async () => {
      jarClient.fetch.mockResolvedValue({
        kind: 'ok',
        jar: { amountKopecks: 1, goalKopecks: 0, closed: true, sendId: null },
      });
      await service.create({ ...base, jarWidgetUrl: WIDGET });
      expect(created().status).toBe(FundraiserStatus.CLOSED);
    });

    it('rejects a link that is not a widget link before calling Monobank', async () => {
      const call = service.create({
        ...base,
        jarWidgetUrl: 'https://send.monobank.ua/jar/6MJtUJ8B8d',
      });
      await expect(call).rejects.toThrow(BadRequestException);
      await expect(call).rejects.toThrow(/^jarWidgetUrl /);
      expect(jarClient.fetch).not.toHaveBeenCalled();
      expect(prisma.fundraiser.create).not.toHaveBeenCalled();
    });

    it.each([
      [{ kind: 'invalid' }],
      [{ kind: 'unsupported', reason: 'Банка має бути в гривнях (UAH)' }],
    ])('rejects a jar Monobank refuses (%o)', async (result) => {
      jarClient.fetch.mockResolvedValue(result);
      await expect(
        service.create({ ...base, jarWidgetUrl: WIDGET }),
      ).rejects.toThrow(/^jarWidgetUrl /);
      expect(prisma.fundraiser.create).not.toHaveBeenCalled();
    });

    it.each([
      [{ kind: 'rate-limited' }],
      [{ kind: 'unavailable', reason: 'timeout' }],
    ])(
      'saves the link for the background sync when Monobank is busy (%o)',
      async (result) => {
        jarClient.fetch.mockResolvedValue(result);
        await service.create({
          ...base,
          jarWidgetUrl: WIDGET,
          currentAmount: 5,
        });
        expect(created()).toMatchObject({
          jarWidgetUrl: WIDGET,
          jarSyncedAt: null,
          jarSyncError: null,
          currentAmount: 0,
          jarUrl: 'https://send.monobank.ua/jar/6MJtUJ8B8d',
        });
      },
    );

    it('treats a blank link as no link', async () => {
      await service.create({ ...base, jarWidgetUrl: '   ' });
      expect(jarClient.fetch).not.toHaveBeenCalled();
      expect(created().jarWidgetUrl).toBeNull();
    });
  });

  describe('update', () => {
    it('404s for a missing fundraiser', async () => {
      prisma.fundraiser.findUnique.mockResolvedValue(null);
      await expect(service.update('x', {})).rejects.toThrow(NotFoundException);
    });

    it('ignores manual amount and jar link while linked', async () => {
      prisma.fundraiser.findUnique.mockResolvedValue({
        status: FundraiserStatus.ACTIVE,
        jarWidgetUrl: WIDGET,
      });
      await service.update('f-1', {
        name: 'Нова назва',
        currentAmount: 1,
        jarUrl: 'https://example.com',
      });
      expect(jarClient.fetch).not.toHaveBeenCalled();
      expect(updated()).toEqual({ name: 'Нова назва' });
    });

    it('re-checks the jar on save and clears a previous error', async () => {
      prisma.fundraiser.findUnique.mockResolvedValue({
        status: FundraiserStatus.ACTIVE,
        jarWidgetUrl: WIDGET,
      });
      await service.update('f-1', { jarWidgetUrl: WIDGET });
      expect(jarClient.fetch).toHaveBeenCalledTimes(1);
      expect(updated()).toMatchObject({
        jarWidgetUrl: WIDGET,
        jarSyncError: null,
      });
    });

    it('keeps the last sync time when Monobank is busy and the link is unchanged', async () => {
      prisma.fundraiser.findUnique.mockResolvedValue({
        status: FundraiserStatus.ACTIVE,
        jarWidgetUrl: WIDGET,
      });
      jarClient.fetch.mockResolvedValue({ kind: 'rate-limited' });
      await service.update('f-1', { jarWidgetUrl: WIDGET });
      expect(updated()).not.toHaveProperty('jarSyncedAt');
    });

    it('does not close a draft when its jar is closed', async () => {
      prisma.fundraiser.findUnique.mockResolvedValue({
        status: FundraiserStatus.DRAFT,
        jarWidgetUrl: null,
      });
      jarClient.fetch.mockResolvedValue({
        kind: 'ok',
        jar: { amountKopecks: 1, goalKopecks: 0, closed: true, sendId: null },
      });
      await service.update('f-1', { jarWidgetUrl: WIDGET });
      expect(updated()).not.toHaveProperty('status');
    });

    it('unlinks and accepts manual values again', async () => {
      prisma.fundraiser.findUnique.mockResolvedValue({
        status: FundraiserStatus.ACTIVE,
        jarWidgetUrl: WIDGET,
      });
      await service.update('f-1', { jarWidgetUrl: null, currentAmount: 50 });
      expect(jarClient.fetch).not.toHaveBeenCalled();
      expect(updated()).toEqual({
        jarWidgetUrl: null,
        jarHasGoal: false,
        jarSyncedAt: null,
        jarSyncError: null,
        currentAmount: 50,
        jarUrl: undefined,
      });
    });

    it('rejects an invalid jar without touching the database', async () => {
      prisma.fundraiser.findUnique.mockResolvedValue({
        status: FundraiserStatus.ACTIVE,
        jarWidgetUrl: null,
      });
      jarClient.fetch.mockResolvedValue({ kind: 'invalid' });
      await expect(
        service.update('f-1', { jarWidgetUrl: WIDGET }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.fundraiser.update).not.toHaveBeenCalled();
    });
  });

  describe('jar goal protection', () => {
    const linked = (jarHasGoal: boolean) =>
      prisma.fundraiser.findUnique.mockResolvedValue({
        status: FundraiserStatus.ACTIVE,
        jarWidgetUrl: WIDGET,
        jarHasGoal,
        startDate: null,
        endDate: null,
      });

    it('records that the jar has its own goal', async () => {
      await service.create({ ...base, jarWidgetUrl: WIDGET, goalAmount: 1 });
      expect(created()).toMatchObject({ jarHasGoal: true });
      expect(created().goalAmount).toEqual(new Prisma.Decimal('480000'));
    });

    it('ignores an admin goal on a partial update when the jar has a goal', async () => {
      linked(true);
      await service.update('f-1', { goalAmount: 1 });
      expect(updated()).not.toHaveProperty('goalAmount');
    });

    it('ignores an admin goal when Monobank is busy and the jar has a goal', async () => {
      linked(true);
      jarClient.fetch.mockResolvedValue({ kind: 'rate-limited' });
      await service.update('f-1', { jarWidgetUrl: WIDGET, goalAmount: 1 });
      expect(updated()).not.toHaveProperty('goalAmount');
      expect(updated()).not.toHaveProperty('jarHasGoal');
    });

    it('overrides an admin goal with the fresh jar goal', async () => {
      linked(true);
      await service.update('f-1', { jarWidgetUrl: WIDGET, goalAmount: 1 });
      expect(updated().goalAmount).toEqual(new Prisma.Decimal('480000'));
    });

    it('accepts an admin goal once the jar drops its goal', async () => {
      linked(true);
      jarClient.fetch.mockResolvedValue({
        kind: 'ok',
        jar: { amountKopecks: 10, goalKopecks: 0, closed: false, sendId: null },
      });
      await service.update('f-1', { jarWidgetUrl: WIDGET, goalAmount: 7000 });
      expect(updated()).toMatchObject({ goalAmount: 7000, jarHasGoal: false });
    });

    it('accepts an admin goal when the jar has no goal', async () => {
      linked(false);
      await service.update('f-1', { goalAmount: 7000 });
      expect(updated()).toEqual({ goalAmount: 7000 });
    });

    it('accepts an admin goal for a new link Monobank could not check yet', async () => {
      linked(true);
      jarClient.fetch.mockResolvedValue({ kind: 'unavailable', reason: 'x' });
      const other = WIDGET.replace('3nzmm', '4nzmm');
      await service.update('f-1', { jarWidgetUrl: other, goalAmount: 7000 });
      expect(updated()).toMatchObject({
        goalAmount: 7000,
        jarHasGoal: false,
        jarSyncedAt: null,
      });
    });

    it('accepts an admin goal again after unlinking', async () => {
      linked(true);
      await service.update('f-1', { jarWidgetUrl: null, goalAmount: 7000 });
      expect(updated()).toMatchObject({ goalAmount: 7000, jarHasGoal: false });
    });

    it('reuses a recent Monobank answer when saving', async () => {
      await service.create({ ...base, jarWidgetUrl: WIDGET });
      expect(jarClient.fetch).toHaveBeenCalledWith(
        '3nzmmsWPvF88kT6FKrnpUwSaLkF2pwMK',
        JAR_REUSE_MS,
      );
    });
  });

  describe('previewJar', () => {
    it('returns the jar numbers as strings', async () => {
      await expect(service.previewJar(WIDGET)).resolves.toEqual({
        status: 'ok',
        currentAmount: '326500',
        goalAmount: '480000',
        jarUrl: 'https://send.monobank.ua/jar/6MJtUJ8B8d',
        closed: false,
      });
    });

    it('returns a null goal when the jar has none', async () => {
      jarClient.fetch.mockResolvedValue({
        kind: 'ok',
        jar: { amountKopecks: 150, goalKopecks: 0, closed: true, sendId: null },
      });
      await expect(service.previewJar(WIDGET)).resolves.toMatchObject({
        currentAmount: '1.5',
        goalAmount: null,
        closed: true,
      });
    });

    it('rejects a non-widget link without calling Monobank', async () => {
      await expect(
        service.previewJar('https://send.monobank.ua/jar/6MJtUJ8B8d'),
      ).rejects.toThrow(/^jarWidgetUrl /);
      expect(jarClient.fetch).not.toHaveBeenCalled();
    });

    it.each([
      [{ kind: 'invalid' }],
      [{ kind: 'unsupported', reason: 'Банка має бути в гривнях (UAH)' }],
    ])('rejects a jar Monobank refuses (%o)', async (result) => {
      jarClient.fetch.mockResolvedValue(result);
      await expect(service.previewJar(WIDGET)).rejects.toThrow(
        /^jarWidgetUrl /,
      );
    });

    it.each([
      [{ kind: 'rate-limited' }],
      [{ kind: 'unavailable', reason: 'немає звʼязку з Monobank' }],
    ])('reports Monobank as unavailable (%o)', async (result) => {
      jarClient.fetch.mockResolvedValue(result);
      await expect(service.previewJar(WIDGET)).resolves.toMatchObject({
        status: 'unavailable',
        reason: expect.any(String),
      });
    });
  });

  describe('closeExpired', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    const closeBefore = async (now: string) => {
      jest.useFakeTimers({ now: new Date(now) });
      prisma.fundraiser.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      await service.closeExpired();
      return prisma.fundraiser.updateMany.mock.calls[0][0].where.endDate.lt;
    };

    it('keeps a fundraiser open for the whole last day in Kyiv (summer time)', async () => {
      expect(await closeBefore('2026-10-03T20:59:00Z')).toEqual(
        new Date('2026-10-03T00:00:00Z'),
      );
    });

    it('closes it right after Kyiv midnight (summer time)', async () => {
      expect(await closeBefore('2026-10-03T21:01:00Z')).toEqual(
        new Date('2026-10-04T00:00:00Z'),
      );
    });

    it('uses the Kyiv date in winter time too', async () => {
      expect(await closeBefore('2026-12-01T21:59:00Z')).toEqual(
        new Date('2026-12-01T00:00:00Z'),
      );
      jest.useRealTimers();
      expect(await closeBefore('2026-12-01T22:01:00Z')).toEqual(
        new Date('2026-12-02T00:00:00Z'),
      );
    });

    it('only closes active fundraisers', async () => {
      await closeBefore('2026-10-03T12:00:00Z');
      expect(prisma.fundraiser.updateMany.mock.calls[0][0]).toMatchObject({
        where: { status: FundraiserStatus.ACTIVE },
        data: { status: FundraiserStatus.CLOSED },
      });
    });
  });

  describe('dates', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    const existing = (startDate: Date | null, endDate: Date | null) =>
      prisma.fundraiser.findUnique.mockResolvedValue({
        status: FundraiserStatus.ACTIVE,
        jarWidgetUrl: null,
        jarHasGoal: false,
        startDate,
        endDate,
      });

    it('starts today in Kyiv when no start date is given', async () => {
      jest.useFakeTimers({ now: new Date('2026-09-25T22:30:00Z') });
      await service.create({ name: 'x', description: 'y', goalAmount: 1 });
      expect(created().startDate).toEqual(new Date('2026-09-26T00:00:00Z'));
      expect(created().endDate).toBeNull();
    });

    it('allows a fundraiser without any dates', async () => {
      await service.create({
        name: 'x',
        description: 'y',
        goalAmount: 1,
        startDate: null,
        endDate: null,
      });
      expect(created()).toMatchObject({ startDate: null, endDate: null });
    });

    it('allows a start date without an end date', async () => {
      await service.create({ ...base, endDate: undefined, goalAmount: 1 });
      expect(created()).toMatchObject({
        startDate: base.startDate,
        endDate: null,
      });
    });

    it('allows the same start and end day', async () => {
      await service.create({ ...base, endDate: base.startDate, goalAmount: 1 });
      expect(prisma.fundraiser.create).toHaveBeenCalled();
    });

    it('rejects an end date without a start date', async () => {
      await expect(
        service.create({ ...base, startDate: null, goalAmount: 1 }),
      ).rejects.toThrow(/^startDate /);
    });

    it('rejects an end date before the start date', async () => {
      await expect(
        service.create({
          ...base,
          startDate: new Date('2026-10-02'),
          endDate: new Date('2026-10-01'),
          goalAmount: 1,
        }),
      ).rejects.toThrow(/^endDate /);
    });

    it('checks dates before calling Monobank', async () => {
      await expect(
        service.create({ ...base, startDate: null, jarWidgetUrl: WIDGET }),
      ).rejects.toThrow(/^startDate /);
      expect(jarClient.fetch).not.toHaveBeenCalled();
    });

    it('rejects adding an end date to a fundraiser without a start date', async () => {
      existing(null, null);
      await expect(
        service.update('f-1', { endDate: new Date('2026-12-01') }),
      ).rejects.toThrow(/^startDate /);
      expect(prisma.fundraiser.update).not.toHaveBeenCalled();
    });

    it('rejects clearing the start date while an end date stays', async () => {
      existing(new Date('2026-09-01'), new Date('2026-12-01'));
      await expect(service.update('f-1', { startDate: null })).rejects.toThrow(
        /^startDate /,
      );
    });

    it('rejects moving the start date after the existing end date', async () => {
      existing(new Date('2026-09-01'), new Date('2026-12-01'));
      await expect(
        service.update('f-1', { startDate: new Date('2026-12-02') }),
      ).rejects.toThrow(/^endDate /);
    });

    it('allows clearing both dates', async () => {
      existing(new Date('2026-09-01'), new Date('2026-12-01'));
      await service.update('f-1', { startDate: null, endDate: null });
      expect(updated()).toMatchObject({ startDate: null, endDate: null });
    });

    it('allows removing only the end date', async () => {
      existing(new Date('2026-09-01'), new Date('2026-12-01'));
      await service.update('f-1', { endDate: null });
      expect(updated()).toEqual({ endDate: null });
    });

    it('keeps dates untouched when the update does not mention them', async () => {
      existing(new Date('2026-09-01'), new Date('2026-12-01'));
      await service.update('f-1', { name: 'Нова' });
      expect(updated()).toEqual({ name: 'Нова' });
    });
  });
});
