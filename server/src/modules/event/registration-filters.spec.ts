import { registrationListWhere } from './registration-filters';

describe('registrationListWhere', () => {
  it('filters by payment state, source and attendance on the server', () => {
    expect(
      registrationListWhere('e1', {
        payment: 'PENDING',
        source: 'WEB',
        attended: false,
      }),
    ).toEqual({
      eventId: 'e1',
      paymentStatus: 'PENDING',
      source: 'WEB',
      attended: false,
    });
    expect(registrationListWhere('e1', { payment: 'AT_EVENT' })).toEqual({
      eventId: 'e1',
      payment: 'AT_EVENT',
    });
  });

  it('searches name, group, tag and answers case-insensitively', () => {
    const where = registrationListWhere('e1', { search: '  Іван ' });
    const text = { contains: 'Іван', mode: 'insensitive' };
    expect(where.OR).toEqual([
      { fullName: text },
      { group: text },
      { telegramTag: text },
      { answers: { some: { value: text } } },
    ]);
  });

  it('also matches a ticket code by its printed prefix', () => {
    const where = registrationListWhere('e1', { search: '0E35A1B2' });
    expect(where.OR).toContainEqual({
      ticketCode: {
        gte: '0e35a1b2-0000-0000-0000-000000000000',
        lte: '0e35a1b2-ffff-ffff-ffff-ffffffffffff',
      },
    });
  });

  it('returns every registration of the event without filters', () => {
    expect(registrationListWhere('e1', {})).toEqual({ eventId: 'e1' });
  });
});
