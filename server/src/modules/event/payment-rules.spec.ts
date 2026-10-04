import {
  paymentRuleViolation,
  pendingPaymentSubject,
  ticketDonationLine,
} from './payment-rules';

const FREE = { feeAmount: null, feeAtEventAmount: null };
const ONLINE = { feeAmount: '150.00', feeAtEventAmount: null };
const BOTH = { feeAmount: '150.00', feeAtEventAmount: '200.00' };
const AT_EVENT_ONLY = { feeAmount: '0', feeAtEventAmount: '200.00' };

describe('paymentRuleViolation', () => {
  it('accepts only NONE for free events', () => {
    expect(paymentRuleViolation(FREE, 'NONE', false)).toBeNull();
    expect(paymentRuleViolation(FREE, 'DONATED', true)).not.toBeNull();
    expect(paymentRuleViolation(FREE, 'AT_EVENT', false)).not.toBeNull();
  });

  it('rejects NONE for paid events', () => {
    expect(paymentRuleViolation(ONLINE, 'NONE', false)).not.toBeNull();
    expect(paymentRuleViolation(AT_EVENT_ONLY, 'NONE', false)).not.toBeNull();
  });

  it('accepts DONATED only with our own receipt upload', () => {
    expect(paymentRuleViolation(ONLINE, 'DONATED', true)).toBeNull();
    expect(paymentRuleViolation(ONLINE, 'DONATED', false)).toMatch(/квитанції/);
  });

  it('accepts AT_EVENT only when an at-event fee is set', () => {
    expect(paymentRuleViolation(BOTH, 'AT_EVENT', false)).toBeNull();
    expect(paymentRuleViolation(AT_EVENT_ONLY, 'AT_EVENT', false)).toBeNull();
    expect(paymentRuleViolation(ONLINE, 'AT_EVENT', false)).not.toBeNull();
  });

  it('refuses DONATED when the event takes payment only at the door', () => {
    expect(paymentRuleViolation(AT_EVENT_ONLY, 'DONATED', true)).not.toBeNull();
  });
});

describe('paymentRuleViolation with a donation of any amount', () => {
  const ANY = { feeAmount: null, feeAtEventAmount: null, donationAnyAmount: true };
  const ANY_OR_DOOR = {
    feeAmount: null,
    feeAtEventAmount: '100.00',
    donationAnyAmount: true,
  };

  it('requires a payment even without an online amount', () => {
    expect(paymentRuleViolation(ANY, 'NONE', false)).not.toBeNull();
  });

  it('accepts DONATED with our own receipt and no amount set', () => {
    expect(paymentRuleViolation(ANY, 'DONATED', true)).toBeNull();
    expect(paymentRuleViolation(ANY, 'DONATED', false)).toMatch(/квитанції/);
  });

  it('offers AT_EVENT only when the at-event fee is set', () => {
    expect(paymentRuleViolation(ANY, 'AT_EVENT', false)).not.toBeNull();
    expect(paymentRuleViolation(ANY_OR_DOOR, 'AT_EVENT', false)).toBeNull();
  });

  it('keeps the old rules when the flag is off', () => {
    const off = { ...FREE, donationAnyAmount: false };
    expect(paymentRuleViolation(off, 'NONE', false)).toBeNull();
    expect(paymentRuleViolation(off, 'DONATED', true)).not.toBeNull();
  });
});

describe('donation texts for the bot', () => {
  it('names the any-amount donation in tickets and pending messages', () => {
    expect(ticketDonationLine({ donationAnyAmount: true })).toBe(
      '💛 <b>Благодійний внесок:</b> довільна сума\n',
    );
    expect(pendingPaymentSubject({ donationAnyAmount: true })).toBe(
      'Твій благодійний внесок (довільна сума)',
    );
  });

  it('keeps the old texts for other events', () => {
    expect(ticketDonationLine({ donationAnyAmount: false })).toBe('');
    expect(ticketDonationLine({})).toBe('');
    expect(pendingPaymentSubject({ donationAnyAmount: false })).toBe(
      'Твій платіж',
    );
  });
});
