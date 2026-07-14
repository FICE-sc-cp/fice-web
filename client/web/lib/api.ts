// Public base URL — what the browser uses (e.g. building <img> src). Baked at build.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Base URL for data fetches. On the server (SSR/RSC) reach the backend via the
// internal docker network name (`INTERNAL_API_URL`, e.g. http://server:3001);
// in the browser fall back to the public URL.
function apiBase(): string {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_URL ?? PUBLIC_API_URL;
  }
  return PUBLIC_API_URL;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Facts {
  eventsHeld: number;
  charityRaised: number;
  membersCount: number;
  closedFundraisers: number;
  activeStudents: number;
  activePartners: number;
  eventsPerYear: number;
  projectsDone: number;
}

export const EMPTY_FACTS: Facts = {
  eventsHeld: 0,
  charityRaised: 0,
  membersCount: 0,
  closedFundraisers: 0,
  activeStudents: 0,
  activePartners: 0,
  eventsPerYear: 0,
  projectsDone: 0,
};

export interface DepartmentHead {
  id: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  jobDescription: string | null;
  telegramTag: string | null;
}

export interface Department {
  id: string;
  name: string;
  memberCount: number | null;
  headId: string | null;
  head?: DepartmentHead | null;
}

export type DepartmentMemberRole =
  | 'HEAD'
  | 'FIRST_DEPUTY'
  | 'SECRETARY'
  | 'DEPUTY'
  | 'HR'
  | 'MEMBER';

export interface DepartmentMember {
  id: string;
  role: DepartmentMemberRole;
  firstName: string;
  lastName: string;
  specialization: string | null;
  photo: string | null;
  telegramTag: string | null;
}

export interface EventDetails {
  id: string;
  description: string;
  moneyCollected: string;
  charityAmount: string;
  visitorsAmount: number | null;
  departmentId: string | null;
}

export interface Partner {
  id: string;
  name: string;
  logoImage: string | null;
  websiteLink: string | null;
  isApproved: boolean;
}

export type EventQuestionType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'SINGLE_CHOICE'
  | 'YES_NO';

export interface EventQuestion {
  id: string;
  label: string;
  type: EventQuestionType;
  required: boolean;
  options: string[];
  order: number;
}

export interface EventProgramItem {
  id: string;
  time: string;
  title: string;
  order: number;
}

export interface EventPartner {
  id: string;
  name: string | null;
  logoImage: string | null;
  websiteLink: string | null;
  partner?: Partner | null;
}

export interface EventItem {
  id: string;
  name: string;
  date: string;
  photoUrl: string | null;
  description: string | null;
  location: string | null;
  locationNote: string | null;
  timeNote: string | null;
  registrationCloseDate: string | null;
  photoAlbumUrl: string | null;
  feeAmount: string | null;
  feeAtEventAmount: string | null;
  feeRequisites: string | null;
  detailsId: string | null;
  details?: EventDetails | null;
  eventPartners?: EventPartner[];
  program?: EventProgramItem[];
  questions?: EventQuestion[];
}

export type FundraiserStatus = 'ACTIVE' | 'CLOSED';

export interface Donation {
  id: string;
  fundraiserId: string;
  name: string | null;
  amount: string;
  comment: string | null;
  createdAt: string;
}

export interface Fundraiser {
  id: string;
  name: string;
  status: FundraiserStatus;
  description: string;
  story: string | null;
  imageUrl: string | null;
  location: string | null;
  goalAmount: string;
  currentAmount: string;
  donationsCount: number;
  cardNumber: string | null;
  jarUrl: string | null;
  monoJarId: string | null;
  startDate: string;
  endDate: string;
  detailsLink: string | null;
  donations?: Donation[];
}

export type NewsCategory =
  | 'EVENTS'
  | 'EDUCATION'
  | 'PARTNERS'
  | 'CHARITY'
  | 'ACHIEVEMENTS';

export interface News {
  id: string;
  title: string;
  publishDate: string;
  details: string | null;
  image: string | null;
  category: NewsCategory | null;
  eventDate: string | null;
  eventLocation: string | null;
  registrationLink: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { cache: 'no-store', ...init });
  if (!res.ok) {
    throw new Error(`API ${path} responded ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Always the public URL — this string is resolved by the browser.
  return path.startsWith('http') ? path : `${PUBLIC_API_URL}${path}`;
}

export async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export interface CreateApplicationPayload {
  firstName: string;
  middleName: string;
  lastName: string;
  telegramTag: string;
  group: string;
  phoneNumber: string;
  motivation?: string;
  experience?: string;
  departments: { departmentId: string; question?: string }[];
}

export type RegistrationPayment = 'NONE' | 'DONATED' | 'AT_EVENT';

export interface EventRegistrationPayload {
  fullName: string;
  telegramTag: string;
  group: string;
  birthDate?: string;
  payment?: RegistrationPayment;
  receiptUrl?: string;
  answers?: { questionId: string; value: string }[];
}

// Public "Люди проєктного" entry — name + avatar, harvested by the bot from the
// project chat (or added manually in the admin).
export interface ProjectParticipant {
  fullName: string;
  telegramTag: string | null;
  photo: string | null;
}

export const fice = {
  facts: () => request<Facts>('/facts'),
  departments: () => request<Department[]>('/department'),
  department: (id: string) => request<Department>(`/department/${id}`),
  members: () => request<DepartmentMember[]>('/department-member'),
  projectParticipants: () =>
    request<ProjectParticipant[]>('/project-participant/public'),
  events: (limit = 6, page = 1) =>
    request<Paginated<EventItem>>(`/event?limit=${limit}&page=${page}`),
  event: (id: string) => request<EventItem>(`/event/${id}`),
  registerEvent: (id: string, body: EventRegistrationPayload) =>
    request<unknown>(`/event/${id}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  uploadReceipt: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${apiBase()}/upload/public`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed ${res.status}`);
    return res.json() as Promise<{ url: string }>;
  },
  fundraisers: (limit = 6, page = 1) =>
    request<Paginated<Fundraiser>>(`/fundraiser?limit=${limit}&page=${page}`),
  fundraiser: (id: string) => request<Fundraiser>(`/fundraiser/${id}`),
  fundraiserDonations: (id: string) =>
    request<Donation[]>(`/fundraiser/${id}/donations`),
  partners: (limit = 12, page = 1) =>
    request<Paginated<Partner>>(`/partner?limit=${limit}&page=${page}`),
  news: (limit = 6, page = 1) =>
    request<Paginated<News>>(`/news?limit=${limit}&page=${page}`),
  newsItem: (id: string) => request<News>(`/news/${id}`),

  applyPartner: (body: unknown) =>
    request<Partner>('/partner/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  submitApplication: (body: unknown) =>
    request<unknown>('/applicant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
};
