import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { VotingStatus } from '@prisma/client';
import { ownUploadExists } from '../../upload/own-upload';
import { VotingService } from './voting.service';

jest.mock('../../upload/own-upload', () => ({
  ...jest.requireActual('../../upload/own-upload'),
  ownUploadExists: jest.fn(() => true),
}));

describe('VotingService', () => {
  let service: VotingService;
  let prisma: any;
  let userBot: any;
  let config: any;

  beforeEach(() => {
    config = {
      get: jest.fn().mockReturnValue('http://localhost:3002'),
    };
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
        count: jest.fn().mockResolvedValue(10),
      },
      botUser: {
        findUnique: jest.fn(),
      },
      event: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'evt-1', noRegistration: false }),
      },
      eventPartner: {
        findFirst: jest.fn(),
      },
      votingPartnerAward: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    userBot = {
      getMiniAppUrl: jest.fn().mockReturnValue('https://t.me/bot/app'),
      sendBroadcast: jest.fn().mockResolvedValue({ sent: 5, failed: 0 }),
    };

    service = new VotingService(prisma, userBot, config, {} as never);
  });

  describe('announceStage', () => {
    const broadcasts = { startBroadcast: jest.fn().mockResolvedValue({}) };
    const voting = (submissionsOpen: boolean) => ({
      id: 'vote-uuid',
      eventId: 'event-uuid',
      title: 'Костюм',
      description: null,
      status: VotingStatus.ACTIVE,
      allowSubmissions: true,
      submissionsOpen,
      onlyAttended: true,
      event: { id: 'event-uuid', name: 'Гелловін' },
    });

    beforeEach(() => {
      service = new VotingService(prisma, userBot, config, broadcasts as never);
      broadcasts.startBroadcast.mockClear();
      prisma.eventRegistration.findMany.mockResolvedValue([
        { telegramUserId: BigInt(1) },
      ]);
    });

    it('calls everyone registered to send entries', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue(voting(true));

      await service.announceStage('vote-uuid');

      expect(
        prisma.eventRegistration.findMany.mock.calls[0][0].where,
      ).not.toHaveProperty('attended');
      expect(broadcasts.startBroadcast.mock.calls[0][0].text).toContain(
        'прийом заявок',
      );
    });

    it('calls only people checked in to a present-only vote', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue(voting(false));

      await service.announceStage('vote-uuid');

      expect(
        prisma.eventRegistration.findMany.mock.calls[0][0].where,
      ).toMatchObject({ attended: true });
      expect(broadcasts.startBroadcast.mock.calls[0][0].text).toContain(
        'голосування',
      );
    });

    it('has nothing to announce in a draft', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        ...voting(false),
        status: VotingStatus.DRAFT,
      });

      await expect(service.announceStage('vote-uuid')).rejects.toThrow(
        BadRequestException,
      );
      expect(broadcasts.startBroadcast).not.toHaveBeenCalled();
    });
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

    it('takes no votes while entries are still coming in', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        status: VotingStatus.ACTIVE,
        allowSubmissions: true,
        submissionsOpen: true,
      });

      await expect(
        service.castVote(votingId, telegramId, { candidateId }),
      ).rejects.toThrow('прийом заявок');
      expect(prisma.vote.create).not.toHaveBeenCalled();
    });

    it('only counts votes for approved candidates', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        status: VotingStatus.ACTIVE,
        allowChangeVote: false,
      });
      prisma.votingCandidate.findFirst.mockResolvedValue(null);

      await expect(
        service.castVote(votingId, telegramId, { candidateId }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.votingCandidate.findFirst).toHaveBeenCalledWith({
        where: { id: candidateId, votingId, status: 'APPROVED' },
      });
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
      prisma.vote.update = jest
        .fn()
        .mockResolvedValue({ id: 'existing-vote', candidateId });

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

    it('takes votes only from people checked in at the entrance', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: votingId,
        eventId: 'event-uuid',
        status: VotingStatus.ACTIVE,
        onlyRegistered: false,
        onlyAttended: true,
      });
      prisma.votingCandidate.findFirst.mockResolvedValue({ id: candidateId });
      prisma.vote.findUnique.mockResolvedValue(null);
      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'reg-uuid',
        attended: false,
      });

      await expect(
        service.castVote(votingId, telegramId, { candidateId }),
      ).rejects.toThrow('присутні');
      expect(prisma.vote.create).not.toHaveBeenCalled();

      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'reg-uuid',
        attended: true,
      });
      prisma.botUser.findUnique.mockResolvedValue(null);
      prisma.vote.create.mockResolvedValue({ id: 'new-vote' });

      const res = await service.castVote(votingId, telegramId, { candidateId });
      expect(res.ok).toBe(true);
      expect(prisma.vote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ registrationId: 'reg-uuid' }),
      });
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

  describe('getPublicVoting', () => {
    it('treats everyone as registered at an event without registration', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        id: 'v1',
        eventId: 'e1',
        status: VotingStatus.ACTIVE,
        onlyRegistered: true,
        event: { id: 'e1', name: 'Event', noRegistration: true },
        candidates: [],
        _count: { votes: 0 },
      });
      prisma.vote.findUnique.mockResolvedValue(null);
      prisma.eventRegistration.findFirst.mockResolvedValue(null);
      prisma.votingCandidate.findFirst.mockResolvedValue(null);

      const view: any = await service.getPublicVoting('v1', BigInt(5));

      expect(view.isRegistered).toBe(true);
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

    it('takes no entries in a draft or once the vote is closed', async () => {
      for (const status of [VotingStatus.DRAFT, VotingStatus.CLOSED]) {
        prisma.eventVoting.findUnique.mockResolvedValue({
          id: votingId,
          status,
          allowSubmissions: true,
          submissionsOpen: true,
        });

        await expect(
          service.submitCandidate(votingId, telegramId, {
            name: 'Batman',
            photoUrl: '/uploads/batman.jpg',
          }),
        ).rejects.toThrow('Прийом заявок наразі закрито');
      }
    });

    const openVoting = {
      id: votingId,
      eventId: 'event-uuid',
      status: VotingStatus.ACTIVE,
      allowSubmissions: true,
      submissionsOpen: true,
      onlyRegistered: false,
    };

    it('refuses a photo that is not our own upload', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue(openVoting);
      (ownUploadExists as jest.Mock).mockReturnValueOnce(false);

      await expect(
        service.submitCandidate(votingId, telegramId, {
          name: 'Batman',
          photoUrl: 'https://tracker.example/pixel.jpg',
        }),
      ).rejects.toThrow('Фото потрібно завантажити');
    });

    it('refuses to reopen an already approved entry', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue(openVoting);
      prisma.votingCandidate.findFirst.mockResolvedValue({
        id: 'cand-1',
        status: 'APPROVED',
      });
      prisma.votingCandidate.update = jest.fn();

      await expect(
        service.submitCandidate(votingId, telegramId, {
          name: 'Batman 2',
          photoUrl: '/uploads/0e352379-dbd8-407f-98a5-38d60ab53528.jpg',
        }),
      ).rejects.toThrow('вже схвалено');
      expect(prisma.votingCandidate.update).not.toHaveBeenCalled();
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
        {
          name: 'Batman',
          description: 'Dark Knight',
          photoUrl: '/uploads/batman.jpg',
        },
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
      prisma.votingCandidate.findUnique.mockResolvedValue({
        id: 'cand-1',
        status: 'PENDING',
      });
      prisma.votingCandidate.update = jest
        .fn()
        .mockResolvedValue({ id: 'cand-1', status: 'APPROVED' });

      const res = await service.approveCandidate('cand-1');
      expect(res.status).toBe('APPROVED');
      expect(prisma.votingCandidate.update).toHaveBeenCalledWith({
        where: { id: 'cand-1' },
        data: { status: 'APPROVED' },
      });
    });

    it('rejects candidate with reason successfully', async () => {
      prisma.votingCandidate.findUnique.mockResolvedValue({
        id: 'cand-1',
        status: 'PENDING',
      });
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
        partnerAwards: [],
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

  describe('partner awards', () => {
    const award = (status: VotingStatus, partnerPicks = true) => ({
      id: 'award-1',
      title: 'Вибір партнера',
      prize: null,
      partnerPicks,
      candidateId: null,
      eventPartner: { name: 'Партнер А', logoImage: null, partner: null },
      voting: {
        title: 'Найкращий образ',
        description: null,
        status,
        candidates: [
          { id: 'c-1', name: 'А', description: null, photoUrl: null },
        ],
      },
    });

    it('saves the partner pick while the voting is open', async () => {
      prisma.votingPartnerAward.findUnique.mockResolvedValue(
        award(VotingStatus.ACTIVE),
      );

      const res = await service.setPartnerPick('code', 'c-1');

      expect(prisma.votingPartnerAward.update).toHaveBeenCalledWith({
        where: { id: 'award-1' },
        data: { candidateId: 'c-1' },
      });
      expect(res.candidateId).toBe('c-1');
      expect(res.partnerName).toBe('Партнер А');
    });

    it('refuses to change the pick once the voting is closed', async () => {
      prisma.votingPartnerAward.findUnique.mockResolvedValue(
        award(VotingStatus.CLOSED),
      );

      await expect(service.setPartnerPick('code', 'c-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.votingPartnerAward.update).not.toHaveBeenCalled();
    });

    it('refuses a candidate from outside the nomination', async () => {
      prisma.votingPartnerAward.findUnique.mockResolvedValue(
        award(VotingStatus.ACTIVE),
      );

      await expect(service.setPartnerPick('code', 'c-other')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('drops a pick whose candidate is no longer approved', async () => {
      prisma.votingPartnerAward.findUnique.mockResolvedValue({
        ...award(VotingStatus.ACTIVE),
        candidateId: 'c-rejected',
      });

      const res = await service.getPartnerPick('code');

      expect(res.candidateId).toBeNull();
    });

    it('has no working link when the organizer enters the pick', async () => {
      prisma.votingPartnerAward.findUnique.mockResolvedValue(
        award(VotingStatus.ACTIVE, false),
      );

      await expect(service.getPartnerPick('code')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('only takes partners of the same event', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        eventId: 'evt-1',
        partnerAwards: [],
      });
      prisma.eventPartner.findFirst.mockResolvedValue(null);

      await expect(
        service.createPartnerAward('voting-1', {
          eventPartnerId: 'ep-other',
          title: 'Вибір партнера',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.eventPartner.findFirst).toHaveBeenCalledWith({
        where: { id: 'ep-other', eventId: 'evt-1' },
        select: { id: true },
      });
    });
  });

  describe('screen remote', () => {
    it('keeps the screen state and stamps one-off commands with the new rev', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({
        screenState: {
          rev: 4,
          mode: 'ceremony',
          theme: 'hw',
          step: 3,
          salute: 2,
        },
      });

      const res = await service.updateScreenState('voting-1', {
        step: 4,
        nav: 1,
        salute: true,
      });

      expect(res).toEqual({
        rev: 5,
        mode: 'ceremony',
        theme: 'hw',
        step: 4,
        nav: { rev: 5, d: 1 },
        salute: 5,
      });
      expect(prisma.eventVoting.update).toHaveBeenCalledWith({
        where: { id: 'voting-1' },
        data: { screenState: res },
      });
    });

    it('shows a partner award on its own and puts it away on a mode switch', async () => {
      const awardId = '3f0c6c2e-8a51-4e2b-9a0e-5b1f7c9d2e10';
      prisma.eventVoting.findUnique.mockResolvedValueOnce({
        screenState: { rev: 1, mode: 'ceremony', step: 6 },
      });
      const shown = await service.updateScreenState('voting-1', {
        award: awardId,
      });
      expect(shown).toMatchObject({
        rev: 2,
        step: 6,
        award: awardId,
        awardOpen: false,
      });

      prisma.eventVoting.findUnique.mockResolvedValueOnce({
        screenState: shown,
      });
      const opened = await service.updateScreenState('voting-1', {
        awardOpen: true,
      });
      expect(opened).toMatchObject({ award: awardId, awardOpen: true });

      prisma.eventVoting.findUnique.mockResolvedValueOnce({
        screenState: opened,
      });
      const live = await service.updateScreenState('voting-1', {
        mode: 'live',
      });
      expect(live).toMatchObject({
        mode: 'live',
        award: null,
        awardOpen: false,
      });
    });

    it('starts from an empty state', async () => {
      prisma.eventVoting.findUnique.mockResolvedValue({ screenState: null });

      expect(await service.getScreenState('voting-1')).toEqual({ rev: 0 });
    });
  });
});
