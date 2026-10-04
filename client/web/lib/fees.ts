type Amount = string | number | null | undefined;

export interface FeeInfo {
  anyAmount: boolean;
  online: number;
  atEvent: number;
  onlineRequired: boolean;
  hasFee: boolean;
}

const amount = (value: Amount) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function feeInfo(event: {
  feeAmount?: Amount;
  feeAtEventAmount?: Amount;
  donationAnyAmount?: boolean | null;
}): FeeInfo {
  const anyAmount = !!event.donationAnyAmount;
  const online = anyAmount ? 0 : amount(event.feeAmount);
  const atEvent = amount(event.feeAtEventAmount);
  const onlineRequired = anyAmount || online > 0;
  return {
    anyAmount,
    online,
    atEvent,
    onlineRequired,
    hasFee: onlineRequired || atEvent > 0,
  };
}

export const ANY_AMOUNT_TITLE = "Благодійний внесок";
export const ANY_AMOUNT_VALUE = "довільна сума";
