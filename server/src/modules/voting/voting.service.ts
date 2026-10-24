import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BroadcastTarget,
  CandidateStatus,
  Prisma,
  VotingStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import * as ExcelJS from 'exceljs';
import { UserBotService } from '../../bot/user-bot.service';
import { BroadcastService } from '../broadcast/broadcast.service';
import { PrismaService } from '../../database/prisma.service';
import { escapeHtml } from '../../common/html';
import { OWN_IMAGE_URL, ownUploadExists } from '../../upload/own-upload';
import { CastVoteDto } from './dto/cast-vote.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { CreateVotingDto } from './dto/create-voting.dto';
import { SubmitCandidateDto } from './dto/submit-candidate.dto';
import { UpdateVotingDto } from './dto/update-voting.dto';
import {
  CreatePartnerAwardDto,
  UpdatePartnerAwardDto,
} from './dto/partner-award.dto';
import { UpdateScreenStateDto } from './dto/screen-state.dto';

/**
 * What the stage screen shows. `nav` and `salute` are one-off commands: the
 * screen acts on them when their `rev` stamp changes.
 */
export type ScreenState = {
  rev: number;
  mode?: UpdateScreenStateDto['mode'];
  theme?: UpdateScreenStateDto['theme'];
  view?: UpdateScreenStateDto['view'];
  step?: number;
  award?: string | null;
  awardOpen?: boolean;
  nav?: { rev: number; d: -1 | 1 };
  salute?: number;
};

// Partner name/logo live on the event link or fall back to the partners table.
const AWARD_PARTNER = {
  eventPartner: {
    select: {
      name: true,
      logoImage: true,
      partner: { select: { name: true, logoImage: true } },
    },
  },
} satisfies Prisma.VotingPartnerAwardInclude;

type AwardPartner = Prisma.VotingPartnerAwardGetPayload<{
  include: typeof AWARD_PARTNER;
}>['eventPartner'];

function partnerOf(ep: AwardPartner) {
  return {
    partnerName: ep.name ?? ep.partner?.name ?? 'Партнер',
    partnerLogo: ep.logoImage ?? ep.partner?.logoImage ?? null,
  };
}

export type VotingStage = 'draft' | 'submissions' | 'voting' | 'closed';

/**
 * Where a nomination is: entries come in first while nobody can vote, then the
 * vote runs with entries shut, and a closed nomination takes neither.
 */
export function stageOf(v: {
  status: VotingStatus;
  allowSubmissions: boolean;
  submissionsOpen: boolean;
}): VotingStage {
  if (v.status === VotingStatus.DRAFT) return 'draft';
  if (v.status === VotingStatus.CLOSED) return 'closed';
  return v.allowSubmissions && v.submissionsOpen ? 'submissions' : 'voting';
}

const AWARD_ORDER: Prisma.VotingPartnerAwardOrderByWithRelationInput[] = [
  { order: 'asc' },
  { createdAt: 'asc' },
];

