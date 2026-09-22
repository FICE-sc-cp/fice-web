// Public base URL — what the browser uses (e.g. building <img> src). Baked at build.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Base URL for data fetches. On the server (SSR/RSC) reach the backend via the
// internal docker network name (`INTERNAL_API_URL`, e.g. http://server:3001);
// in the browser fall back to the public URL.
function apiBase(): string {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_URL ?? PUBLIC_API_URL;
  }
  return '/api-proxy';
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
  contactName: string | null;
  contactMethod: string | null;
  proposal: string | null;
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
  isAbitfest: boolean;
  noRegistration: boolean;
  isDraft?: boolean;
  hasTime?: boolean;
  time?: string | null;
  allowedFaculties?: string[];
  baseQuestionsConfig?: any;
  detailsId: string | null;
  details?: EventDetails | null;
  eventPartners?: EventPartner[];
  program?: EventProgramItem[];
  questions?: EventQuestion[];
}

export type FundraiserStatus = 'ACTIVE' | 'CLOSED';

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
    let msg = `Помилка запиту (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) {
        msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      }
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return path.startsWith('/') ? path : `/${path}`;
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

export interface ApplyPartnerPayload {
  name: string;
  websiteLink: string;
  contactName: string;
  contactMethod: string;
  proposal: string;
}

export type RegistrationPayment = 'NONE' | 'DONATED' | 'AT_EVENT';

export interface EventRegistrationPayload {
  fullName: string;
  telegramTag: string;
  group: string;
  birthDate?: string;
  payment?: RegistrationPayment;
  receiptUrl?: string;
  telegramUserId?: string | number;
  saveProfile?: boolean;
  phoneNumber?: string;
  answers?: { questionId: string; value: string }[];
}

export interface EventRegistrationResult {
  requiresBotStart?: boolean;
  token?: string;
  botUrl?: string;
  message?: string;
  id?: string;
  fullName?: string;
  telegramTag?: string;
  group?: string;
  birthDate?: string | null;
  payment?: RegistrationPayment;
  createdAt?: string;
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
  projectParticipants: (departmentId?: string) =>
    request<ProjectParticipant[]>(
      `/project-participant/public${departmentId ? `?departmentId=${departmentId}` : ''}`,
    ),
  events: (limit = 6, page = 1, past?: boolean, abitfest?: boolean) =>
    request<Paginated<EventItem>>(
      `/event?limit=${limit}&page=${page}` +
        `${past === undefined ? '' : `&past=${past}`}` +
        `${abitfest === undefined ? '' : `&abitfest=${abitfest}`}`,
    ),
  event: (id: string) => request<EventItem>(`/event/${id}`),
  registerEvent: (id: string, body: EventRegistrationPayload) =>
    request<EventRegistrationResult>(`/event/${id}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  getRegistrationSession: (token: string) =>
    request<{ completed: boolean; token: string; expiresAt: string }>(
      `/event/registration-session/${token}`,
    ),
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
  fundraisers: (limit = 6, page = 1, status?: FundraiserStatus) =>
    request<Paginated<Fundraiser>>(
      `/fundraiser?limit=${limit}&page=${page}${status ? `&status=${status}` : ''}`,
    ),
  fundraiser: (id: string) => request<Fundraiser>(`/fundraiser/${id}`),
  partners: (limit = 12, page = 1) =>
    request<Paginated<Partner>>(`/partner?limit=${limit}&page=${page}`),
  news: (
    limit = 6,
    page = 1,
    filters?: { search?: string; category?: NewsCategory },
  ) =>
    request<Paginated<News>>(
      `/news?limit=${limit}&page=${page}` +
        `${filters?.search ? `&search=${encodeURIComponent(filters.search)}` : ''}` +
        `${filters?.category ? `&category=${filters.category}` : ''}`,
    ),
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

  // --- Telegram Mini App (TMA) ---
  profile: (initData?: string, tgUserId?: string) =>
    request<BotUserProfile | null>(
      `/bot-user/profile${tgUserId ? `?tgUserId=${tgUserId}` : ''}`,
      {
        headers: initData ? { 'x-telegram-init-data': initData } : undefined,
      },
    ),
  updateProfile: (
    body: Partial<BotUserProfile>,
    initData?: string,
    tgUserId?: string,
  ) =>
    request<BotUserProfile>(
      `/bot-user/profile${tgUserId ? `?tgUserId=${tgUserId}` : ''}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'x-telegram-init-data': initData } : {}),
        },
        body: JSON.stringify(body),
      },
    ),
  myRegistrations: (initData?: string, tgUserId?: string) =>
    request<MyEventRegistration[]>(
      `/bot-user/registrations${tgUserId ? `?tgUserId=${tgUserId}` : ''}`,
      {
        headers: initData ? { 'x-telegram-init-data': initData } : undefined,
      },
    ),
  cancelRegistration: (
    registrationId: string,
    initData?: string,
    tgUserId?: string,
  ) =>
    request<{ ok: boolean; message: string }>(
      `/bot-user/registrations/${registrationId}${tgUserId ? `?tgUserId=${tgUserId}` : ''}`,
      {
        method: 'DELETE',
        headers: initData ? { 'x-telegram-init-data': initData } : undefined,
      },
    ),
  publicVoting: (votingId: string, initData?: string, tgUserId?: string) =>
    request<PublicVoting>(
      `/voting/${votingId}/public${tgUserId ? `?tgUserId=${tgUserId}` : ''}`,
      {
        headers: initData ? { 'x-telegram-init-data': initData } : undefined,
      },
    ),
  eventVotings: (eventId: string) =>
    request<
      {
        id: string;
        title: string;
        description: string | null;
        status: 'ACTIVE' | 'CLOSED';
        totalVotes: number;
      }[]
    >(`/voting/event/${eventId}/public`),
  castVote: (
    votingId: string,
    candidateId: string,
    initData?: string,
    tgUserId?: string,
  ) =>
    request<{ ok: boolean; message: string }>(
      `/voting/${votingId}/vote${tgUserId ? `?tgUserId=${tgUserId}` : ''}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'x-telegram-init-data': initData } : {}),
        },
        body: JSON.stringify({ candidateId }),
      },
    ),
  submitCostumeCandidate: (
    votingId: string,
    body: { name: string; description?: string; photoUrl: string },
    initData?: string,
    tgUserId?: string,
  ) =>
    request<{
      id: string;
      name: string;
      description: string | null;
      photoUrl: string | null;
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
    }>(
      `/voting/${votingId}/submit-candidate${tgUserId ? `?tgUserId=${tgUserId}` : ''}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'x-telegram-init-data': initData } : {}),
        },
        body: JSON.stringify(body),
      },
    ),
  votingScreen: (votingId: string) =>
    request<VotingScreenData>(`/voting/${votingId}/screen`),
  getCheckInAccess: (
    eventId: string,
    initData?: string,
    tgUserId?: string,
    tgTag?: string,
  ) => {
    const params = new URLSearchParams();
    if (tgUserId) params.set('tgUserId', tgUserId);
    if (tgTag) params.set('tgTag', tgTag);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ canCheckIn: boolean; reason?: string }>(
      `/event/${eventId}/checkin/access${qs}`,
      {
        headers: initData ? { 'x-telegram-init-data': initData } : undefined,
      },
    );
  },
  getCheckInList: (
    eventId: string,
    initData?: string,
    tgUserId?: string,
    tgTag?: string,
  ) => {
    const params = new URLSearchParams();
    if (tgUserId) params.set('tgUserId', tgUserId);
    if (tgTag) params.set('tgTag', tgTag);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<CheckInListResponse>(
      `/event/${eventId}/checkin/list${qs}`,
      {
        headers: initData ? { 'x-telegram-init-data': initData } : undefined,
      },
    );
  },
  toggleCheckIn: (
    eventId: string,
    registrationId: string,
    attended: boolean,
    initData?: string,
    tgUserId?: string,
    tgTag?: string,
  ) => {
    const params = new URLSearchParams();
    if (tgUserId) params.set('tgUserId', tgUserId);
    if (tgTag) params.set('tgTag', tgTag);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<CheckInToggleResponse>(
      `/event/${eventId}/checkin/${registrationId}${qs}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData ? { 'x-telegram-init-data': initData } : {}),
        },
        body: JSON.stringify({ attended }),
      },
    );
  },
};

