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
  moneyRaised: number;
  charityRaised: number;
  visitorsReached: number;
  partnersCount: number;
  departmentsCount: number;
  membersCount: number;
}

export interface DepartmentHead {
  id: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  jobDescription: string | null;
  telegramTag: string;
}

export interface DepartmentDetails {
  id: string;
  about: string;
  detailedDescription: string | null;
  exampleOfWork: string | null;
}

export interface Department {
  id: string;
  name: string;
  shortDescription: string;
  headId: string | null;
  detailsId: string | null;
  head?: DepartmentHead | null;
  details?: DepartmentDetails | null;
}

export type DepartmentMemberRole = 'DEPUTY' | 'HR' | 'HEAD' | 'MEMBER';

export interface DepartmentMember {
  id: string;
  role: DepartmentMemberRole;
  firstName: string;
  lastName: string;
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
  shortDescription: string | null;
  isApproved: boolean;
}

export interface EventItem {
  id: string;
  name: string;
  date: string;
  photoUrl: string | null;
  detailsId: string | null;
  details?: EventDetails | null;
  eventPartners?: { partner: Partner }[];
}

export type FundraiserStatus = 'ACTIVE' | 'CLOSED';

export interface Fundraiser {
  id: string;
  name: string;
  status: FundraiserStatus;
  description: string;
  goalAmount: string;
  currentAmount: string;
  startDate: string;
  endDate: string;
  detailsLink: string | null;
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

export const fice = {
  facts: () => request<Facts>('/facts'),
  departments: () => request<Department[]>('/department'),
  department: (id: string) => request<Department>(`/department/${id}`),
  members: () => request<DepartmentMember[]>('/department-member'),
  events: (limit = 6, page = 1) =>
    request<Paginated<EventItem>>(`/event?limit=${limit}&page=${page}`),
  event: (id: string) => request<EventItem>(`/event/${id}`),
  fundraisers: (limit = 6, page = 1) =>
    request<Paginated<Fundraiser>>(`/fundraiser?limit=${limit}&page=${page}`),
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
