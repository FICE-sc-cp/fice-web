import type { Prisma } from '@prisma/client';
import type { RegistrationListQueryDto } from './dto/registration-list-query.dto';

const TICKET_PREFIX = /^[0-9a-f]{4,8}$/i;

function ticketPrefixRange(prefix: string): Prisma.EventRegistrationWhereInput {
  const p = prefix.toLowerCase();
  return {
    ticketCode: {
      gte: `${p.padEnd(8, '0')}-0000-0000-0000-000000000000`,
      lte: `${p.padEnd(8, 'f')}-ffff-ffff-ffff-ffffffffffff`,
    },
  };
}

export function registrationListWhere(
  eventId: string,
  query: Pick<
    RegistrationListQueryDto,
    'payment' | 'source' | 'attended' | 'search'
  >,
): Prisma.EventRegistrationWhereInput {
  const where: Prisma.EventRegistrationWhereInput = { eventId };

  switch (query.payment) {
    case 'PENDING':
    case 'CONFIRMED':
    case 'REJECTED':
      where.paymentStatus = query.payment;
      break;
    case 'AT_EVENT':
      where.payment = 'AT_EVENT';
      break;
  }
  if (query.source) where.source = query.source;
  if (query.attended !== undefined) where.attended = query.attended;

  const search = query.search?.trim();
  if (search) {
    const text = { contains: search, mode: 'insensitive' as const };
    where.OR = [
      { fullName: text },
      { group: text },
      { telegramTag: text },
      { answers: { some: { value: text } } },
      ...(TICKET_PREFIX.test(search) ? [ticketPrefixRange(search)] : []),
    ];
  }
  return where;
}
