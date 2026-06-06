export class ApplicantEntity {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  telegramTag: string;
  group: string;
  phoneNumber: string;
  motivation: string | null;
  experience: string | null;
  createdAt: Date;
}
