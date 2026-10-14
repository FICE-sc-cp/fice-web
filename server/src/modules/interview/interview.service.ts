import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InterviewSlot, InterviewStatus } from '@prisma/client';
import { inAdminGroup } from '../../auth/admin-group';
import type { ResolvedTelegramUser } from '../../auth/init-data.util';
import { BotService } from '../../bot/bot.service';
import { InterviewBotService } from '../../bot/interview-bot.service';
import { escapeHtml } from '../../common/html';
import { errorMessage } from '../../common/log-safe';
import { PrismaService } from '../../database/prisma.service';
import { startOfKyivDay } from '../event/event-timing';
import { telegramTagOf } from '../event/registration-identity';
import { AddCandidateDto, CreateSlotsDto } from './interview.dto';
import {
  BOOKING_LEAD_MS,
  MAX_DEPARTMENTS_PER_CANDIDATE,
  MAX_SLOTS_PER_BATCH,
  PRESIDIUM_ROLES,
  REMINDER_BEFORE_MS,
  StaffRole,
  bookingProblem,
  overlaps,
  splitWindow,
  staffRoles,
  tagUsername,
} from './interview-rules';

type User = ResolvedTelegramUser;

const REMINDER_TICK_MS = 60_000;
const SLOT_TAKEN = 'Цей час уже зайняли — обери інший';
const BAD_TAG = 'Невірний Telegram-тег (наприклад, @username)';
const APPLICANT_NAME = { select: { firstName: true, lastName: true } };

const when = new Intl.DateTimeFormat('uk-UA', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
});

interface Person {
  telegramTag: string;
  name: string | null;
  applicant: { firstName: string; lastName: string } | null;
}

function personLabel(p: Person): string {
  const name = p.applicant
    ? `${p.applicant.lastName} ${p.applicant.firstName}`
    : p.name;
  return escapeHtml(name ? `${name} (${p.telegramTag})` : p.telegramTag);
}

function displayName(user: User): string {
  return user.staffName.slice(0, 120);
}

