import { RegistrationPayment } from '@prisma/client';

type Amount = { toString(): string } | number | string | null | undefined;

export interface FeeEvent {
  feeAmount: Amount;
  feeAtEventAmount: Amount;
  donationAnyAmount?: boolean | null;
}

export function pendingPaymentSubject(event: {
  donationAnyAmount?: boolean | null;
}): string {
  return event.donationAnyAmount
    ? 'Твій благодійний внесок (довільна сума)'
    : 'Твій платіж';
}

export function ticketDonationLine(event: {
  donationAnyAmount?: boolean | null;
}): string {
  return event.donationAnyAmount
    ? '💛 <b>Благодійний внесок:</b> довільна сума\n'
    : '';
}

const isPositive = (value: Amount) =>
  value !== null && value !== undefined && Number(value.toString()) > 0;

export function paymentRuleViolation(
  event: FeeEvent,
  payment: RegistrationPayment,
  hasOwnReceipt: boolean,
): string | null {
  const online = !!event.donationAnyAmount || isPositive(event.feeAmount);
  const atEvent = isPositive(event.feeAtEventAmount);

  if (!online && !atEvent) {
    return payment === RegistrationPayment.NONE
      ? null
      : 'Цей захід безкоштовний — оплата не потрібна.';
  }

  switch (payment) {
    case RegistrationPayment.DONATED:
      if (!online) return 'Оплата наперед для цього заходу не передбачена.';
      if (!hasOwnReceipt) {
        return 'Додайте скріншот або PDF квитанції про оплату.';
      }
      return null;
    case RegistrationPayment.AT_EVENT:
      return atEvent
        ? null
        : 'Оплата на місці для цього заходу не передбачена.';
    default:
      return 'Захід платний: оберіть спосіб оплати.';
  }
}
