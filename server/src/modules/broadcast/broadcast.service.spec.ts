import { ConflictException, NotFoundException } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';

describe('BroadcastService', () => {
  let service: BroadcastService;
  let prisma: any;
  let userBot: any;

  beforeEach(() => {
    prisma = {
      event: { findUnique: jest.fn() },
      eventRegistration: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      botUser: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      broadcastMessage: {
        create: jest.fn((args: any) =>
          Promise.resolve({ id: 'bcast-1', ...args.data }),
        ),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(),
    };
    userBot = {
      sendBroadcast: jest.fn().mockResolvedValue({ sent: 3, failed: 0 }),
      getUsername: jest.fn().mockReturnValue('fice_student_bot'),
    };
    const configService = { get: jest.fn().mockReturnValue(undefined) };

    service = new BroadcastService(prisma, userBot, configService as any);
  });

  describe('broadcastToEvent', () => {
    const eventId = 'evt-1';
    const dto = { text: 'Нагадування про захід!' };

    it('throws NotFoundException if event does not exist', async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.broadcastToEvent(eventId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('collects distinct telegram IDs and sends broadcast', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: eventId,
        name: 'Вечірка',
      });
      prisma.eventRegistration.findMany.mockResolvedValue([
        { telegramUserId: BigInt(100) },
        { telegramUserId: BigInt(200) },
        { telegramUserId: BigInt(100) }, // duplicate
      ]);
      prisma.broadcastMessage.create.mockImplementation((args: any) => ({
        id: 'bcast-1',
        ...args.data,
      }));

      const res = await service.broadcastToEvent(eventId, dto);
      await service.whenIdle();

      expect(res.ok).toBe(true);
      expect(res.status).toBe('SENDING');
      expect(res.recipientsCount).toBe(2);
      expect(userBot.sendBroadcast).toHaveBeenCalledWith(
        [
          { chatId: BigInt(100), telegramId: BigInt(100) },
          { chatId: BigInt(200), telegramId: BigInt(200) },
        ],
        expect.objectContaining({ text: 'Нагадування про захід!' }),
        expect.any(Function),
      );
      expect(prisma.broadcastMessage.update).toHaveBeenLastCalledWith({
        where: { id: 'bcast-1' },
        data: expect.objectContaining({
          sentCount: 3,
          failedCount: 0,
          status: 'COMPLETED',
        }),
      });
    });
  });

  describe('broadcastToAll', () => {
    it('sends broadcast to all unblocked bot users', async () => {
      prisma.botUser.findMany.mockResolvedValue([
        { chatId: BigInt(101), telegramId: BigInt(101) },
        { chatId: BigInt(102), telegramId: BigInt(102) },
      ]);
      prisma.broadcastMessage.create.mockImplementation((args: any) => ({
        id: 'bcast-2',
        ...args.data,
      }));

      const res = await service.broadcastToAll({ text: 'Новини для всіх!' });
      await service.whenIdle();

      expect(res.ok).toBe(true);
      expect(res.recipientsCount).toBe(2);
      expect(userBot.sendBroadcast).toHaveBeenCalled();
    });
  });

  describe('background delivery', () => {
    beforeEach(() => {
      prisma.botUser.findMany.mockResolvedValue([
        { chatId: BigInt(101), telegramId: BigInt(101) },
      ]);
    });

    it('answers before the messages are sent', async () => {
      let finish!: (v: unknown) => void;
      userBot.sendBroadcast.mockReturnValue(
        new Promise((resolve) => (finish = resolve)),
      );

      const res = await service.broadcastToAll({ text: 'Привіт' });

      expect(res.status).toBe('SENDING');
      expect(prisma.broadcastMessage.update).not.toHaveBeenCalled();
      finish({ sent: 1, failed: 0 });
      await service.whenIdle();
      expect(prisma.broadcastMessage.update).toHaveBeenCalled();
    });

    it('refuses a second broadcast while one is still sending', async () => {
      let finish!: (v: unknown) => void;
      userBot.sendBroadcast.mockReturnValue(
        new Promise((resolve) => (finish = resolve)),
      );
      await service.broadcastToAll({ text: 'Перша' });

      await expect(
        service.broadcastToAll({ text: 'Друга' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.broadcastMessage.create).toHaveBeenCalledTimes(1);

      finish({ sent: 1, failed: 0 });
      await service.whenIdle();
    });

    it('refuses when the database still has a broadcast in progress', async () => {
      prisma.broadcastMessage.count.mockResolvedValue(1);

      await expect(
        service.broadcastToAll({ text: 'Друга' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('marks a broadcast as interrupted when delivery crashes', async () => {
      userBot.sendBroadcast.mockRejectedValue(new Error('boom'));

      await service.broadcastToAll({ text: 'Привіт' });
      await service.whenIdle();

      expect(prisma.broadcastMessage.update).toHaveBeenCalledWith({
        where: { id: 'bcast-1' },
        data: expect.objectContaining({ status: 'INTERRUPTED' }),
      });
    });

    it('marks broadcasts left SENDING by a restart as interrupted', async () => {
      await service.onModuleInit();

      expect(prisma.broadcastMessage.updateMany).toHaveBeenCalledWith({
        where: { status: 'SENDING' },
        data: expect.objectContaining({ status: 'INTERRUPTED' }),
      });
    });
  });
});
