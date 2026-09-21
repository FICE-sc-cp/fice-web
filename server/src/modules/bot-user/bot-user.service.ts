import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class BotUserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(telegramId: bigint) {
    const user = await this.prisma.botUser.findUnique({
      where: { telegramId },
    });
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      group: user.group,
      birthDate: user.birthDate,
      phoneNumber: user.phoneNumber,
    };
  }

  async updateProfile(telegramId: bigint, dto: UpdateProfileDto) {
    const user = await this.prisma.botUser.upsert({
      where: { telegramId },
      create: {
        telegramId,
        chatId: telegramId,
        fullName: dto.fullName ?? null,
        group: dto.group ?? null,
        birthDate: dto.birthDate ?? null,
        phoneNumber: dto.phoneNumber ?? null,
      },
      update: {
        fullName: dto.fullName ?? undefined,
        group: dto.group ?? undefined,
        birthDate: dto.birthDate ?? undefined,
        phoneNumber: dto.phoneNumber ?? undefined,
      },
    });

    return {
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      group: user.group,
      birthDate: user.birthDate,
      phoneNumber: user.phoneNumber,
    };
  }

  async getMyRegistrations(telegramId: bigint) {
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { telegramUserId: telegramId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            date: true,
            photoUrl: true,
            location: true,
            locationNote: true,
            timeNote: true,
            feeAmount: true,
            feeAtEventAmount: true,
            feeRequisites: true,
            registrationCloseDate: true,
          },
        },
        answers: {
          include: { question: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return registrations.map((r) => ({
      ...r,
      telegramUserId: r.telegramUserId?.toString(),
    }));
  }

  async getStats() {
    const [totalUsers, activeUsers] = await Promise.all([
      this.prisma.botUser.count(),
      this.prisma.botUser.count({ where: { isBlocked: false } }),
    ]);
    return { totalUsers, activeUsers };
  }

  async cancelRegistration(registrationId: string, telegramId: bigint) {
    const reg = await this.prisma.eventRegistration.findUnique({
      where: { id: registrationId },
    });
    if (!reg) {
      throw new NotFoundException('Реєстрацію не знайдено');
    }
    if (reg.telegramUserId !== telegramId) {
      throw new ForbiddenException('Ви не можете скасувати чужу реєстрацію');
    }

    await this.prisma.eventRegistration.delete({
      where: { id: registrationId },
    });

    return { ok: true, message: 'Реєстрацію успішно скасовано' };
  }
}
