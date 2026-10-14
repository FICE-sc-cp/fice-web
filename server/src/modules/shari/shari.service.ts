import { randomBytes, randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ExcelJS from 'exceljs';
import * as QRCode from 'qrcode';
import { inAdminGroup } from '../../auth/admin-group';
import type { ResolvedTelegramUser } from '../../auth/init-data.util';
import { BotService } from '../../bot/bot.service';
import { PrismaService } from '../../database/prisma.service';
import { telegramTagOf } from '../event/registration-identity';
import { PRESIDIUM_ROLES, tagUsername } from '../interview/interview-rules';
import {
  AddTeacherDto,
  CreateShariDto,
  ShariSettingsDto,
  TeacherContactsDto,
  UpdateSharaDto,
} from './shari.dto';
import {
  Course,
  ImportedTeacher,
  compareGroups,
  diffSlots,
  normalizeGroup,
  oneLine,
  parseStarostas,
  parseStudents,
  parseTeachersCsv,
  teachesGroup,
} from './shari-rules';

type User = ResolvedTelegramUser;

const SETTING_KEYS = {
  teachersOpen: 'shari_teachers_open',
  starostasOpen: 'shari_starostas_open',
} as const;
type Settings = Record<keyof typeof SETTING_KEYS, boolean>;

const BAD_LINK = 'Посилання недійсне. Напишіть нам — надішлемо нове.';
const TEACHERS_CLOSED =
  'Прийом шар завершено. Якщо треба щось змінити — напишіть нам.';
const STAROSTAS_CLOSED = 'Розподіл шар завершено';
const TEACHER_NAME = { select: { fullName: true } };
const TEACHER_SCHEDULE = { select: { fullName: true, courses: true } };

const newToken = () => randomBytes(24).toString('base64url');
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const byName = (a: string, b: string) => a.localeCompare(b, 'uk');

@Injectable()
export class ShariService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bot: BotService,
  ) {}

  // ---- Settings & shared lookups -------------------------------------------

  async settings(): Promise<Settings> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
    });
    const open = (key: string) =>
      rows.find((row) => row.key === key)?.value !== 'false';
    return {
      teachersOpen: open(SETTING_KEYS.teachersOpen),
      starostasOpen: open(SETTING_KEYS.starostasOpen),
    };
  }

  /** Every FICE group the app knows of: from the schedule, starostas, student lists and shari. */
  private async knownGroups(): Promise<string[]> {
    const [teachers, ...lists] = await Promise.all([
      this.prisma.shariTeacher.findMany({ select: { courses: true } }),
      this.prisma.shariStarosta.findMany({ select: { group: true } }),
      this.prisma.shariStudent.findMany({
        distinct: ['group'],
        select: { group: true },
      }),
      this.prisma.shara.findMany({
        distinct: ['group'],
        select: { group: true },
      }),
    ]);
    const groups = new Set(lists.flat().map((row) => row.group));
    for (const teacher of teachers) {
      for (const course of teacher.courses as Course[]) {
        for (const group of course.groups) groups.add(group);
      }
    }
    return [...groups].sort(compareGroups);
  }

  private webUrl(): string {
    return (
      this.config.get<string>('PUBLIC_WEB_URL')?.trim() ||
      'https://fice-sc.kpi.ua'
    ).replace(/\/$/, '');
  }

  private checkUrl(awardId: string): string {
    return `${this.webUrl()}/shari/check/${awardId}`;
  }

  // ---- Teachers: personal link ---------------------------------------------

  private async teacherOf(token?: string) {
    const teacher = token
      ? await this.prisma.shariTeacher.findUnique({ where: { token } })
      : null;
    if (!teacher) throw new UnauthorizedException(BAD_LINK);
    return teacher;
  }

  async teacherView(token?: string) {
    const teacher = await this.teacherOf(token);
    if (!teacher.openedAt) {
      await this.prisma.shariTeacher.update({
        where: { id: teacher.id },
        data: { openedAt: new Date() },
      });
    }
    const [shari, groups, settings] = await Promise.all([
      this.prisma.shara.findMany({
        where: { teacherId: teacher.id },
        select: {
          id: true,
          discipline: true,
          group: true,
          bonus: true,
          condition: true,
          quantity: true,
        },
      }),
      this.knownGroups(),
      this.settings(),
    ]);
    return {
      fullName: teacher.fullName,
      email: teacher.email,
      telegram: teacher.telegram,
      courses: teacher.courses as Course[],
      groups,
      shari: shari.sort(
        (a, b) =>
          byName(a.discipline, b.discipline) || compareGroups(a.group, b.group),
      ),
      open: settings.teachersOpen,
    };
  }

  async setContacts(token: string | undefined, dto: TeacherContactsDto) {
    const teacher = await this.teacherOf(token);
    const email = oneLine(dto.email) || null;
    const telegram = oneLine(dto.telegram) || null;
    if (!email && !telegram) {
      throw new BadRequestException('Вкажіть пошту або Telegram');
    }
    await this.prisma.shariTeacher.update({
      where: { id: teacher.id },
      data: { email, telegram },
    });
    return this.teacherView(token);
  }

  private async requireTeachersOpen() {
    if (!(await this.settings()).teachersOpen) {
      throw new ForbiddenException(TEACHERS_CLOSED);
    }
  }

  private sharaFields(dto: UpdateSharaDto) {
    const bonus = oneLine(dto.bonus);
    if (!bonus) throw new BadRequestException('Опишіть шару');
    return {
      bonus,
      condition: oneLine(dto.condition) || null,
      quantity: dto.quantity,
    };
  }

  async addShari(token: string | undefined, dto: CreateShariDto) {
    const teacher = await this.teacherOf(token);
    await this.requireTeachersOpen();
    const discipline = oneLine(dto.discipline);
    if (!discipline) throw new BadRequestException('Вкажіть предмет');
    const known = new Set(await this.knownGroups());
    const groups = [...new Set(dto.groups.map((g) => normalizeGroup(g) ?? g))];
    const unknown = groups.filter((group) => !known.has(group));
    if (unknown.length) {
      throw new BadRequestException(`Невідома група: ${unknown.join(', ')}`);
    }
    const fields = this.sharaFields(dto);
    await this.prisma.shara.createMany({
      data: groups.map((group) => ({
        teacherId: teacher.id,
        discipline,
        group,
        ...fields,
      })),
    });
    return this.teacherView(token);
  }

  /** The teacher's shara and the highest slot a starosta has filled (-1 if none). */
  private async ownShara(teacherId: string, id: string) {
    const shara = await this.prisma.shara.findFirst({
      where: { id, teacherId },
      select: { id: true, awards: { select: { slot: true } } },
    });
    if (!shara) throw new NotFoundException('Шару не знайдено');
    return {
      id: shara.id,
      lastSlot: Math.max(-1, ...shara.awards.map((a) => a.slot)),
    };
  }

  async updateShara(
    token: string | undefined,
    id: string,
    dto: UpdateSharaDto,
  ) {
    const teacher = await this.teacherOf(token);
    await this.requireTeachersOpen();
    const { lastSlot } = await this.ownShara(teacher.id, id);
    if (dto.quantity <= lastSlot) {
      throw new BadRequestException(
        `Отримувача шари №${lastSlot + 1} уже вписано, тому шар не може бути менше ${lastSlot + 1}. Якщо треба змінити — напишіть нам.`,
      );
    }
    await this.prisma.shara.update({
      where: { id },
      data: this.sharaFields(dto),
    });
    return this.teacherView(token);
  }

  async deleteShara(token: string | undefined, id: string) {
    const teacher = await this.teacherOf(token);
    await this.requireTeachersOpen();
    if ((await this.ownShara(teacher.id, id)).lastSlot >= 0) {
      throw new BadRequestException(
        'Отримувачів цієї шари вже вписано. Якщо її треба скасувати — напишіть нам.',
      );
    }
    await this.prisma.shara.delete({ where: { id } });
    return this.teacherView(token);
  }

  // ---- Starostas & presidium: Telegram Login Widget -------------------------

  /**
   * Admin = presidium member by tag who is also in the admin Telegram group;
   * starosta = the group set for this tag (bound to the account on first sign-in).
   */
  private async access(user: User) {
    const username = tagUsername(user.username);
    const [presidium, starosta] = await Promise.all([
      this.prisma.departmentMember.findMany({
        where: { role: { in: PRESIDIUM_ROLES }, telegramTag: { not: null } },
        select: { telegramTag: true },
      }),
      this.prisma.shariStarosta.findFirst({
        where: {
          OR: [
            { telegramId: user.telegramId },
            ...(username
              ? [{ telegramId: null, telegramTag: telegramTagOf(username) }]
              : []),
          ],
        },
      }),
    ]);
    if (starosta && starosta.telegramId === null) {
      await this.prisma.shariStarosta.update({
        where: { group: starosta.group },
        data: { telegramId: user.telegramId },
      });
    }
    const tagged =
      !!username &&
      presidium.some((m) => tagUsername(m.telegramTag) === username);
    return {
      isAdmin:
        tagged && (await inAdminGroup(this.config, this.bot, user.telegramId)),
      group: starosta?.group ?? null,
    };
  }

  async me(user: User) {
    const [access, settings] = await Promise.all([
      this.access(user),
      this.settings(),
    ]);
    return {
      user: { name: user.staffName, username: user.username ?? null },
      ...access,
      settings,
    };
  }

  private async requireAdmin(user: User) {
    if (!(await this.access(user)).isAdmin) {
      throw new ForbiddenException('Це доступно лише президії');
    }
  }

  private async requireGroup(user: User, rawGroup: string) {
    const group = normalizeGroup(rawGroup);
    if (!group) throw new NotFoundException('Невідома група');
    const access = await this.access(user);
    if (!access.isAdmin && access.group !== group) {
      throw new ForbiddenException('Це не твоя група');
    }
    return { group, isAdmin: access.isAdmin };
  }

  async groupView(user: User, rawGroup: string) {
    const { group, isAdmin } = await this.requireGroup(user, rawGroup);
    const [starosta, students, shari, settings] = await Promise.all([
      this.prisma.shariStarosta.findUnique({ where: { group } }),
      this.prisma.shariStudent.findMany({
        where: { group },
        select: { fullName: true },
      }),
      this.prisma.shara.findMany({
        where: { group },
        include: {
          teacher: TEACHER_SCHEDULE,
          awards: { select: { id: true, slot: true, studentName: true } },
        },
      }),
      this.settings(),
    ]);
    return {
      group,
      starosta: starosta?.telegramTag ?? null,
      students: students.map((s) => s.fullName).sort(byName),
      shari: shari
        .sort(
          (a, b) =>
            byName(a.discipline, b.discipline) ||
            byName(a.teacher.fullName, b.teacher.fullName),
        )
        .map((s) => ({
          id: s.id,
          discipline: s.discipline,
          teacher: s.teacher.fullName,
          bonus: s.bonus,
          condition: s.condition,
          quantity: s.quantity,
          awards: s.awards,
          // For the presidium: a teacher doesn't teach this group by the
          // schedule (a mistake, or someone else used their link).
          outsideSchedule:
            isAdmin && !teachesGroup(s.teacher.courses as Course[], group),
        })),
      canEdit: isAdmin || settings.starostasOpen,
      isAdmin,
    };
  }

  /** `names[i]` is who gets place i of the shara ("" = nobody yet). */
  async setAwards(user: User, sharaId: string, names: string[]) {
    const shara = await this.prisma.shara.findUnique({
      where: { id: sharaId },
      include: { awards: true },
    });
    if (!shara) throw new NotFoundException('Шару не знайдено');
    const { isAdmin } = await this.requireGroup(user, shara.group);
    if (!isAdmin && !(await this.settings()).starostasOpen) {
      throw new ForbiddenException(STAROSTAS_CLOSED);
    }
    if (names.length > shara.quantity) {
      throw new BadRequestException(
        `Цих шар лише ${shara.quantity}, а отримувачів — ${names.length}`,
      );
    }
    const { remove, create } = diffSlots(shara.awards, names.map(oneLine));
    await this.prisma.$transaction([
      this.prisma.shariAward.deleteMany({ where: { id: { in: remove } } }),
      this.prisma.shariAward.createMany({
        // The certificate QR checks this id: it must come from a CSPRNG.
        data: create.map((award) => ({ id: randomUUID(), sharaId, ...award })),
      }),
    ]);
    return this.groupView(user, shara.group);
  }

  /** Public: what a certificate's QR code leads to. */
  async check(id: string) {
    const award = await this.prisma.shariAward.findUnique({
      where: { id },
      include: { shara: { include: { teacher: TEACHER_NAME } } },
    });
    if (!award) throw new NotFoundException('Такої шари немає');
    return {
      studentName: award.studentName,
      group: award.shara.group,
      discipline: award.shara.discipline,
      bonus: award.shara.bonus,
      condition: award.shara.condition,
      teacher: award.shara.teacher.fullName,
    };
  }

  /** What the certificate image shows (rendered by the web app), for the group's starosta or the presidium. */
  async certificate(user: User, id: string) {
    const award = await this.check(id);
    await this.requireGroup(user, award.group);
    return {
      ...award,
      checkUrl: this.checkUrl(id),
      qr: await QRCode.toDataURL(this.checkUrl(id), {
        margin: 1,
        width: 280,
        errorCorrectionLevel: 'M',
      }),
    };
  }

  // ---- Presidium -----------------------------------------------------------

  async adminView(user: User) {
    await this.requireAdmin(user);
    const [teachers, shari, starostas, students, groups, settings] =
      await Promise.all([
        this.prisma.shariTeacher.findMany({
          select: {
            id: true,
            fullName: true,
            email: true,
            telegram: true,
            token: true,
            openedAt: true,
            shari: { select: { quantity: true } },
          },
        }),
        this.prisma.shara.findMany({
          select: {
            group: true,
            quantity: true,
            teacher: { select: { courses: true } },
            _count: { select: { awards: true } },
          },
        }),
        this.prisma.shariStarosta.findMany(),
        this.prisma.shariStudent.groupBy({
          by: ['group'],
          _count: { _all: true },
        }),
        this.knownGroups(),
        this.settings(),
      ]);

    const rows = new Map(
      groups.map((group) => [
        group,
        {
          group,
          starosta: null as string | null,
          signedIn: false,
          students: 0,
          shari: 0,
          awarded: 0,
          outsideSchedule: 0,
        },
      ]),
    );
    for (const s of starostas) {
      const row = rows.get(s.group)!;
      row.starosta = s.telegramTag;
      row.signedIn = s.telegramId !== null;
    }
    for (const s of students) rows.get(s.group)!.students = s._count._all;
    for (const s of shari) {
      const row = rows.get(s.group)!;
      row.shari += s.quantity;
      row.awarded += s._count.awards;
      if (!teachesGroup(s.teacher.courses as Course[], s.group)) {
        row.outsideSchedule += s.quantity;
      }
    }

    const teacherRows = teachers
      .map(({ shari: own, ...t }) => ({
        ...t,
        offers: own.length,
        quantity: sum(own.map((s) => s.quantity)),
      }))
      .sort((a, b) => byName(a.fullName, b.fullName));
    return {
      settings,
      totals: {
        teachers: teachers.length,
        teachersOpened: teachers.filter((t) => t.openedAt).length,
        teachersWithShari: teacherRows.filter((t) => t.offers).length,
        shari: sum(shari.map((s) => s.quantity)),
        awarded: sum(shari.map((s) => s._count.awards)),
        outsideSchedule: sum([...rows.values()].map((r) => r.outsideSchedule)),
        groups: groups.length,
        groupsWithShari: [...rows.values()].filter((r) => r.shari).length,
        starostas: starostas.length,
        starostasSignedIn: starostas.filter((s) => s.telegramId !== null)
          .length,
        students: sum(students.map((s) => s._count._all)),
      },
      teachers: teacherRows,
      groups: [...rows.values()],
    };
  }

  async setSettings(user: User, dto: ShariSettingsDto) {
    await this.requireAdmin(user);
    for (const name of Object.keys(SETTING_KEYS) as (keyof Settings)[]) {
      if (dto[name] === undefined) continue;
      const key = SETTING_KEYS[name];
      const value = String(dto[name]);
      await this.prisma.siteSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    return this.settings();
  }

  /** Adds new teachers and refreshes the schedule of known ones; contacts already set are kept. */
  async importTeachers(user: User, csv: string) {
    await this.requireAdmin(user);
    let parsed: ImportedTeacher[];
    try {
      parsed = parseTeachersCsv(csv);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Не вдалося прочитати CSV',
      );
    }
    const existing = new Map(
      (
        await this.prisma.shariTeacher.findMany({
          select: { id: true, fullName: true, email: true, telegram: true },
        })
      ).map((t) => [t.fullName, t]),
    );
    // No transaction: hundreds of writes outrun its timeout, and the import is
    // idempotent, so running it again finishes an interrupted one.
    const fresh = parsed.filter((t) => !existing.has(t.fullName));
    await this.prisma.shariTeacher.createMany({
      data: fresh.map((t) => ({ ...t, token: newToken() })),
    });
    for (const t of parsed) {
      const old = existing.get(t.fullName);
      if (!old) continue;
      await this.prisma.shariTeacher.update({
        where: { id: old.id },
        data: {
          courses: t.courses,
          email: old.email ?? t.email,
          telegram: old.telegram ?? t.telegram,
        },
      });
    }
    return {
      message: `Нових викладачів: ${fresh.length}, оновлено: ${parsed.length - fresh.length}`,
      skipped: [],
    };
  }

  async addTeacher(user: User, dto: AddTeacherDto) {
    await this.requireAdmin(user);
    const fullName = oneLine(dto.fullName);
    if (!fullName) throw new BadRequestException('Вкажіть ПІБ');
    if (await this.prisma.shariTeacher.findUnique({ where: { fullName } })) {
      throw new ConflictException('Такий викладач уже є у списку');
    }
    return this.prisma.shariTeacher.create({
      data: {
        fullName,
        email: oneLine(dto.email) || null,
        telegram: oneLine(dto.telegram) || null,
        token: newToken(),
      },
      select: { id: true, token: true },
    });
  }

  /** A new personal link; the old one stops working. */
  async reissueLink(user: User, id: string) {
    await this.requireAdmin(user);
    return this.prisma.shariTeacher.update({
      where: { id },
      data: { token: newToken(), openedAt: null },
      select: { id: true, token: true },
    });
  }

  /** Removes a teacher without shari: a test entry or a duplicate. */
  async removeTeacher(user: User, id: string) {
    await this.requireAdmin(user);
    if (await this.prisma.shara.count({ where: { teacherId: id } })) {
      throw new BadRequestException(
        'У викладача є шари — спершу видаліть їх (вкладка «Групи»)',
      );
    }
    await this.prisma.shariTeacher.delete({ where: { id } });
    return { ok: true };
  }

  async importStarostas(user: User, text: string) {
    await this.requireAdmin(user);
    const { starostas, skipped } = parseStarostas(text);
    const current = new Map(
      (await this.prisma.shariStarosta.findMany()).map((s) => [s.group, s]),
    );
    const saved = starostas.filter((s) => s.telegramTag);
    const removed = starostas.filter(
      (s) => !s.telegramTag && current.has(s.group),
    );
    await this.prisma.shariStarosta.deleteMany({
      where: { group: { in: removed.map((s) => s.group) } },
    });
    // One by one like the teacher import; a new tag drops the old starosta's binding.
    for (const { group, telegramTag } of saved) {
      if (current.get(group)?.telegramTag === telegramTag) continue;
      await this.prisma.shariStarosta.upsert({
        where: { group },
        create: { group, telegramTag: telegramTag! },
        update: { telegramTag: telegramTag!, telegramId: null },
      });
    }
    return {
      message: `Старост збережено: ${saved.length}, прибрано: ${removed.length}`,
      skipped,
    };
  }

  /** Replaces the lists of the groups in the text; other groups stay as they are. */
  async importStudents(user: User, text: string) {
    await this.requireAdmin(user);
    const { groups, skipped } = parseStudents(text);
    // A transaction per group: a list is never left half-replaced.
    for (const [group, names] of groups) {
      await this.prisma.$transaction([
        this.prisma.shariStudent.deleteMany({ where: { group } }),
        this.prisma.shariStudent.createMany({
          data: [...names].map((fullName) => ({ group, fullName })),
        }),
      ]);
    }
    const count = sum([...groups.values()].map((names) => names.size));
    return {
      message: `Груп: ${groups.size}, студентів: ${count}`,
      skipped,
    };
  }

  async removeShara(user: User, id: string) {
    await this.requireAdmin(user);
    await this.prisma.shara.delete({ where: { id } });
    return { ok: true };
  }

  async exportXlsx(user: User): Promise<Buffer> {
    await this.requireAdmin(user);
    const [shari, teachers, starostas] = await Promise.all([
      this.prisma.shara.findMany({
        include: {
          teacher: TEACHER_SCHEDULE,
          awards: { orderBy: { slot: 'asc' } },
        },
      }),
      this.prisma.shariTeacher.findMany({
        include: { shari: { select: { quantity: true } } },
      }),
      this.prisma.shariStarosta.findMany(),
    ]);
    shari.sort(
      (a, b) =>
        compareGroups(a.group, b.group) || byName(a.discipline, b.discipline),
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = (name: string, columns: [string, number][]) => {
      const ws = workbook.addWorksheet(name);
      ws.columns = columns.map(([header, width]) => ({ header, width }));
      ws.getRow(1).font = { bold: true };
      return ws;
    };

    const offers = sheet('Шари', [
      ['Група', 12],
      ['Предмет', 40],
      ['Викладач', 32],
      ['Шара', 40],
      ['Умова', 30],
      ['Кількість', 10],
      ['Отримувачі', 60],
      ['Поза розкладом викладача', 14],
    ]);
    const awards = sheet('Сертифікати', [
      ['Група', 12],
      ['Студент', 34],
      ['Предмет', 40],
      ['Шара', 40],
      ['Умова', 30],
      ['Викладач', 32],
      ['Перевірка', 70],
    ]);
    for (const s of shari) {
      offers.addRow([
        s.group,
        s.discipline,
        s.teacher.fullName,
        s.bonus,
        s.condition ?? '',
        s.quantity,
        s.awards.map((a) => a.studentName).join(', '),
        teachesGroup(s.teacher.courses as Course[], s.group) ? '' : 'так',
      ]);
      for (const a of s.awards) {
        awards.addRow([
          s.group,
          a.studentName,
          s.discipline,
          s.bonus,
          s.condition ?? '',
          s.teacher.fullName,
          this.checkUrl(a.id),
        ]);
      }
    }

    // Who got how many: a starosta handing everything to a few friends shows up here.
    const perStudent = new Map<
      string,
      { group: string; name: string; disciplines: string[] }
    >();
    for (const s of shari) {
      for (const a of s.awards) {
        const key = `${s.group}
${a.studentName}`;
        const row = perStudent.get(key) ?? {
          group: s.group,
          name: a.studentName,
          disciplines: [],
        };
        row.disciplines.push(s.discipline);
        perStudent.set(key, row);
      }
    }
    const studentSheet = sheet('Студенти', [
      ['Група', 12],
      ['Студент', 34],
      ['Шар', 8],
      ['Предмети', 70],
    ]);
    for (const row of [...perStudent.values()].sort(
      (a, b) =>
        b.disciplines.length - a.disciplines.length ||
        compareGroups(a.group, b.group),
    )) {
      studentSheet.addRow([
        row.group,
        row.name,
        row.disciplines.length,
        row.disciplines.join('; '),
      ]);
    }

    const teacherSheet = sheet('Викладачі', [
      ['ПІБ', 34],
      ['Пошта', 34],
      ['Telegram', 28],
      ['Особисте посилання', 70],
      ['Посилання відкрито', 18],
      ['Шар внесено', 12],
    ]);
    for (const t of teachers.sort((a, b) => byName(a.fullName, b.fullName))) {
      teacherSheet.addRow([
        t.fullName,
        t.email ?? '',
        t.telegram ?? '',
        `${this.webUrl()}/shari/t/${t.token}`,
        t.openedAt ? 'так' : 'ні',
        sum(t.shari.map((s) => s.quantity)),
      ]);
    }

    const starostaSheet = sheet('Старости', [
      ['Група', 12],
      ['Telegram', 26],
      ['Вхід на сайт', 13],
    ]);
    for (const s of starostas.sort((a, b) => compareGroups(a.group, b.group))) {
      starostaSheet.addRow([
        s.group,
        s.telegramTag,
        s.telegramId !== null ? 'так' : 'ні',
      ]);
    }

    return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
  }
}
