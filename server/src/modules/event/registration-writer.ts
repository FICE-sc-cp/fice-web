import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  EventRegistration,
  PaymentStatus,
  PrismaClient,
  RegistrationPayment,
  RegistrationSource,
} from '@prisma/client';
import {
  registrationClosedMessage,
  registrationClosedReason,
} from './event-timing';

type Db = Pick<PrismaClient, '$transaction'>;

export interface NewRegistration {
  eventId: string;
  botUserId: string;
  telegramUserId: bigint;
  telegramTag: string;
  fullName: string;
  group: string;
  birthDate: Date | null;
  source: RegistrationSource;
  payment: RegistrationPayment;
  paymentStatus: PaymentStatus;
  receiptUrl: string | null;
  phoneNumber: string | null;
  answers: { questionId: string; value: string }[];
}

export type RegistrationWriteResult =
  | { created: EventRegistration; existing?: undefined }
  | { existing: EventRegistration; created?: undefined };

export async function createRegistrationGuarded(
  prisma: Db,
  data: NewRegistration,
  now: Date = new Date(),
): Promise<RegistrationWriteResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${data.eventId}::uuid FOR UPDATE`;

    const event = await tx.event.findUnique({
      where: { id: data.eventId },
      select: {
        date: true,
        hasTime: true,
        registrationCloseDate: true,
        noRegistration: true,
        isDraft: true,
        maxRegistrations: true,
      },
    });
    if (!event) throw new NotFoundException('Захід не знайдено');

    const existing = await tx.eventRegistration.findFirst({
      where: {
        eventId: data.eventId,
        OR: [
          { telegramUserId: data.telegramUserId },
          { telegramTag: data.telegramTag },
        ],
      },
    });
    if (existing) return { existing };

    const registeredCount = await tx.eventRegistration.count({
      where: { eventId: data.eventId },
    });
    const reason = registrationClosedReason(event, registeredCount, now);
    if (reason) {
      throw new BadRequestException(registrationClosedMessage(reason, event));
    }

    const created = await tx.eventRegistration.create({
      data: {
        eventId: data.eventId,
        botUserId: data.botUserId,
        telegramUserId: data.telegramUserId,
        telegramTag: data.telegramTag,
        fullName: data.fullName,
        group: data.group,
        birthDate: data.birthDate,
        source: data.source,
        payment: data.payment,
        paymentStatus: data.paymentStatus,
        receiptUrl: data.receiptUrl,
        phoneNumber: data.phoneNumber,
        answers: data.answers.length ? { create: data.answers } : undefined,
      },
    });
    return { created };
  });
}
