export class EventDetailsEntity {
  id: string;
  description: string;
  /** Decimal serialized as a string. */
  moneyCollected: string;
  /** Decimal serialized as a string. */
  charityAmount: string;
  visitorsAmount: number | null;
  departmentId: string | null;
}