@Injectable()
export class VotingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userBot: UserBotService,
    private readonly config: ConfigService,
    private readonly broadcasts: BroadcastService,
  ) {}

  private webUrl(path: string): string {
    const publicUrl = this.config.get<string>('PUBLIC_WEB_URL');
    const base = publicUrl
      ? publicUrl.replace(/\/$/, '')
      : 'http://localhost:3002';
    return `${base}${path}`;
  }

  private getScreenUrl(votingId: string): string {
    return this.webUrl(`/screen/voting/${votingId}`);
  }

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
        partnerAwards: {
          orderBy: AWARD_ORDER,
          include: {
            ...AWARD_PARTNER,
            candidate: { select: { status: true } },
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
      stage: stageOf(v),
      onlyRegistered: v.onlyRegistered,
      onlyAttended: v.onlyAttended,
      showResultsLive: v.showResultsLive,
      allowChangeVote: v.allowChangeVote,
      allowSubmissions: v.allowSubmissions,
      submissionsOpen: v.submissionsOpen,
      createdAt: v.createdAt,
      totalVotes: v._count.votes,
      screenUrl: this.getScreenUrl(v.id),
      pendingSubmissionsCount: v.candidates.filter(
        (c) => c.status === 'PENDING',
      ).length,
      candidates: v.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        photoUrl: c.photoUrl,
        order: c.order,
        status: c.status,
        submittedByName: c.submittedByName,
        submittedByTag: c.submittedByTag,
        submittedByTelegramId: c.submittedByTelegramId
          ? c.submittedByTelegramId.toString()
          : null,
        rejectionReason: c.rejectionReason,
        createdAt: c.createdAt,
        votesCount: c._count.votes,
      })),
      partnerAwards: v.partnerAwards.map((a) => ({
        id: a.id,
        eventPartnerId: a.eventPartnerId,
        title: a.title,
        prize: a.prize,
        partnerPicks: a.partnerPicks,
        showLogo: a.showLogo,
        // A pick counts only while its candidate stays approved.
        candidateId:
          a.candidate?.status === CandidateStatus.APPROVED
            ? a.candidateId
            : null,
        ...partnerOf(a.eventPartner),
        pickUrl: this.webUrl(`/pick/${a.code}`),
      })),
    }));
  }

  async createVoting(eventId: string, dto: CreateVotingDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    return this.prisma.eventVoting.create({
      data: {
        eventId,
        title: dto.title,
        description: dto.description,
        onlyRegistered: dto.onlyRegistered ?? true,
        onlyAttended: dto.onlyAttended ?? false,
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
    return {
      ...voting,
      screenUrl: this.getScreenUrl(voting.id),
    };
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
        onlyAttended: dto.onlyAttended,
        showResultsLive: dto.showResultsLive,
        allowChangeVote: dto.allowChangeVote,
        allowSubmissions: dto.allowSubmissions,
        submissionsOpen:
          dto.allowSubmissions === false ? false : dto.submissionsOpen,
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
    if (!candidate)
      throw new NotFoundException(`Candidate ${candidateId} not found`);

    return this.prisma.votingCandidate.update({
      where: { id: candidateId },
      data: {
        name: dto.name?.trim() ?? undefined,
        description:
          dto.description !== undefined
            ? dto.description?.trim() || null
            : undefined,
        photoUrl:
          dto.photoUrl !== undefined ? dto.photoUrl?.trim() || null : undefined,
        order: dto.order !== undefined ? dto.order : undefined,
      },
    });
  }

  async deleteCandidate(candidateId: string) {
    const candidate = await this.prisma.votingCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate)
      throw new NotFoundException(`Candidate ${candidateId} not found`);
    return this.prisma.votingCandidate.delete({ where: { id: candidateId } });
  }

  async getPublicVoting(id: string, telegramId?: bigint) {
    const voting = await this.prisma.eventVoting.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            noRegistration: true,
            maxRegistrations: true,
          },
        },
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
    let isAttended = isRegistered;
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
        orderBy: { attended: 'desc' },
      });
      isRegistered = isRegistered || !!reg;
      isAttended = isAttended || !!reg?.attended;

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

    const [totalRegistrations, confirmedRegistrations, attendedCount] =
      await Promise.all([
        this.prisma.eventRegistration.count({
          where: { eventId: voting.eventId },
        }),
        this.prisma.eventRegistration.count({
          where: {
            eventId: voting.eventId,
            paymentStatus: { in: ['CONFIRMED', 'NOT_REQUIRED'] },
          },
        }),
        this.prisma.eventRegistration.count({
          where: { eventId: voting.eventId, attended: true },
        }),
      ]);

    const expectedVoters =
      voting.event?.maxRegistrations && voting.event.maxRegistrations > 0
        ? voting.event.maxRegistrations
        : attendedCount > 0
          ? attendedCount
          : confirmedRegistrations > 0
            ? confirmedRegistrations
            : totalRegistrations > 0
              ? totalRegistrations
              : null;

    const turnoutPercentage =
      expectedVoters && expectedVoters > 0
        ? Math.round((totalVotes / expectedVoters) * 100)
        : null;

    const isThresholdReached =
      (turnoutPercentage !== null && turnoutPercentage >= 49) ||
      (totalVotes >= 5 &&
        voting.candidates.some(
          (c) =>
            totalVotes > 0 &&
            Math.round((c._count.votes / totalVotes) * 100) >= 49,
        ));

    const hideCandidateVotes =
      isThresholdReached && voting.status !== VotingStatus.CLOSED;

    return {
      id: voting.id,
      eventId: voting.eventId,
      eventName: voting.event.name,
      title: voting.title,
      description: voting.description,
      status: voting.status,
      stage: stageOf(voting),
      onlyRegistered: voting.onlyRegistered,
      onlyAttended: voting.onlyAttended,
      showResultsLive: voting.showResultsLive,
      allowChangeVote: voting.allowChangeVote,
      allowSubmissions: voting.allowSubmissions,
      submissionsOpen: voting.submissionsOpen,
      isRegistered,
      isAttended,
      hasVoted: !!userVotedCandidateId,
      votedCandidateId: userVotedCandidateId,
      userSubmission,
      totalVotes: canSeeResults ? totalVotes : undefined,
      isThresholdReached,
      hideCandidateVotes,
      candidates: voting.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        photoUrl: c.photoUrl,
        order: c.order,
        votesCount:
          canSeeResults && !hideCandidateVotes ? c._count.votes : undefined,
        percent:
          canSeeResults && !hideCandidateVotes && totalVotes > 0
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
      throw new BadRequestException(
        'Подання заявок не передбачено для цієї номінації',
      );
    }

    if (stageOf(voting) !== 'submissions') {
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

    if (!ownUploadExists(dto.photoUrl, OWN_IMAGE_URL)) {
      throw new BadRequestException(
        'Фото потрібно завантажити через форму заявки',
      );
    }

    const existing = await this.prisma.votingCandidate.findFirst({
      where: { votingId, submittedByTelegramId: telegramId },
    });

    if (existing?.status === CandidateStatus.APPROVED) {
      throw new BadRequestException(
        'Вашу заявку вже схвалено — змінити її неможливо. Зверніться до організаторів.',
      );
    }

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
          submittedByTag: username
            ? `@${username.replace(/^@/, '')}`
            : existing.submittedByTag,
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
      submittedByTelegramId: c.submittedByTelegramId
        ? c.submittedByTelegramId.toString()
        : null,
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
    if (!candidate)
      throw new NotFoundException(`Candidate ${candidateId} not found`);

    const updated = await this.prisma.votingCandidate.update({
      where: { id: candidateId },
      data: { status: CandidateStatus.APPROVED },
    });

    if (candidate.submittedByTelegramId) {
      const eventName = escapeHtml(candidate.voting?.event?.name || 'захід');
      const votingTitle = escapeHtml(candidate.voting?.title || 'Конкурс');
      const msg =
        `🎉 <b>Вашу заявку схвалено!</b>\n\n` +
        `Адміністратор підтвердив вашу участь у конкурсі <b>«${votingTitle}»</b> (захід <b>${eventName}</b>) із образом <b>«${escapeHtml(candidate.name)}»</b>.\n\n` +
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
    if (!candidate)
      throw new NotFoundException(`Candidate ${candidateId} not found`);

    const updated = await this.prisma.votingCandidate.update({
      where: { id: candidateId },
      data: {
        status: CandidateStatus.REJECTED,
        rejectionReason: reason ?? null,
      },
    });

    if (candidate.submittedByTelegramId) {
      const eventName = escapeHtml(candidate.voting?.event?.name || 'захід');
      const votingTitle = escapeHtml(candidate.voting?.title || 'Конкурс');
      const reasonPart = reason
        ? `\n\n<b>Причина:</b> ${escapeHtml(reason)}`
        : '';
      const msg =
        `ℹ️ <b>Оновлення щодо заявки на конкурс</b>\n\n` +
        `Вашу заявку із образом <b>«${escapeHtml(candidate.name)}»</b> у конкурсі <b>«${votingTitle}»</b> (захід <b>${eventName}</b>) було відхилено адміністратором.${reasonPart}\n\n` +
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

    const stage = stageOf(voting);
    if (stage === 'submissions') {
      throw new BadRequestException(
        'Зараз триває прийом заявок — голосування почнеться пізніше',
      );
    }
    if (stage !== 'voting') {
      throw new BadRequestException('Голосування зараз не активне');
    }

    const candidate = await this.prisma.votingCandidate.findFirst({
      where: {
        id: dto.candidateId,
        votingId,
        status: CandidateStatus.APPROVED,
      },
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

    // Registered-only and present-only nominations look at the ticket
    let registrationId: string | undefined;
    if (voting.onlyRegistered || voting.onlyAttended) {
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
          orderBy: { attended: 'desc' },
        });
        if (!reg) {
          throw new ForbiddenException(
            'Голосувати можуть тільки користувачі, які зареєстровані на цей захід',
          );
        }
        if (voting.onlyAttended && !reg.attended) {
          throw new ForbiddenException(
            'Голосувати можуть лише присутні на заході — покажіть QR-квиток на вході',
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
          [v.botUser?.firstName, v.botUser?.lastName]
            .filter(Boolean)
            .join(' ') ||
          'Анонім',
        telegramTag:
          v.registration?.telegramTag ||
          (v.botUser?.username ? `@${v.botUser.username}` : null),
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
            maxRegistrations: true,
          },
        },
        candidates: {
          where: { status: CandidateStatus.APPROVED },
          include: {
            _count: { select: { votes: true } },
          },
          orderBy: { order: 'asc' },
        },
        partnerAwards: {
          orderBy: AWARD_ORDER,
          include: {
            ...AWARD_PARTNER,
            candidate: {
              select: {
                id: true,
                name: true,
                description: true,
                photoUrl: true,
                status: true,
              },
            },
          },
        },
        _count: { select: { votes: true } },
      },
    });
    if (!voting) throw new NotFoundException(`Voting ${votingId} not found`);

    const totalVotes = voting._count.votes;

    const [totalRegistrations, confirmedRegistrations, attendedCount] =
      await Promise.all([
        this.prisma.eventRegistration.count({
          where: { eventId: voting.eventId },
        }),
        this.prisma.eventRegistration.count({
          where: {
            eventId: voting.eventId,
            paymentStatus: { in: ['CONFIRMED', 'NOT_REQUIRED'] },
          },
        }),
        this.prisma.eventRegistration.count({
          where: { eventId: voting.eventId, attended: true },
        }),
      ]);

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

    const expectedVoters =
      voting.event.maxRegistrations && voting.event.maxRegistrations > 0
        ? voting.event.maxRegistrations
        : attendedCount > 0
          ? attendedCount
          : confirmedRegistrations > 0
            ? confirmedRegistrations
            : totalRegistrations > 0
              ? totalRegistrations
              : null;

    const turnoutPercentage =
      expectedVoters && expectedVoters > 0
        ? Math.round((totalVotes / expectedVoters) * 100)
        : null;

    // 49% threshold reached when:
    // 1) Turnout has reached >= 49% of all eligible voters (totalVotes >= 0.49 * expectedVoters)
    // OR 2) Any candidate has received >= 49% of all cast votes (with at least 5 votes cast)
    const isThresholdReached =
      (turnoutPercentage !== null && turnoutPercentage >= 49) ||
      (totalVotes >= 5 && candidates.some((c) => c.percentage >= 49));

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
        expectedVoters,
        turnoutPercentage,
        isThresholdReached,
      },
      candidates,
      winners,
      partnerAwards: voting.partnerAwards.map((a) => {
        const c = a.candidate;
        return {
          id: a.id,
          title: a.title,
          prize: a.prize,
          showLogo: a.showLogo,
          ...partnerOf(a.eventPartner),
          pick:
            c && c.status === CandidateStatus.APPROVED
              ? {
                  id: c.id,
                  name: c.name,
                  description: c.description,
                  photoUrl: c.photoUrl,
                }
              : null,
        };
      }),
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
        time: new Date(v.createdAt).toLocaleString('uk-UA', {
          timeZone: 'Europe/Kyiv',
        }),
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

    // Everyone registered with a Telegram id, or only those checked in
    const registrations = await this.prisma.eventRegistration.findMany({
      where: {
        eventId: voting.eventId,
        telegramUserId: { not: null },
        ...(voting.onlyAttended && { attended: true }),
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
      `На заході <b>«${escapeHtml(voting.event.name)}»</b> відкрито голосування в номінації:\n` +
      `<b>«${escapeHtml(voting.title)}»</b>\n\n` +
      (voting.description ? `${escapeHtml(voting.description)}\n\n` : '') +
      `Переходь за кнопкою нижче та віддай свій голос:`;

    const buttonText = 'Взяти участь у голосуванні';
    return this.broadcasts.startBroadcast(
      {
        eventId: voting.eventId,
        target: BroadcastTarget.EVENT_PARTICIPANTS,
        text,
        buttonText,
        buttonUrl: votingUrl,
      },
      uniqueIds.map((id) => ({ chatId: id, telegramId: id })),
      { text, button: { text: buttonText, url: votingUrl, isWebApp: true } },
    );
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
        allowSubmissions: true,
        submissionsOpen: true,
        _count: { select: { votes: true } },
      },
    });

    return votings.map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      status: v.status,
      stage: stageOf(v),
      allowChangeVote: v.allowChangeVote,
      showResultsLive: v.showResultsLive,
      totalVotes: v._count.votes,
    }));
  }

  // --- Partner special awards ---

  private async assertPickable(votingId: string, candidateId: string) {
    const candidate = await this.prisma.votingCandidate.findFirst({
      where: { id: candidateId, votingId, status: CandidateStatus.APPROVED },
      select: { id: true },
    });
    if (!candidate) {
      throw new BadRequestException('Кандидата не знайдено в цій номінації');
    }
  }

  async createPartnerAward(votingId: string, dto: CreatePartnerAwardDto) {
    const voting = await this.prisma.eventVoting.findUnique({
      where: { id: votingId },
      select: {
        eventId: true,
        partnerAwards: { select: { eventPartnerId: true, order: true } },
      },
    });
    if (!voting) throw new NotFoundException(`Voting ${votingId} not found`);

    const partner = await this.prisma.eventPartner.findFirst({
      where: { id: dto.eventPartnerId, eventId: voting.eventId },
      select: { id: true },
    });
    if (!partner) {
      throw new BadRequestException(
        'Цього партнера немає серед партнерів заходу',
      );
    }
    if (voting.partnerAwards.some((a) => a.eventPartnerId === partner.id)) {
      throw new BadRequestException(
        'У цього партнера вже є відзнака в цій номінації',
      );
    }

    return this.prisma.votingPartnerAward.create({
      data: {
        votingId,
        eventPartnerId: partner.id,
        title: dto.title.trim() || 'Вибір партнера',
        prize: dto.prize?.trim() || null,
        partnerPicks: dto.partnerPicks ?? true,
        showLogo: dto.showLogo ?? true,
        code: randomBytes(12).toString('base64url'),
        order: Math.max(-1, ...voting.partnerAwards.map((a) => a.order)) + 1,
      },
    });
  }

  async updatePartnerAward(awardId: string, dto: UpdatePartnerAwardDto) {
    const award = await this.prisma.votingPartnerAward.findUnique({
      where: { id: awardId },
      select: { votingId: true },
    });
    if (!award) throw new NotFoundException(`Award ${awardId} not found`);
    if (dto.candidateId) {
      await this.assertPickable(award.votingId, dto.candidateId);
    }

    return this.prisma.votingPartnerAward.update({
      where: { id: awardId },
      data: {
        title: dto.title?.trim() || undefined,
        prize: dto.prize !== undefined ? dto.prize?.trim() || null : undefined,
        partnerPicks: dto.partnerPicks,
        showLogo: dto.showLogo,
        candidateId: dto.candidateId,
      },
    });
  }

  deletePartnerAward(awardId: string) {
    return this.prisma.votingPartnerAward.delete({ where: { id: awardId } });
  }

  private async findPickAward(code: string) {
    const award = await this.prisma.votingPartnerAward.findUnique({
      where: { code },
      include: {
        ...AWARD_PARTNER,
        voting: {
          select: {
            title: true,
            description: true,
            status: true,
            candidates: {
              where: { status: CandidateStatus.APPROVED },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                name: true,
                description: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });
    // An award the organizer fills in has no working link.
    if (!award || !award.partnerPicks) {
      throw new NotFoundException('Посилання недійсне');
    }
    return award;
  }

  private pickView(award: Awaited<ReturnType<VotingService['findPickAward']>>) {
    return {
      title: award.title,
      prize: award.prize,
      ...partnerOf(award.eventPartner),
      voting: {
        title: award.voting.title,
        description: award.voting.description,
        status: award.voting.status,
      },
      candidates: award.voting.candidates,
      // A pick counts only while its candidate stays approved.
      candidateId: award.voting.candidates.some(
        (c) => c.id === award.candidateId,
      )
        ? award.candidateId
        : null,
      // The partner can change the pick until the nomination's voting closes.
      locked: award.voting.status === VotingStatus.CLOSED,
    };
  }

  async getPartnerPick(code: string) {
    return this.pickView(await this.findPickAward(code));
  }

  async setPartnerPick(code: string, candidateId: string) {
    const award = await this.findPickAward(code);
    if (award.voting.status === VotingStatus.CLOSED) {
      throw new ForbiddenException(
        'Голосування вже завершено — вибір більше не змінити',
      );
    }
    if (!award.voting.candidates.some((c) => c.id === candidateId)) {
      throw new BadRequestException('Кандидата не знайдено в цій номінації');
    }
    await this.prisma.votingPartnerAward.update({
      where: { id: award.id },
      data: { candidateId },
    });
    return this.pickView({ ...award, candidateId });
  }

  // --- Stage screen remote ---

  async getScreenState(votingId: string): Promise<ScreenState> {
    const voting = await this.prisma.eventVoting.findUnique({
      where: { id: votingId },
      select: { screenState: true },
    });
    if (!voting) throw new NotFoundException(`Voting ${votingId} not found`);
    return (voting.screenState as ScreenState | null) ?? { rev: 0 };
  }

  async updateScreenState(votingId: string, dto: UpdateScreenStateDto) {
    const prev = await this.getScreenState(votingId);
    const rev = prev.rev + 1;
    const next: ScreenState = {
      ...prev,
      rev,
      ...(dto.mode && { mode: dto.mode }),
      ...(dto.theme && { theme: dto.theme }),
      ...(dto.view && { view: dto.view }),
      ...(dto.step !== undefined && { step: dto.step }),
      // A partner award is shown on its own; switching mode puts it away.
      ...(dto.mode &&
        dto.award === undefined && { award: null, awardOpen: false }),
      ...(dto.award !== undefined && {
        award: dto.award,
        awardOpen: dto.awardOpen ?? false,
      }),
      ...(dto.award === undefined &&
        dto.awardOpen !== undefined && { awardOpen: dto.awardOpen }),
      ...(dto.nav && { nav: { rev, d: dto.nav } }),
      ...(dto.salute && { salute: rev }),
    };
    await this.prisma.eventVoting.update({
      where: { id: votingId },
      data: { screenState: next },
    });
    return next;
  }
}
