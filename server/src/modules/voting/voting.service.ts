import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidateStatus, VotingStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { UserBotService } from '../../bot/user-bot.service';
import { PrismaService } from '../../database/prisma.service';
import { CastVoteDto } from './dto/cast-vote.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { CreateVotingDto } from './dto/create-voting.dto';
import { SubmitCandidateDto } from './dto/submit-candidate.dto';
import { UpdateVotingDto } from './dto/update-voting.dto';

@Injectable()
export class VotingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userBot: UserBotService,
  ) {}

  async getEventVotings(eventId: string) {
    const votings = await this.prisma.eventVoting.findMany({
      where: { eventId },
      include: {
        candidates: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { votes: true } },
          },
        },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return votings.map((v) => ({
      id: v.id,
      eventId: v.eventId,
      title: v.title,
      description: v.description,
      status: v.status,
      onlyRegistered: v.onlyRegistered,
      showResultsLive: v.showResultsLive,
      allowChangeVote: v.allowChangeVote,
      allowSubmissions: v.allowSubmissions,
      submissionsOpen: v.submissionsOpen,
      createdAt: v.createdAt,
      totalVotes: v._count.votes,
      pendingSubmissionsCount: v.candidates.filter((c) => c.status === 'PENDING').length,
      candidates: v.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        photoUrl: c.photoUrl,
        order: c.order,
        status: c.status,
        submittedByName: c.submittedByName,
        submittedByTag: c.submittedByTag,
        submittedByTelegramId: c.submittedByTelegramId ? c.submittedByTelegramId.toString() : null,
        rejectionReason: c.rejectionReason,
        createdAt: c.createdAt,
        votesCount: c._count.votes,
      })),
    }));
  }

  async createVoting(eventId: string, dto: CreateVotingDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    return this.prisma.eventVoting.create({
      data: {
        eventId,
        title: dto.title,
        description: dto.description,
        onlyRegistered: dto.onlyRegistered ?? true,
        showResultsLive: dto.showResultsLive ?? false,
        allowChangeVote: dto.allowChangeVote ?? false,
        allowSubmissions: dto.allowSubmissions ?? false,
        submissionsOpen: dto.submissionsOpen ?? false,
      },
      include: { candidates: true },
    });
  }

  async getVoting(id: string) {
    const voting = await this.prisma.eventVoting.findUnique({
      where: { id },
      include: {
        candidates: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { votes: true } } },
        },
        _count: { select: { votes: true } },
      },
    });
    if (!voting) throw new NotFoundException(`Voting ${id} not found`);
    return voting;
  }

  async updateVoting(id: string, dto: UpdateVotingDto) {
    await this.getVoting(id);
    return this.prisma.eventVoting.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        onlyRegistered: dto.onlyRegistered,
        showResultsLive: dto.showResultsLive,
        allowChangeVote: dto.allowChangeVote,
        allowSubmissions: dto.allowSubmissions,
        submissionsOpen: dto.submissionsOpen,
      },
      include: { candidates: true },
    });
  }

  async deleteVoting(id: string) {
    await this.getVoting(id);
    return this.prisma.eventVoting.delete({ where: { id } });
  }

  async addCandidate(votingId: string, dto: CreateCandidateDto) {
    await this.getVoting(votingId);
    return this.prisma.votingCandidate.create({
      data: {
        votingId,
        name: dto.name,
        description: dto.description,
        photoUrl: dto.photoUrl,
        order: dto.order ?? 0,
      },
    });
  }

  async updateCandidate(candidateId: string, dto: UpdateCandidateDto) {
    const candidate = await this.prisma.votingCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) throw new NotFoundException(`Candidate ${candidateId} not found`);

    return this.prisma.votingCandidate.update({
      where: { id: candidateId },
      data: {
        name: dto.name?.trim() ?? undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        photoUrl: dto.photoUrl !== undefined ? dto.photoUrl?.trim() || null : undefined,
        order: dto.order !== undefined ? dto.order : undefined,
      },
    });
  }

  async deleteCandidate(candidateId: string) {
    const candidate = await this.prisma.votingCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) throw new NotFoundException(`Candidate ${candidateId} not found`);
    return this.prisma.votingCandidate.delete({ where: { id: candidateId } });
  }

  async getPublicVoting(id: string, telegramId?: bigint) {
    const voting = await this.prisma.eventVoting.findUnique({
      where: { id },
      include: {
        event: { select: { id: true, name: true, noRegistration: true } },
        candidates: {
          where: { status: CandidateStatus.APPROVED },
          orderBy: { order: 'asc' },
          include: { _count: { select: { votes: true } } },
        },
        _count: { select: { votes: true } },
      },
    });
    if (!voting) throw new NotFoundException(`Voting ${id} not found`);

    let userVotedCandidateId: string | null = null;
    let isRegistered = voting.event?.noRegistration ?? false;
    let userSubmission: {
      id: string;
      name: string;
      description: string | null;
      photoUrl: string | null;
      status: CandidateStatus;
      rejectionReason: string | null;
      createdAt: Date;
    } | null = null;

    if (telegramId) {
      const vote = await this.prisma.vote.findUnique({
        where: {
          votingId_telegramId: {
            votingId: id,
            telegramId,
          },
        },
      });
      if (vote) {
        userVotedCandidateId = vote.candidateId;
      }

      const reg = await this.prisma.eventRegistration.findFirst({
        where: {
          eventId: voting.eventId,
          telegramUserId: telegramId,
        },
      });
      isRegistered = !!reg;

      const userSub = await this.prisma.votingCandidate.findFirst({
        where: {
          votingId: id,
          submittedByTelegramId: telegramId,
        },
      });
      if (userSub) {
        userSubmission = {
          id: userSub.id,
          name: userSub.name,
          description: userSub.description,
          photoUrl: userSub.photoUrl,
          status: userSub.status,
          rejectionReason: userSub.rejectionReason,
          createdAt: userSub.createdAt,
        };
      }
    }

    const totalVotes = voting._count.votes;
    const canSeeResults =
      voting.showResultsLive || voting.status === VotingStatus.CLOSED;

    return {
      id: voting.id,
      eventId: voting.eventId,
      eventName: voting.event.name,
      title: voting.title,
      description: voting.description,
      status: voting.status,
      onlyRegistered: voting.onlyRegistered,
      showResultsLive: voting.showResultsLive,
      allowChangeVote: voting.allowChangeVote,
      allowSubmissions: voting.allowSubmissions,
      submissionsOpen: voting.submissionsOpen,
      isRegistered,
      hasVoted: !!userVotedCandidateId,
      votedCandidateId: userVotedCandidateId,
      userSubmission,
      totalVotes: canSeeResults ? totalVotes : undefined,
      candidates: voting.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        photoUrl: c.photoUrl,
        order: c.order,
        votesCount: canSeeResults ? c._count.votes : undefined,
        percent:
          canSeeResults && totalVotes > 0
            ? Math.round((c._count.votes / totalVotes) * 100)
            : undefined,
      })),
    };
  }

  async submitCandidate(
    votingId: string,
    telegramId: bigint,
    dto: SubmitCandidateDto,
    username?: string,
    fullName?: string,
  ) {
    const voting = await this.prisma.eventVoting.findUnique({
      where: { id: votingId },
    });
    if (!voting) throw new NotFoundException(`Voting ${votingId} not found`);

    if (!voting.allowSubmissions) {
      throw new BadRequestException('Подання заявок не передбачено для цієї номінації');
    }

    if (!voting.submissionsOpen) {
      throw new BadRequestException('Прийом заявок наразі закрито');
    }

    if (voting.onlyRegistered) {
      const event = await this.prisma.event.findUnique({
        where: { id: voting.eventId },
        select: { noRegistration: true },
      });
      if (!event?.noRegistration) {
        const isReg = await this.prisma.eventRegistration.findFirst({
          where: {
            eventId: voting.eventId,
            telegramUserId: telegramId,
          },
        });
        if (!isReg) {
          throw new ForbiddenException(
            'Брати участь у конкурсі можуть лише зареєстровані учасники заходу',
          );
        }
      }
    }

    const existing = await this.prisma.votingCandidate.findFirst({
      where: { votingId, submittedByTelegramId: telegramId },
    });

    if (existing) {
      return this.prisma.votingCandidate.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          description: dto.description,
          photoUrl: dto.photoUrl,
          status: CandidateStatus.PENDING,
          rejectionReason: null,
          submittedByName: fullName || existing.submittedByName,
          submittedByTag: username ? `@${username.replace(/^@/, '')}` : existing.submittedByTag,
        },
      });
    }

    return this.prisma.votingCandidate.create({
      data: {
        votingId,
        name: dto.name,
        description: dto.description,
        photoUrl: dto.photoUrl,
        status: CandidateStatus.PENDING,
        submittedByTelegramId: telegramId,
        submittedByName: fullName,
        submittedByTag: username ? `@${username.replace(/^@/, '')}` : null,
      },
    });
  }

  async getSubmissions(votingId: string, status?: CandidateStatus) {
    await this.getVoting(votingId);
    const where: any = { votingId, submittedByTelegramId: { not: null } };
    if (status) where.status = status;

    const list = await this.prisma.votingCandidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return list.map((c) => ({
      ...c,
      submittedByTelegramId: c.submittedByTelegramId ? c.submittedByTelegramId.toString() : null,
    }));
  }

  async approveCandidate(candidateId: string) {
    const candidate = await this.prisma.votingCandidate.findUnique({
      where: { id: candidateId },
      include: {
        voting: {
          include: {
            event: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!candidate) throw new NotFoundException(`Candidate ${candidateId} not found`);

    const updated = await this.prisma.votingCandidate.update({
      where: { id: candidateId },
      data: { status: CandidateStatus.APPROVED },
    });

    if (candidate.submittedByTelegramId) {
      const eventName = candidate.voting?.event?.name || 'захід';
      const votingTitle = candidate.voting?.title || 'Конкурс';
      const msg =
        `🎉 <b>Вашу заявку схвалено!</b>\n\n` +
        `Адміністратор підтвердив вашу участь у конкурсі <b>«${votingTitle}»</b> (захід <b>${eventName}</b>) із образом <b>«${candidate.name}»</b>.\n\n` +
        `Тепер ваш образ бере участь у голосуванні! Бажаємо успіху та перемоги! 🏆`;

      const miniAppUrl = this.userBot.getMiniAppUrl();
      const votingBtnUrl = `${miniAppUrl}?startapp=vote_${candidate.votingId}`;

      await this.userBot
        .sendMessageToUser(candidate.submittedByTelegramId, msg, {
          text: 'Перейти до голосування',
          url: votingBtnUrl,
          isWebApp: true,
        })
        .catch(() => {});
    }

    return updated;
  }

  async rejectCandidate(candidateId: string, reason?: string) {
    const candidate = await this.prisma.votingCandidate.findUnique({
      where: { id: candidateId },
      include: {
        voting: {
          include: {
            event: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!candidate) throw new NotFoundException(`Candidate ${candidateId} not found`);

    const updated = await this.prisma.votingCandidate.update({
      where: { id: candidateId },
      data: {
        status: CandidateStatus.REJECTED,
        rejectionReason: reason ?? null,
      },
    });

    if (candidate.submittedByTelegramId) {
      const eventName = candidate.voting?.event?.name || 'захід';
      const votingTitle = candidate.voting?.title || 'Конкурс';
      const reasonPart = reason ? `\n\n<b>Причина:</b> ${reason}` : '';
      const msg =
        `ℹ️ <b>Оновлення щодо заявки на конкурс</b>\n\n` +
        `Вашу заявку із образом <b>«${candidate.name}»</b> у конкурсі <b>«${votingTitle}»</b> (захід <b>${eventName}</b>) було відхилено адміністратором.${reasonPart}\n\n` +
        `Ви можете за потреби відредагувати заявку та завантажити інше фото у додатку.`;

      const miniAppUrl = this.userBot.getMiniAppUrl();
      const votingBtnUrl = `${miniAppUrl}?startapp=vote_${candidate.votingId}`;

      await this.userBot
        .sendMessageToUser(candidate.submittedByTelegramId, msg, {
          text: 'Відкрити конкурс',
          url: votingBtnUrl,
          isWebApp: true,
        })
        .catch(() => {});
    }

    return updated;
  }

  async castVote(votingId: string, telegramId: bigint, dto: CastVoteDto) {
    const voting = await this.prisma.eventVoting.findUnique({
      where: { id: votingId },
    });
    if (!voting) throw new NotFoundException(`Voting ${votingId} not found`);

    if (voting.status !== VotingStatus.ACTIVE) {
      throw new BadRequestException('Голосування зараз не активне');
    }

    const candidate = await this.prisma.votingCandidate.findFirst({
      where: { id: dto.candidateId, votingId },
    });
    if (!candidate) {
      throw new NotFoundException('Кандидата не знайдено в цьому голосуванні');
    }

    // Check if user already voted
    const existing = await this.prisma.vote.findUnique({
      where: {
        votingId_telegramId: {
          votingId,
          telegramId,
        },
      },
    });
    if (existing) {
      if (!voting.allowChangeVote) {
        throw new BadRequestException('Ви вже проголосували в цій номінації');
      }

      await this.prisma.vote.update({
        where: { id: existing.id },
        data: { candidateId: dto.candidateId },
      });
      return { ok: true, message: 'Ваш голос успішно змінено!' };
    }

    // If only registered, check registration
    let registrationId: string | undefined;
    if (voting.onlyRegistered) {
      const event = await this.prisma.event.findUnique({
        where: { id: voting.eventId },
        select: { noRegistration: true },
      });
      if (!event?.noRegistration) {
        const reg = await this.prisma.eventRegistration.findFirst({
          where: {
            eventId: voting.eventId,
            telegramUserId: telegramId,
          },
        });
        if (!reg) {
          throw new ForbiddenException(
            'Голосувати можуть тільки користувачі, які зареєстровані на цей захід',
          );
        }
        registrationId = reg.id;
      }
    }

    const botUser = await this.prisma.botUser.findUnique({
      where: { telegramId },
    });

    await this.prisma.vote.create({
      data: {
        votingId,
        candidateId: dto.candidateId,
        telegramId,
        botUserId: botUser?.id,
        registrationId,
      },
    });

    return { ok: true, message: 'Ваш голос успішно зараховано!' };
  }

  async getResults(votingId: string) {
    const voting = await this.prisma.eventVoting.findUnique({
      where: { id: votingId },
      include: {
        candidates: {
          include: {
            _count: { select: { votes: true } },
          },
        },
        votes: {
          include: {
            candidate: { select: { id: true, name: true } },
            botUser: {
              select: {
                id: true,
                fullName: true,
                username: true,
                firstName: true,
                lastName: true,
                group: true,
              },
            },
            registration: {
              select: {
                id: true,
                fullName: true,
                telegramTag: true,
                group: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!voting) throw new NotFoundException(`Voting ${votingId} not found`);

    const totalVotes = voting.votes.length;

    return {
      voting: {
        id: voting.id,
        title: voting.title,
        status: voting.status,
        totalVotes,
      },
      candidates: voting.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        photoUrl: c.photoUrl,
        votesCount: c._count.votes,
        percentage:
          totalVotes > 0 ? Math.round((c._count.votes / totalVotes) * 100) : 0,
      })),
      votes: voting.votes.map((v) => ({
        id: v.id,
        candidateId: v.candidateId,
        candidateName: v.candidate.name,
        telegramId: v.telegramId.toString(),
        voterName:
          v.registration?.fullName ||
          v.botUser?.fullName ||
          [v.botUser?.firstName, v.botUser?.lastName].filter(Boolean).join(' ') ||
          'Анонім',
        telegramTag: v.registration?.telegramTag || (v.botUser?.username ? `@${v.botUser.username}` : null),
        group: v.registration?.group || v.botUser?.group || null,
        createdAt: v.createdAt,
      })),
    };
  }

  async getLiveScreenData(votingId: string) {
    const voting = await this.prisma.eventVoting.findUnique({
      where: { id: votingId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            date: true,
            location: true,
            photoUrl: true,
          },
        },
        candidates: {
          where: { status: CandidateStatus.APPROVED },
          include: {
            _count: { select: { votes: true } },
          },
          orderBy: { order: 'asc' },
        },
        _count: { select: { votes: true } },
      },
    });
    if (!voting) throw new NotFoundException(`Voting ${votingId} not found`);

    const totalVotes = voting._count.votes;

    const candidates = voting.candidates
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        photoUrl: c.photoUrl,
        order: c.order,
        votesCount: c._count.votes,
        percentage:
          totalVotes > 0 ? Math.round((c._count.votes / totalVotes) * 100) : 0,
      }))
      .sort((a, b) => b.votesCount - a.votesCount);

    const winners = candidates.slice(0, 3).map((c, index) => ({
      place: index + 1,
      ...c,
    }));

    return {
      voting: {
        id: voting.id,
        title: voting.title,
        description: voting.description,
        status: voting.status,
        allowChangeVote: voting.allowChangeVote,
        showResultsLive: voting.showResultsLive,
        totalVotes,
        eventName: voting.event.name,
        eventDate: voting.event.date,
        eventLocation: voting.event.location,
        eventPhotoUrl: voting.event.photoUrl,
      },
      candidates,
      winners,
    };
  }

  async exportResults(votingId: string): Promise<Buffer> {
    const data = await this.getResults(votingId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FICE Events';
    workbook.created = new Date();

    // Sheet 1: Підсумки
    const summarySheet = workbook.addWorksheet('Підсумки');
    summarySheet.columns = [
      { header: 'Кандидат / Номінант', key: 'candidate', width: 35 },
      { header: 'Кількість голосів', key: 'votes', width: 20 },
      { header: 'Відсоток', key: 'percent', width: 15 },
    ];
    for (const c of data.candidates) {
      summarySheet.addRow({
        candidate: c.name,
        votes: c.votesCount,
        percent: `${c.percentage}%`,
      });
    }

    // Sheet 2: Детальні голоси
    const votesSheet = workbook.addWorksheet('Детальні голоси');
    votesSheet.columns = [
      { header: 'Час голосування', key: 'time', width: 22 },
      { header: 'Кандидат', key: 'candidate', width: 30 },
      { header: 'Імʼя виборця', key: 'name', width: 30 },
      { header: 'Telegram', key: 'telegram', width: 20 },
      { header: 'Група', key: 'group', width: 15 },
      { header: 'Telegram ID', key: 'tgId', width: 20 },
    ];

    for (const v of data.votes) {
      votesSheet.addRow({
        time: new Date(v.createdAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }),
        candidate: v.candidateName,
        name: v.voterName,
        telegram: v.telegramTag ?? '',
        group: v.group ?? '',
        tgId: v.telegramId,
      });
    }

    const uint8 = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8);
  }

  async notifyVotingStarted(votingId: string) {
    const voting = await this.prisma.eventVoting.findUnique({
      where: { id: votingId },
      include: { event: { select: { id: true, name: true } } },
    });
    if (!voting) throw new NotFoundException(`Voting ${votingId} not found`);

    // Get all registered users for this event with a telegramUserId
    const registrations = await this.prisma.eventRegistration.findMany({
      where: {
        eventId: voting.eventId,
        telegramUserId: { not: null },
      },
      select: { telegramUserId: true },
    });

    const uniqueIds = Array.from(
      new Set(registrations.map((r) => r.telegramUserId!).filter(Boolean)),
    );

    const appUrl = this.userBot.getMiniAppUrl();
    const votingUrl = `${appUrl}?startapp=vote_${votingId}`;

    const text =
      `<b>Розпочалося голосування!</b>\n\n` +
      `На заході <b>«${voting.event.name}»</b> відкрито голосування в номінації:\n` +
      `<b>«${voting.title}»</b>\n\n` +
      (voting.description ? `${voting.description}\n\n` : '') +
      `Переходь за кнопкою нижче та віддай свій голос:`;

    const result = await this.userBot.sendBroadcast(
      uniqueIds.map((id) => ({ chatId: id, telegramId: id })),
      {
        text,
        button: {
          text: 'Взяти участь у голосуванні',
          url: votingUrl,
          isWebApp: true,
        },
      },
    );

    return {
      ok: true,
      recipientsCount: uniqueIds.length,
      sentCount: result.sent,
      failedCount: result.failed,
    };
  }

  async getPublicEventVotings(eventId: string) {
    const votings = await this.prisma.eventVoting.findMany({
      where: {
        eventId,
        status: { in: [VotingStatus.ACTIVE, VotingStatus.CLOSED] },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        allowChangeVote: true,
        showResultsLive: true,
        _count: { select: { votes: true } },
      },
    });

    return votings.map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      status: v.status,
      allowChangeVote: v.allowChangeVote,
      showResultsLive: v.showResultsLive,
      totalVotes: v._count.votes,
    }));
  }
}
