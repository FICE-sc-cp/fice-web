import { NotFoundException } from '@nestjs/common';
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
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    userBot = {
      sendBroadcast: jest.fn().mockResolvedValue({ sent: 3, failed: 0 }),
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
      prisma.event.findUnique.mockResolvedValue({ id: eventId, name: 'Вечірка' });
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

      expect(res.ok).toBe(true);
      expect(res.recipientsCount).toBe(2);
      expect(res.sentCount).toBe(3);
      expect(userBot.sendBroadcast).toHaveBeenCalledWith(
        [
          { chatId: BigInt(100), telegramId: BigInt(100) },
          { chatId: BigInt(200), telegramId: BigInt(200) },
        ],
        expect.objectContaining({ text: 'Нагадування про захід!' }),
      );
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

      expect(res.ok).toBe(true);
      expect(res.recipientsCount).toBe(2);
      expect(userBot.sendBroadcast).toHaveBeenCalled();
    });
  });
});