export interface CheckInItem {
  id: string;
  fullName: string;
  telegramTag: string;
  group: string;
  payment: RegistrationPayment;
  receiptUrl: string | null;
  attended: boolean;
  attendedAt: string | null;
  attendedBy: string | null;
  createdAt: string;
  answers: {
    id: string;
    questionId: string;
    value: string;
  }[];
}

export interface CheckInListResponse {
  total: number;
  attendedCount: number;
  unattendedCount?: number;
  percentage?: number;
  stats?: {
    total: number;
    attendedCount: number;
    unattendedCount: number;
    percentage: number;
  };
  items: CheckInItem[];
}

export interface CheckInToggleResponse {
  registration: CheckInItem;
  total?: number;
  attendedCount?: number;
  unattendedCount?: number;
  percentage?: number;
  stats?: {
    total: number;
    attendedCount: number;
    unattendedCount: number;
    percentage: number;
  };
}

export interface BotUserProfile {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  group: string | null;
  birthDate: string | null;
  phoneNumber: string | null;
}

export interface MyEventRegistration {
  id: string;
  eventId: string;
  telegramUserId: string | null;
  fullName: string;
  telegramTag: string;
  group: string;
  birthDate: string | null;
  payment: RegistrationPayment;
  receiptUrl: string | null;
  createdAt: string;
  event: {
    id: string;
    name: string;
    date: string;
    photoUrl: string | null;
    location: string | null;
    locationNote: string | null;
    timeNote: string | null;
    feeAmount: string | null;
    feeAtEventAmount: string | null;
    feeRequisites: string | null;
    registrationCloseDate: string | null;
  };
  answers: { id: string; value: string; question: { label: string } }[];
}

export interface PublicVoting {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  onlyRegistered: boolean;
  allowChangeVote: boolean;
  allowSubmissions: boolean;
  submissionsOpen: boolean;
  isRegistered: boolean;
  hasVoted: boolean;
  votedCandidateId: string | null;
  userSubmission?: {
    id: string;
    name: string;
    description: string | null;
    photoUrl: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    rejectionReason: string | null;
    createdAt: string;
  } | null;
  totalVotes?: number;
  candidates: {
    id: string;
    name: string;
    description: string | null;
    photoUrl: string | null;
    order: number;
    votesCount?: number;
    percent?: number;
  }[];
}

export interface VotingScreenData {
  voting: {
    id: string;
    title: string;
    description: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
    allowChangeVote: boolean;
    showResultsLive: boolean;
    totalVotes: number;
    eventName: string;
    eventDate: string;
    eventLocation: string | null;
    eventPhotoUrl: string | null;
  };
  candidates: {
    id: string;
    name: string;
    description: string | null;
    photoUrl: string | null;
    order: number;
    votesCount: number;
    percentage: number;
  }[];
  winners: {
    place: number;
    id: string;
    name: string;
    description: string | null;
    photoUrl: string | null;
    votesCount: number;
    percentage: number;
  }[];
}

