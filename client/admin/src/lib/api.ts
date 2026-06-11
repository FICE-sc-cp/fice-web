import { getInitData } from './auth';

const BASE = '/api-proxy';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Me {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
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

export interface StatOverride {
  key: string;
  value: string;
  updatedAt: string;
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

export type DepartmentMemberRole =
  | 'HEAD'
  | 'FIRST_DEPUTY'
  | 'SECRETARY'
  | 'DEPUTY';

export interface DepartmentMember {
  id: string;
  role: DepartmentMemberRole;
  firstName: string;
  lastName: string;
  specialization: string | null;
  assignments?: { id: string; department: Department }[];
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

export interface News {
  id: string;
  title: string;
  publishDate: string;
  details: string | null;
  image: string | null;
}

export interface Applicant {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  telegramTag: string;
  group: string;
  phoneNumber: string;
  motivation: string | null;
  experience: string | null;
  createdAt: string;
  applicantDepartments?: { id: string; question: string | null; department: Department }[];
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-telegram-init-data', getInitData());
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    let message = `Помилка ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data?.message) {
        message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      }
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as Promise<T>;
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${BASE}${path}`;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export interface NewsInput {
  title: string;
  details?: string;
  image?: string;
  publishDate?: string;
}

export interface EventInput {
  name: string;
  date: string;
  photoUrl?: string;
  detailsId?: string;
}

export interface EventDetailsInput {
  description: string;
  moneyCollected: number;
  charityAmount: number;
  visitorsAmount?: number;
  departmentId?: string;
}

export interface PartnerInput {
  name: string;
  logoImage?: string;
  websiteLink?: string;
  shortDescription?: string;
}

export interface FundraiserInput {
  name: string;
  status?: FundraiserStatus;
  description: string;
  goalAmount: number;
  currentAmount?: number;
  startDate: string;
  endDate: string;
  detailsLink?: string;
}

export interface DepartmentInput {
  name: string;
  shortDescription: string;
  headId?: string;
  detailsId?: string;
}

export interface DepartmentHeadInput {
  firstName: string;
  lastName: string;
  photo?: string;
  jobDescription?: string;
  telegramTag: string;
}

export interface DepartmentDetailsInput {
  about: string;
  detailedDescription?: string;
  exampleOfWork?: string;
}

export interface DepartmentMemberInput {
  role: DepartmentMemberRole;
  firstName: string;
  lastName: string;
  specialization?: string;
}

export const api = {
  me: () => request<Me>('/auth/me'),
  facts: () => request<Facts>('/facts'),
  factOverrides: () => request<StatOverride[]>('/facts/overrides'),
  setFactOverride: (key: string, value: number) =>
    request<StatOverride>(`/facts/overrides/${key}`, { method: 'PUT', ...json({ value }) }),
  removeFactOverride: (key: string) =>
    request<unknown>(`/facts/overrides/${key}`, { method: 'DELETE' }),

  news: (page = 1, limit = 20) =>
    request<Paginated<News>>(`/news?page=${page}&limit=${limit}`),
  newsById: (id: string) => request<News>(`/news/${id}`),
  createNews: (body: NewsInput) => request<News>('/news', { method: 'POST', ...json(body) }),
  updateNews: (id: string, body: Partial<NewsInput>) =>
    request<News>(`/news/${id}`, { method: 'PATCH', ...json(body) }),
  deleteNews: (id: string) => request<News>(`/news/${id}`, { method: 'DELETE' }),

  events: (page = 1, limit = 20) =>
    request<Paginated<EventItem>>(`/event?page=${page}&limit=${limit}`),
  event: (id: string) => request<EventItem>(`/event/${id}`),
  createEvent: (body: EventInput) => request<EventItem>('/event', { method: 'POST', ...json(body) }),
  updateEvent: (id: string, body: Partial<EventInput>) =>
    request<EventItem>(`/event/${id}`, { method: 'PATCH', ...json(body) }),
  deleteEvent: (id: string) => request<EventItem>(`/event/${id}`, { method: 'DELETE' }),
  addEventPartner: (id: string, partnerId: string) =>
    request<unknown>(`/event/${id}/partners`, { method: 'POST', ...json({ partnerId }) }),
  removeEventPartner: (id: string, partnerId: string) =>
    request<unknown>(`/event/${id}/partners/${partnerId}`, { method: 'DELETE' }),

  createEventDetails: (body: EventDetailsInput) =>
    request<EventDetails>('/event-details', { method: 'POST', ...json(body) }),
  updateEventDetails: (id: string, body: Partial<EventDetailsInput>) =>
    request<EventDetails>(`/event-details/${id}`, { method: 'PATCH', ...json(body) }),

  partners: (page = 1, limit = 50) =>
    request<Paginated<Partner>>(`/partner?page=${page}&limit=${limit}`),
  createPartner: (body: PartnerInput) =>
    request<Partner>('/partner', { method: 'POST', ...json(body) }),
  updatePartner: (id: string, body: Partial<PartnerInput>) =>
    request<Partner>(`/partner/${id}`, { method: 'PATCH', ...json(body) }),
  approvePartner: (id: string) =>
    request<Partner>(`/partner/${id}/approve`, { method: 'PATCH' }),
  deletePartner: (id: string) => request<Partner>(`/partner/${id}`, { method: 'DELETE' }),

  fundraisers: (page = 1, limit = 50) =>
    request<Paginated<Fundraiser>>(`/fundraiser?page=${page}&limit=${limit}`),
  createFundraiser: (body: FundraiserInput) =>
    request<Fundraiser>('/fundraiser', { method: 'POST', ...json(body) }),
  updateFundraiser: (id: string, body: Partial<FundraiserInput>) =>
    request<Fundraiser>(`/fundraiser/${id}`, { method: 'PATCH', ...json(body) }),
  deleteFundraiser: (id: string) =>
    request<Fundraiser>(`/fundraiser/${id}`, { method: 'DELETE' }),

  departments: () => request<Department[]>('/department'),
  department: (id: string) => request<Department>(`/department/${id}`),
  createDepartment: (body: DepartmentInput) =>
    request<Department>('/department', { method: 'POST', ...json(body) }),
  updateDepartment: (id: string, body: Partial<DepartmentInput>) =>
    request<Department>(`/department/${id}`, { method: 'PATCH', ...json(body) }),
  deleteDepartment: (id: string) =>
    request<Department>(`/department/${id}`, { method: 'DELETE' }),

  departmentHeads: () => request<DepartmentHead[]>('/department-head'),
  createDepartmentHead: (body: DepartmentHeadInput) =>
    request<DepartmentHead>('/department-head', { method: 'POST', ...json(body) }),
  updateDepartmentHead: (id: string, body: Partial<DepartmentHeadInput>) =>
    request<DepartmentHead>(`/department-head/${id}`, { method: 'PATCH', ...json(body) }),
  deleteDepartmentHead: (id: string) =>
    request<DepartmentHead>(`/department-head/${id}`, { method: 'DELETE' }),

  departmentDetails: () => request<DepartmentDetails[]>('/department-details'),
  createDepartmentDetails: (body: DepartmentDetailsInput) =>
    request<DepartmentDetails>('/department-details', { method: 'POST', ...json(body) }),
  updateDepartmentDetails: (id: string, body: Partial<DepartmentDetailsInput>) =>
    request<DepartmentDetails>(`/department-details/${id}`, { method: 'PATCH', ...json(body) }),
  deleteDepartmentDetails: (id: string) =>
    request<DepartmentDetails>(`/department-details/${id}`, { method: 'DELETE' }),

  members: () => request<DepartmentMember[]>('/department-member'),
  createMember: (body: DepartmentMemberInput) =>
    request<DepartmentMember>('/department-member', { method: 'POST', ...json(body) }),
  updateMember: (id: string, body: Partial<DepartmentMemberInput>) =>
    request<DepartmentMember>(`/department-member/${id}`, { method: 'PATCH', ...json(body) }),
  deleteMember: (id: string) =>
    request<DepartmentMember>(`/department-member/${id}`, { method: 'DELETE' }),
  assignMember: (id: string, departmentId: string) =>
    request<unknown>(`/department-member/${id}/assignments`, { method: 'POST', ...json({ departmentId }) }),
  unassignMember: (id: string, departmentId: string) =>
    request<unknown>(`/department-member/${id}/assignments/${departmentId}`, { method: 'DELETE' }),

  applicants: (page = 1, limit = 50) =>
    request<Paginated<Applicant>>(`/applicant?page=${page}&limit=${limit}`),
  applicant: (id: string) => request<Applicant>(`/applicant/${id}`),
  deleteApplicant: (id: string) => request<unknown>(`/applicant/${id}`, { method: 'DELETE' }),

  upload: async (file: File): Promise<{ url: string; filename: string }> => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string; filename: string }>('/upload', {
      method: 'POST',
      body: form,
    });
  },
};