@Injectable()
export class InterviewService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InterviewService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: InterviewBotService,
    private readonly adminBot: BotService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.bot.enabled) return;
    this.timer = setInterval(() => {
      this.sendReminders().catch((err) =>
        this.logger.warn('Interview reminders failed: ' + errorMessage(err)),
      );
    }, REMINDER_TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---- Identity & roles -----------------------------------------------------

  /** Rows added for this person: bound to their account, or still waiting on their tag. */
  private ownRows(user: User) {
    const username = tagUsername(user.username);
    return {
      OR: [
        { telegramId: user.telegramId },
        ...(username
          ? [{ telegramId: null, telegramTag: telegramTagOf(username) }]
          : []),
      ],
    };
  }

  private async access(user: User) {
    const username = tagUsername(user.username);
    const [departments, presidium, recruiters] = await Promise.all([
      this.prisma.department.findMany({
        select: {
          id: true,
          name: true,
          shortName: true,
          interviewSlotMinutes: true,
          head: { select: { telegramTag: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.departmentMember.findMany({
        where: { role: { in: PRESIDIUM_ROLES }, telegramTag: { not: null } },
        select: { telegramTag: true },
      }),
      this.prisma.interviewRecruiter.findMany({
        where: this.ownRows(user),
        select: { departmentId: true },
      }),
    ]);
    const isAdmin =
      !!username &&
      presidium.some((m) => tagUsername(m.telegramTag) === username) &&
      (await inAdminGroup(this.config, this.adminBot, user.telegramId));
    const roles = staffRoles(
      username,
      departments,
      recruiters.map((r) => r.departmentId),
      isAdmin,
    );
    return { isAdmin, roles, departments };
  }

  private async roleIn(user: User, departmentId: string): Promise<StaffRole> {
    const role = (await this.access(user)).roles.get(departmentId);
    if (!role) {
      throw new ForbiddenException('Немає доступу до цього департаменту');
    }
    return role;
  }

  private async requireHead(user: User, departmentId: string) {
    if ((await this.roleIn(user, departmentId)) !== 'HEAD') {
      throw new ForbiddenException('Це може зробити лише голова департаменту');
    }
  }

  /** Everything the mini-app shows: the person's own interviews and, for staff, their departments. */
  async me(user: User) {
    const username = tagUsername(user.username);
    if (username) {
      const bind = {
        where: { telegramId: null, telegramTag: telegramTagOf(username) },
        data: { telegramId: user.telegramId, name: displayName(user) },
      };
      await Promise.all([
        this.prisma.interviewCandidate.updateMany(bind),
        this.prisma.interviewRecruiter.updateMany(bind),
      ]);
    }

    const { isAdmin, roles, departments } = await this.access(user);
    const deptIds = [...roles.keys()];
    const headIds = deptIds.filter((id) => roles.get(id) === 'HEAD');
    const [candidacies, candidates, slots, recruiters] = await Promise.all([
      this.prisma.interviewCandidate.findMany({
        where: { telegramId: user.telegramId },
        select: {
          id: true,
          department: { select: { id: true, name: true } },
          slot: { select: { id: true, startsAt: true, endsAt: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.interviewCandidate.findMany({
        where: { departmentId: { in: deptIds } },
        include: {
          applicant: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              group: true,
              phoneNumber: true,
              motivation: true,
              experience: true,
              applicantDepartments: {
                select: { departmentId: true, question: true },
              },
            },
          },
          slot: {
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              hostName: true,
              hostTelegramId: true,
            },
          },
          notes: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.interviewSlot.findMany({
        where: {
          departmentId: { in: deptIds },
          startsAt: { gte: startOfKyivDay(new Date()) },
        },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.interviewRecruiter.findMany({
        where: { departmentId: { in: headIds } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      user: {
        id: String(user.telegramId),
        username,
        name: displayName(user),
      },
      botUsername: this.bot.getUsername() ?? null,
      isAdmin,
      candidacies,
      departments: departments
        .filter((d) => roles.has(d.id))
        .map((d) => ({
          id: d.id,
          name: d.name,
          shortName: d.shortName,
          slotMinutes: d.interviewSlotMinutes,
          role: roles.get(d.id),
          recruiters: recruiters.filter((r) => r.departmentId === d.id),
        })),
      candidates,
      slots,
    };
  }

  // ---- Candidate: booking ---------------------------------------------------

  private bookedElsewhere(user: User, candidacyId: string) {
    return this.prisma.interviewSlot.findMany({
      where: {
        candidate: { telegramId: user.telegramId, id: { not: candidacyId } },
      },
      select: { startsAt: true, endsAt: true },
    });
  }

  async freeSlots(user: User, candidacyId: string) {
    const candidacy = await this.prisma.interviewCandidate.findFirst({
      where: { id: candidacyId, telegramId: user.telegramId },
      select: { departmentId: true },
    });
    if (!candidacy) throw new NotFoundException('Співбесіду не знайдено');

    const [slots, busy] = await Promise.all([
      this.prisma.interviewSlot.findMany({
        where: {
          departmentId: candidacy.departmentId,
          candidateId: null,
          startsAt: { gt: new Date(Date.now() + BOOKING_LEAD_MS) },
        },
        select: { id: true, startsAt: true, endsAt: true },
        orderBy: { startsAt: 'asc' },
      }),
      this.bookedElsewhere(user, candidacyId),
    ]);
    // Several recruiters may offer the same time; the candidate only picks a time.
    const times = new Set<number>();
    return slots.filter((slot) => {
      const time = slot.startsAt.getTime();
      if (times.has(time) || busy.some((b) => overlaps(b, slot))) return false;
      times.add(time);
      return true;
    });
  }

  async book(user: User, candidacyId: string, slotId: string) {
    const candidacy = await this.prisma.interviewCandidate.findFirst({
      where: { id: candidacyId, telegramId: user.telegramId },
      include: {
        slot: true,
        department: { select: { name: true } },
        applicant: APPLICANT_NAME,
      },
    });
    if (!candidacy) throw new NotFoundException('Співбесіду не знайдено');
    const target = await this.prisma.interviewSlot.findUnique({
      where: { id: slotId },
    });
    if (
      !target ||
      target.departmentId !== candidacy.departmentId ||
      target.candidateId
    ) {
      throw new ConflictException(SLOT_TAKEN);
    }
    const problem = bookingProblem(
      new Date(),
      target,
      candidacy.slot,
      await this.bookedElsewhere(user, candidacyId),
    );
    if (problem) throw new BadRequestException(problem);

    const previous = candidacy.slot;
    await this.prisma.$transaction(async (tx) => {
      if (previous) {
        await tx.interviewSlot.update({
          where: { id: previous.id },
          data: { candidateId: null },
        });
      }
      const { count } = await tx.interviewSlot.updateMany({
        where: { id: slotId, candidateId: null },
        data: { candidateId: candidacyId },
      });
      if (!count) throw new ConflictException(SLOT_TAKEN);
    });

    void this.notifyBooked(user, candidacy, previous, target).catch((err) =>
      this.logger.warn('Booking notification failed: ' + errorMessage(err)),
    );
    return {
      slot: { id: target.id, startsAt: target.startsAt, endsAt: target.endsAt },
    };
  }

  private async notifyBooked(
    user: User,
    candidacy: Person & { department: { name: string } },
    previous: InterviewSlot | null,
    slot: InterviewSlot,
  ) {
    const head = `${escapeHtml(candidacy.department.name)}\n👤 ${personLabel(candidacy)}`;
    const time = `🕒 <b>${when.format(slot.startsAt)}</b>`;
    if (previous && previous.hostTelegramId === slot.hostTelegramId) {
      await this.bot.send(
        slot.hostTelegramId,
        `🔁 <b>Кандидат змінив час співбесіди</b>\n${head}\nБуло: ${when.format(previous.startsAt)}\n${time}`,
      );
    } else {
      if (previous) {
        await this.bot.send(
          previous.hostTelegramId,
          `🔁 <b>Кандидат переніс співбесіду на інший час</b>\n${head}\nТвій слот ${when.format(previous.startsAt)} знову вільний.`,
        );
      }
      await this.bot.send(
        slot.hostTelegramId,
        `🗓 <b>Новий запис на співбесіду</b>\n${head}\n${time}`,
      );
    }
    await this.bot.send(
      user.telegramId,
      `✅ <b>${previous ? 'Час співбесіди змінено' : 'Тебе записано на співбесіду'}</b>\n` +
        `${escapeHtml(candidacy.department.name)}\n${time}\n\nПосилання на зустріч надішле рекрутер.`,
    );
  }

  // ---- Staff: slots ---------------------------------------------------------

  async createSlots(user: User, dto: CreateSlotsDto) {
    await this.roleIn(user, dto.departmentId);
    const { interviewSlotMinutes: minutes } =
      await this.prisma.department.findUniqueOrThrow({
        where: { id: dto.departmentId },
        select: { interviewSlotMinutes: true },
      });
    const now = new Date();
    const spans = splitWindow(dto.date, dto.from, dto.to, minutes).filter(
      (s) => s.startsAt > now,
    );
    if (!spans.length) {
      throw new BadRequestException(
        `У цей проміжок не вміщується жоден слот по ${minutes} хв, або цей час уже минув`,
      );
    }
    if (spans.length > MAX_SLOTS_PER_BATCH) {
      throw new BadRequestException(
        `Забагато слотів за раз (максимум ${MAX_SLOTS_PER_BATCH})`,
      );
    }
    // The same person can't hold two interviews at once, in any department.
    const busy = await this.prisma.interviewSlot.findMany({
      where: {
        hostTelegramId: user.telegramId,
        startsAt: { lt: spans[spans.length - 1].endsAt },
        endsAt: { gt: spans[0].startsAt },
      },
      select: { startsAt: true, endsAt: true },
    });
    const fresh = spans.filter((s) => !busy.some((b) => overlaps(b, s)));
    await this.prisma.interviewSlot.createMany({
      data: fresh.map((s) => ({
        ...s,
        departmentId: dto.departmentId,
        hostTelegramId: user.telegramId,
        hostName: displayName(user),
      })),
    });
    return { created: fresh.length, skipped: spans.length - fresh.length };
  }

  async deleteSlot(user: User, id: string) {
    const slot = await this.prisma.interviewSlot.findUnique({ where: { id } });
    if (!slot) throw new NotFoundException('Слот не знайдено');
    const role = await this.roleIn(user, slot.departmentId);
    if (slot.hostTelegramId !== user.telegramId && role !== 'HEAD') {
      throw new ForbiddenException('Можна видалити лише свій слот');
    }
    const { count } = await this.prisma.interviewSlot.deleteMany({
      where: { id, candidateId: null },
    });
    if (!count) {
      throw new ConflictException(
        'На цей час уже записався кандидат — слот не можна видалити',
      );
    }
    return { ok: true };
  }

  // ---- Staff: candidates ----------------------------------------------------

  private async candidateFor(user: User, id: string, headOnly = false) {
    const candidate = await this.prisma.interviewCandidate.findUnique({
      where: { id },
      include: {
        slot: true,
        department: { select: { name: true } },
        applicant: APPLICANT_NAME,
      },
    });
    if (!candidate) throw new NotFoundException('Кандидата не знайдено');
    if (headOnly) await this.requireHead(user, candidate.departmentId);
    else await this.roleIn(user, candidate.departmentId);
    return candidate;
  }

  async addCandidate(user: User, dto: AddCandidateDto) {
    await this.requireHead(user, dto.departmentId);
    const username = tagUsername(dto.telegramTag);
    if (!username) throw new BadRequestException(BAD_TAG);
    const telegramTag = telegramTagOf(username);

    const existing = await this.prisma.interviewCandidate.findMany({
      where: { telegramTag },
      select: { departmentId: true },
    });
    if (existing.some((c) => c.departmentId === dto.departmentId)) {
      throw new ConflictException('Цього кандидата вже додано');
    }
    if (existing.length >= MAX_DEPARTMENTS_PER_CANDIDATE) {
      throw new BadRequestException(
        'Кандидат уже має співбесіди у двох департаментах',
      );
    }

    // Link the site application so recruiters see the name, group and answers.
    const applications = await this.prisma.applicant.findMany({
      where: { telegramTag: { equals: telegramTag, mode: 'insensitive' } },
      select: {
        id: true,
        applicantDepartments: { select: { departmentId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const application =
      applications.find((a) =>
        a.applicantDepartments.some((d) => d.departmentId === dto.departmentId),
      ) ?? applications[0];

    return this.prisma.interviewCandidate.create({
      data: {
        departmentId: dto.departmentId,
        telegramTag,
        applicantId: application?.id,
      },
    });
  }

  async removeCandidate(user: User, id: string) {
    const candidate = await this.candidateFor(user, id, true);
    await this.prisma.interviewCandidate.delete({ where: { id } });
    const slot = candidate.slot;
    if (slot && slot.startsAt > new Date()) {
      void this.bot.send(
        slot.hostTelegramId,
        `❌ <b>Співбесіду скасовано</b>\n${escapeHtml(candidate.department.name)}\n` +
          `👤 ${personLabel(candidate)} — кандидата прибрали зі списку.\n` +
          `Слот ${when.format(slot.startsAt)} знову вільний.`,
      );
    }
    return { ok: true };
  }

  async setStatus(user: User, id: string, status: InterviewStatus) {
    await this.candidateFor(user, id);
    return this.prisma.interviewCandidate.update({
      where: { id },
      data: { status },
    });
  }

  async addNote(user: User, id: string, text: string) {
    await this.candidateFor(user, id);
    if (!text.trim()) throw new BadRequestException('Нотатка порожня');
    return this.prisma.interviewNote.create({
      data: {
        candidateId: id,
        authorTelegramId: user.telegramId,
        authorName: displayName(user),
        text: text.trim(),
      },
    });
  }

  async deleteNote(user: User, id: string) {
    const { count } = await this.prisma.interviewNote.deleteMany({
      where: { id, authorTelegramId: user.telegramId },
    });
    if (!count) throw new NotFoundException('Нотатку не знайдено');
    return { ok: true };
  }

  /** Site applications to this department that are not interview candidates yet. */
  async applicants(user: User, departmentId: string) {
    await this.requireHead(user, departmentId);
    const [rows, added] = await Promise.all([
      this.prisma.applicant.findMany({
        where: { applicantDepartments: { some: { departmentId } } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          telegramTag: true,
          group: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.interviewCandidate.findMany({
        where: { departmentId },
        select: { telegramTag: true },
      }),
    ]);
    const seen = new Set(added.map((c) => c.telegramTag));
    return rows.filter((row) => {
      const username = tagUsername(row.telegramTag);
      if (!username || seen.has(telegramTagOf(username))) return false;
      seen.add(telegramTagOf(username));
      return true;
    });
  }

  // ---- Head: team -----------------------------------------------------------

  async setSlotMinutes(user: User, departmentId: string, slotMinutes: number) {
    await this.requireHead(user, departmentId);
    await this.prisma.department.update({
      where: { id: departmentId },
      data: { interviewSlotMinutes: slotMinutes },
    });
    return { slotMinutes };
  }

  async addRecruiter(user: User, departmentId: string, rawTag: string) {
    await this.requireHead(user, departmentId);
    const username = tagUsername(rawTag);
    if (!username) throw new BadRequestException(BAD_TAG);
    const telegramTag = telegramTagOf(username);
    const exists = await this.prisma.interviewRecruiter.findUnique({
      where: { departmentId_telegramTag: { departmentId, telegramTag } },
    });
    if (exists) throw new ConflictException('Цього рекрутера вже додано');
    return this.prisma.interviewRecruiter.create({
      data: { departmentId, telegramTag },
    });
  }

  async removeRecruiter(user: User, id: string) {
    const recruiter = await this.prisma.interviewRecruiter.findUnique({
      where: { id },
    });
    if (!recruiter) throw new NotFoundException('Рекрутера не знайдено');
    await this.requireHead(user, recruiter.departmentId);
    await this.prisma.interviewRecruiter.delete({ where: { id } });
    if (recruiter.telegramId) {
      // Booked interviews stay; only the times nobody took disappear.
      await this.prisma.interviewSlot.deleteMany({
        where: {
          departmentId: recruiter.departmentId,
          hostTelegramId: recruiter.telegramId,
          candidateId: null,
          startsAt: { gt: new Date() },
        },
      });
    }
    return { ok: true };
  }

  // ---- Reminders ------------------------------------------------------------

  async sendReminders(now = new Date()) {
    const due = await this.prisma.interviewSlot.findMany({
      where: {
        candidateId: { not: null },
        reminderSentAt: null,
        startsAt: {
          gt: now,
          lte: new Date(now.getTime() + REMINDER_BEFORE_MS),
        },
      },
      include: {
        department: { select: { name: true } },
        candidate: { include: { applicant: APPLICANT_NAME } },
      },
    });
    for (const slot of due) {
      const { count } = await this.prisma.interviewSlot.updateMany({
        where: { id: slot.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (!count || !slot.candidate) continue;
      const minutes = Math.max(
        1,
        Math.round((slot.startsAt.getTime() - now.getTime()) / 60_000),
      );
      await this.bot.send(
        slot.hostTelegramId,
        `⏰ <b>Через ${minutes} хв співбесіда</b>\n${escapeHtml(slot.department.name)}\n` +
          `👤 ${personLabel(slot.candidate)}\n🕒 ${when.format(slot.startsAt)}\n\n` +
          'Не забудь надіслати кандидату посилання на зустріч.',
      );
    }
  }
}
