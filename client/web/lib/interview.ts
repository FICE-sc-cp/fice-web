import { request } from '@/lib/api';

export type InterviewStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'NO_SHOW';
export type StaffRole = 'HEAD' | 'RECRUITER' | 'ADMIN';

export interface SlotTime {
  id: string;
  startsAt: string;
  endsAt: string;
}

export interface Candidacy {
  id: string;
  department: { id: string; name: string };
  slot: SlotTime | null;
}

export interface Recruiter {
  id: string;
  telegramTag: string;
  telegramId: string | null;
  name: string | null;
}

export interface StaffDepartment {
  id: string;
  name: string;
  shortName: string | null;
  slotMinutes: number;
  role: StaffRole;
  recruiters: Recruiter[];
}

export interface Note {
  id: string;
  authorTelegramId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Candidate {
  id: string;
  departmentId: string;
  telegramTag: string;
  telegramId: string | null;
  name: string | null;
  status: InterviewStatus;
  applicant: {
    firstName: string;
    middleName: string;
    lastName: string;
    group: string;
    phoneNumber: string;
    motivation: string | null;
    experience: string | null;
    applicantDepartments: { departmentId: string; question: string | null }[];
  } | null;
  slot: (SlotTime & { hostName: string; hostTelegramId: string }) | null;
  notes: Note[];
}

export interface Slot extends SlotTime {
  departmentId: string;
  hostTelegramId: string;
  hostName: string;
  candidateId: string | null;
}

export interface InterviewMe {
  user: { id: string; username: string | null; name: string };
  botUsername: string | null;
  isAdmin: boolean;
  candidacies: Candidacy[];
  departments: StaffDepartment[];
  candidates: Candidate[];
  slots: Slot[];
}

export interface ApplicantRow {
  id: string;
  firstName: string;
  lastName: string;
  telegramTag: string;
  group: string;
}

export type InterviewApi = ReturnType<typeof interviewApi>;

/** Calls signed with the interview bot's init data (or the dev fallback when AUTH_DISABLED). */
export function interviewApi(
  initData: string,
  devUser?: { id: number; username?: string } | null,
) {
  const dev =
    !initData && devUser
      ? `?tgUserId=${devUser.id}&tgTag=${encodeURIComponent(devUser.username ?? '')}`
      : '';
  const call = <T = unknown>(method: string, path: string, body?: unknown) =>
    request<T>(`/interview${path}${dev}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'x-telegram-init-data': initData } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  return {
    me: () => call<InterviewMe>('GET', '/me'),
    freeSlots: (candidacyId: string) =>
      call<SlotTime[]>('GET', `/candidacies/${candidacyId}/slots`),
    book: (candidacyId: string, slotId: string) =>
      call('POST', `/candidacies/${candidacyId}/book`, { slotId }),
    createSlots: (body: {
      departmentId: string;
      date: string;
      from: string;
      to: string;
    }) => call<{ created: number; skipped: number }>('POST', '/slots', body),
    deleteSlot: (id: string) => call('DELETE', `/slots/${id}`),
    addCandidate: (departmentId: string, telegramTag: string) =>
      call('POST', '/candidates', { departmentId, telegramTag }),
    setStatus: (id: string, status: InterviewStatus) =>
      call('PATCH', `/candidates/${id}`, { status }),
    removeCandidate: (id: string) => call('DELETE', `/candidates/${id}`),
    addNote: (id: string, text: string) =>
      call('POST', `/candidates/${id}/notes`, { text }),
    deleteNote: (id: string) => call('DELETE', `/notes/${id}`),
    applicants: (departmentId: string) =>
      call<ApplicantRow[]>('GET', `/departments/${departmentId}/applicants`),
    setSlotMinutes: (departmentId: string, slotMinutes: number) =>
      call('PATCH', `/departments/${departmentId}`, { slotMinutes }),
    addRecruiter: (departmentId: string, telegramTag: string) =>
      call('POST', `/departments/${departmentId}/recruiters`, { telegramTag }),
    removeRecruiter: (id: string) => call('DELETE', `/recruiters/${id}`),
  };
}

export const STATUS_LABEL: Record<InterviewStatus, string> = {
  PENDING: 'Без результату',
  PASSED: 'Пройшов',
  FAILED: 'Не пройшов',
  NO_SHOW: 'Не зʼявився',
};

export function candidateName(c: Candidate): string {
  return c.applicant
    ? `${c.applicant.lastName} ${c.applicant.firstName}`
    : (c.name ?? c.telegramTag);
}

const kyiv = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', ...options });
const dayFormat = kyiv({ weekday: 'short', day: 'numeric', month: 'long' });
const timeFormat = kyiv({ hour: '2-digit', minute: '2-digit' });
const keyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' });

export const fmtDay = (iso: string) => dayFormat.format(new Date(iso));
/** "Ср, 14 жовтня" — for headings and chips. */
export const fmtDayTitle = (iso: string) => {
  const day = fmtDay(iso);
  return day.charAt(0).toUpperCase() + day.slice(1);
};
export const fmtTime = (iso: string) => timeFormat.format(new Date(iso));
/** Kyiv calendar date, YYYY-MM-DD. */
export const kyivDate = (at: string | Date = new Date()) =>
  keyFormat.format(new Date(at));

/** Groups items by Kyiv calendar day, keeping their order. */
export function byDay<T extends { startsAt: string }>(items: T[]) {
  const days = new Map<string, T[]>();
  for (const item of items) {
    const key = kyivDate(item.startsAt);
    days.set(key, [...(days.get(key) ?? []), item]);
  }
  return [...days.values()];
}
