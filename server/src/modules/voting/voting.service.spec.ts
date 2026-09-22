import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VotingStatus } from '@prisma/client';
import { VotingService } from './voting.service';

describe('VotingService', () => {
  let service: VotingService;
  let prisma: any;
  let userBot: any;

  beforeEach(() => {
    prisma = {
      eventVoting: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      votingCandidate: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      vote: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      eventRegistration: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      botUser: {
        findUnique: jest.fn(),
      },
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 'evt-1', noRegistration: false }),
      },
    };
    userBot = {
      getMiniAppUrl: jest.fn().mockReturnValue('https://t.me/bot/app'),
      sendBroadcast: jest.fn().mockResolvedValue({ sent: 5, failed: 0 }),
    };

    service = new VotingService(prisma, userBot);
  });

  describe('castVote', () => {
    const votingId = 'vote-uuid';
    const candidateId = 'cand-uuid';
    const telegramId = BigInt(123456);

    it('rejects if voting does not exist', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue(null);

      await expect(
        service.castVote(votingId, telegramId, { candidateId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects if voting is not ACTIVE', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        status: VotingStatus.DRAFT,
      });

      await expect(
        service.castVote(votingId, telegramId, { candidateId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects if user has already voted and allowChangeVote is false', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        status: VotingStatus.ACTIVE,
        allowChangeVote: false,
      });
      prisma.votingCandidate.findFirst.mockResolvedValue({ id: candidateId });
      prisma.vote.findUnique.mockResolvedValue({ id: 'existing-vote' });

      await expect(
        service.castVote(votingId, telegramId, { candidateId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates vote if user has already voted and allowChangeVote is true', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        status: VotingStatus.ACTIVE,
        allowChangeVote: true,
      });
      prisma.votingCandidate.findFirst.mockResolvedValue({ id: candidateId });
      prisma.vote.findUnique.mockResolvedValue({ id: 'existing-vote' });
      prisma.vote.update = jest.fn().mockResolvedValue({ id: 'existing-vote', candidateId });

      const res = await service.castVote(votingId, telegramId, { candidateId });
      expect(res.ok).toBe(true);
      expect(prisma.vote.update).toHaveBeenCalledWith({
        where: { id: 'existing-vote' },
        data: { candidateId },
      });
    });

    it('rejects if onlyRegistered is true but user is not registered', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        eventId: 'event-uuid',
        status: VotingStatus.ACTIVE,
        onlyRegistered: true,
      });
      prisma.votingCandidate.findFirst.mockResolvedValue({ id: candidateId });
      prisma.vote.findUnique.mockResolvedValue(null);
      prisma.eventRegistration.findFirst.mockResolvedValue(null);

      await expect(
        service.castVote(votingId, telegramId, { candidateId }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('successfully casts vote when user is registered', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        eventId: 'event-uuid',
        status: VotingStatus.ACTIVE,
        onlyRegistered: true,
      });
      prisma.votingCandidate.findFirst.mockResolvedValue({ id: candidateId });
      prisma.vote.findUnique.mockResolvedValue(null);
      prisma.eventRegistration.findFirst.mockResolvedValue({ id: 'reg-uuid' });
      prisma.botUser.findUnique.mockResolvedValue({ id: 'user-uuid' });
      prisma.vote.create.mockResolvedValue({ id: 'new-vote' });

      const res = await service.castVote(votingId, telegramId, { candidateId });

      expect(res.ok).toBe(true);
      expect(prisma.vote.create).toHaveBeenCalledWith({
        data: {
          votingId,
          candidateId,
          telegramId,
          botUserId: 'user-uuid',
          registrationId: 'reg-uuid',
        },
      });
    });
  });

  describe('submitCandidate & moderation', () => {
    const votingId = 'vote-uuid';
    const telegramId = BigInt(999888);

    it('rejects if allowSubmissions is false', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        allowSubmissions: false,
        submissionsOpen: true,
      });

      await expect(
        service.submitCandidate(votingId, telegramId, {
          name: 'Batman',
          photoUrl: '/uploads/batman.jpg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects if submissionsOpen is false', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        allowSubmissions: true,
        submissionsOpen: false,
      });

      await expect(
        service.submitCandidate(votingId, telegramId, {
          name: 'Batman',
          photoUrl: '/uploads/batman.jpg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates candidate with PENDING status on valid submission', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        eventId: 'event-uuid',
        allowSubmissions: true,
        submissionsOpen: true,
        onlyRegistered: false,
      });
      prisma.votingCandidate.findFirst.mockResolvedValue(null);
      prisma.votingCandidate.create = jest.fn().mockResolvedValue({
        id: 'cand-1',
        name: 'Batman',
        status: 'PENDING',
      });

      const res = await service.submitCandidate(
        votingId,
        telegramId,
        { name: 'Batman', description: 'Dark Knight', photoUrl: '/uploads/batman.jpg' },
        'bruce_wayne',
        'Bruce Wayne',
      );

      expect(res.status).toBe('PENDING');
      expect(prisma.votingCandidate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            votingId,
            name: 'Batman',
            status: 'PENDING',
            submittedByTelegramId: telegramId,
            submittedByTag: '@bruce_wayne',
          }),
        }),
      );
    });

    it('approves candidate successfully', async () => {
      prisma.votingCandidate.findUnique.mockResolvedValue({ id: 'cand-1', status: 'PENDING' });
      prisma.votingCandidate.update = jest.fn().mockResolvedValue({ id: 'cand-1', status: 'APPROVED' });

      const res = await service.approveCandidate('cand-1');
      expect(res.status).toBe('APPROVED');
      expect(prisma.votingCandidate.update).toHaveBeenCalledWith({
        where: { id: 'cand-1' },
        data: { status: 'APPROVED' },
      });
    });

    it('rejects candidate with reason successfully', async () => {
      prisma.votingCandidate.findUnique.mockResolvedValue({ id: 'cand-1', status: 'PENDING' });
      prisma.votingCandidate.update = jest.fn().mockResolvedValue({
        id: 'cand-1',
        status: 'REJECTED',
        rejectionReason: 'Not a costume',
      });

      const res = await service.rejectCandidate('cand-1', 'Not a costume');
      expect(res.status).toBe('REJECTED');
      expect(prisma.votingCandidate.update).toHaveBeenCalledWith({
        where: { id: 'cand-1' },
        data: { status: 'REJECTED', rejectionReason: 'Not a costume' },
      });
    });

    it('returns live screen data with winners', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: 'voting-1',
        title: 'Найкращий костюм',
        description: 'Правила',
        status: 'ACTIVE',
        allowChangeVote: true,
        showResultsLive: true,
        event: {
          id: 'event-1',
          name: 'Хелловін 2026',
          date: '2026-10-31',
          location: 'Актова зала',
          photoUrl: '/uploads/hall.jpg',
        },
        candidates: [
          {
            id: 'c-1',
            name: 'Кандидат 1',
            description: 'Опис 1',
            photoUrl: '/c1.jpg',
            order: 0,
            _count: { votes: 15 },
          },
          {
            id: 'c-2',
            name: 'Кандидат 2',
            description: 'Опис 2',
            photoUrl: '/c2.jpg',
            order: 1,
            _count: { votes: 35 },
          },
        ],
        _count: { votes: 50 },
      });

      const res = await service.getLiveScreenData('voting-1');
      expect(res.voting.title).toBe('Найкращий костюм');
      expect(res.voting.totalVotes).toBe(50);
      expect(res.candidates).toHaveLength(2);
      expect(res.candidates[0].name).toBe('Кандидат 2'); // sorted by votes
      expect(res.candidates[0].votesCount).toBe(35);
      expect(res.candidates[0].percentage).toBe(70);
      expect(res.winners).toHaveLength(2);
      expect(res.winners[0].place).toBe(1);
      expect(res.winners[0].id).toBe('c-2');
      expect(res.winners[1].place).toBe(2);
      expect(res.winners[1].id).toBe('c-1');
    });
  });
});
