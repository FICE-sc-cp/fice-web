import { paymentRuleViolation } from './payment-rules';

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
