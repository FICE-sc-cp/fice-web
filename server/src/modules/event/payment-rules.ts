import { RegistrationPayment } from '@prisma/client';

type Amount = { toString(): string } | number | string | null | undefined;

export interface FeeEvent {
  feeAmount: Amount;
  feeAtEventAmount: Amount;
}

const isPositive = (value: Amount) =>
  value !== null && value !== undefined && Number(value.toString()) > 0;

export function paymentRuleViolation(
  event: FeeEvent,
  payment: RegistrationPayment,
  hasOwnReceipt: boolean,
): string | null {
  const online = isPositive(event.feeAmount);
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
