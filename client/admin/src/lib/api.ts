import { getInitData } from './auth';
import { ApiError, errorText } from './errors';

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
  charityRaised: number;
  membersCount: number;
  closedFundraisers: number;
  activeStudents: number;
  activePartners: number;
  eventsPerYear: number;
  projectsDone: number;
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
  telegramTag: string | null;
}

export interface Department {
  id: string;
  name: string;
  memberCount: number | null;
  telegramChatId: string | null;
  headId: string | null;
  head?: DepartmentHead | null;
}

export type DepartmentMemberRole =
  | 'HEAD'
  | 'FIRST_DEPUTY'
  | 'SECRETARY'
  | 'DEPUTY'
  | 'HR';

export interface DepartmentMember {
  id: string;
  role: DepartmentMemberRole;
  firstName: string;
  lastName: string;
  specialization: string | null;
  photo: string | null;
  telegramTag: string | null;
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
  contactName?: string | null;
  contactMethod?: string | null;
  proposal?: string | null;
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
  checkInStaffTags?: string[];
  baseQuestionsConfig?: any;
  detailsId: string | null;
  details?: EventDetails | null;
  eventPartners?: EventPartner[];
  program?: EventProgramItem[];
  questions?: EventQuestion[];
}

export type RegistrationPayment = 'NONE' | 'DONATED' | 'AT_EVENT';

export interface EventRegistration {
  id: string;
  fullName: string;
  telegramTag: string;
  group: string;
  birthDate: string | null;
  payment: RegistrationPayment;
  receiptUrl: string | null;
  attended?: boolean;
  attendedAt?: string | null;
  attendedBy?: string | null;
  createdAt: string;
  answers?: { id: string; questionId: string; value: string }[];
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

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new ApiError(
      0,
      [],
      'Немає звʼязку із сервером. Перевір інтернет і спробуй ще раз.',
    );
  }
  if (!res.ok) {
    let details: string[] = [];
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data?.message) {
        details = Array.isArray(data.message) ? data.message : [data.message];
      }
    } catch {}
    const error = new ApiError(res.status, details, `Помилка ${res.status}`);
    throw new ApiError(res.status, details, errorText(error));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as Promise<T>;
}

export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return path.startsWith('http') ? path : `${BASE}${path}`;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export interface NewsInput {
  title: string;
  details?: string;
  image?: string | null;
  publishDate?: string;
  category?: NewsCategory | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  registrationLink?: string | null;
  isDraft?: boolean;
}

export interface EventProgramInput {
  time: string;
  title: string;
  order?: number;
}

export interface EventQuestionInput {
  id?: string;
  label: string;
  type: EventQuestionType;
  required?: boolean;
  options?: string[];
  order?: number;
}

export interface EventInput {
  name: string;
  date: string;
  photoUrl?: string | null;
  detailsId?: string;
  description?: string;
  location?: string | null;
  locationNote?: string | null;
  timeNote?: string;
  registrationCloseDate?: string;
  photoAlbumUrl?: string | null;
  feeAmount?: number;
  feeAtEventAmount?: number;
  feeRequisites?: string;
  isAbitfest?: boolean;
  noRegistration?: boolean;
  isDraft?: boolean;
  hasTime?: boolean;
  time?: string;
  allowedFaculties?: string[];
  checkInStaffTags?: string[];
  baseQuestionsConfig?: any;
  program?: EventProgramInput[];
  questions?: EventQuestionInput[];
  partners?: { name: string; logoImage?: string; websiteLink?: string }[];
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
  logoImage?: string | null;
  websiteLink?: string | null;
}

export interface FundraiserInput {
  name: string;
  status?: FundraiserStatus;
  description: string;
  story?: string | null;
  imageUrl?: string | null;
  location?: string | null;
  goalAmount: number;
  currentAmount?: number;
  donationsCount?: number;
  cardNumber?: string | null;
  jarUrl?: string | null;
  monoJarId?: string | null;
  startDate: string;
  endDate: string;
  detailsLink?: string | null;
}

export interface DepartmentInput {
  name: string;
  memberCount?: number;
  telegramChatId?: string | null;
  headId?: string;
}

export interface DepartmentHeadInput {
  firstName: string;
  lastName: string;
  photo?: string | null;
  jobDescription?: string | null;
  telegramTag?: string;
}

export interface DepartmentMemberInput {
  role: DepartmentMemberRole;
  firstName: string;
  lastName: string;
  specialization?: string | null;
  photo?: string | null;
  telegramTag?: string;
}

export interface ChannelStatus {
  configured: boolean;
  channelIdSet: boolean;
  botTokenSet: boolean;
  webUrlSet: boolean;
}

export interface ChannelPostInput {
  text: string;
  imageUrl?: string | null;
  eventId?: string;
  buttonText?: string;
  buttonUrl?: string;
}

export type ProjectParticipantSource = 'HARVESTED' | 'MANUAL';

export interface ProjectParticipant {
  id: string;
  fullName: string;
  telegramTag: string | null;
  photo: string | null;
  source: ProjectParticipantSource;
  hidden: boolean;
  departmentId: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export interface ProjectParticipantInput {
  fullName: string;
  telegramTag?: string;
  photo?: string | null;
  hidden?: boolean;
  departmentId?: string;
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
  addEventPartner: (
    id: string,
    body: { name: string; logoImage?: string; websiteLink?: string },
  ) => request<unknown>(`/event/${id}/partners`, { method: 'POST', ...json(body) }),
  removeEventPartner: (id: string, eventPartnerId: string) =>
    request<unknown>(`/event/${id}/partners/${eventPartnerId}`, { method: 'DELETE' }),
  eventRegistrations: (id: string, page = 1, limit = 100) =>
    request<Paginated<EventRegistration>>(
      `/event/${id}/registrations?page=${page}&limit=${limit}`,
    ),
  exportEventRegistrations: async (id: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/event/${id}/registrations/export`, {
      headers: { 'x-telegram-init-data': getInitData() },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Помилка ${res.status}`);
    return res.blob();
  },

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
  fundraiser: (id: string) => request<Fundraiser>(`/fundraiser/${id}`),
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

  channelStatus: () => request<ChannelStatus>('/channel/status'),
  postChannel: (body: ChannelPostInput) =>
    request<{ ok: boolean; messageId: number }>('/channel/post', {
      method: 'POST',
      ...json(body),
    }),

  projectParticipants: () =>
    request<ProjectParticipant[]>('/project-participant'),
  createProjectParticipant: (body: ProjectParticipantInput) =>
    request<ProjectParticipant>('/project-participant', {
      method: 'POST',
      ...json(body),
    }),
  updateProjectParticipant: (
    id: string,
    body: Partial<ProjectParticipantInput>,
  ) =>
    request<ProjectParticipant>(`/project-participant/${id}`, {
      method: 'PATCH',
      ...json(body),
    }),
  deleteProjectParticipant: (id: string) =>
    request<unknown>(`/project-participant/${id}`, { method: 'DELETE' }),

  upload: async (file: File): Promise<{ url: string; filename: string }> => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string; filename: string }>('/upload', {
      method: 'POST',
      body: form,
    });
  },

  // --- Voting ---
  eventVotings: (eventId: string) =>
    request<EventVoting[]>(`/voting/event/${eventId}`),
  createVoting: (eventId: string, body: VotingInput) =>
    request<EventVoting>(`/voting/event/${eventId}`, {
      method: 'POST',
      ...json(body),
    }),
  voting: (id: string) => request<EventVoting>(`/voting/${id}`),
  updateVoting: (
    id: string,
    body: Partial<VotingInput & { status: VotingStatus }>,
  ) =>
    request<EventVoting>(`/voting/${id}`, {
      method: 'PATCH',
      ...json(body),
    }),
  deleteVoting: (id: string) =>
    request<unknown>(`/voting/${id}`, { method: 'DELETE' }),
  addCandidate: (votingId: string, body: CandidateInput) =>
    request<VotingCandidate>(`/voting/${votingId}/candidates`, {
      method: 'POST',
      ...json(body),
    }),
  updateCandidate: (candidateId: string, body: Partial<CandidateInput>) =>
    request<VotingCandidate>(`/voting/candidates/${candidateId}`, {
      method: 'PATCH',
      ...json(body),
    }),
  deleteCandidate: (candidateId: string) =>
    request<unknown>(`/voting/candidates/${candidateId}`, {
      method: 'DELETE',
    }),
  votingResults: (id: string) => request<VotingResults>(`/voting/${id}/results`),
  exportVotingResultsUrl: (id: string) => `${BASE}/voting/${id}/results/export`,
  exportVotingResultsBlob: async (id: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/voting/${id}/results/export`, {
      headers: { 'x-telegram-init-data': getInitData() },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Помилка ${res.status}`);
    return res.blob();
  },
  notifyVotingStarted: (id: string) =>
    request<{
      ok: boolean;
      recipientsCount: number;
      sentCount: number;
      failedCount: number;
    }>(`/voting/${id}/notify`, { method: 'POST' }),
  votingSubmissions: (votingId: string, status?: string) =>
    request<VotingCandidate[]>(
      `/voting/${votingId}/submissions${status ? `?status=${status}` : ''}`,
    ),
  approveSubmission: (candidateId: string) =>
    request<VotingCandidate>(`/voting/submissions/${candidateId}/approve`, {
      method: 'POST',
    }),
  rejectSubmission: (candidateId: string, reason?: string) =>
    request<VotingCandidate>(`/voting/submissions/${candidateId}/reject`, {
      method: 'POST',
      ...json({ reason }),
    }),

  // --- Broadcasts ---
  broadcastToEvent: (eventId: string, body: BroadcastInput) =>
    request<{
      ok: boolean;
      recipientsCount: number;
      sentCount: number;
      failedCount: number;
    }>(`/broadcast/event/${eventId}`, {
      method: 'POST',
      ...json(body),
    }),
  broadcastEventPreview: (eventId: string) =>
    request<{
      eventId: string;
      recipientsCount: number;
      botUsername?: string;
      defaultUrls?: {
        eventMiniApp: string;
        votingMiniApp: string;
        webEvent: string;
      };
    }>(`/broadcast/event/${eventId}/preview`),
  checkInAccess: (eventId: string) =>
    request<{ canCheckIn: boolean; reason?: string }>(`/event/${eventId}/checkin/access`),
  checkInList: (eventId: string) =>
    request<{
      total: number;
      attendedCount: number;
      items: EventRegistration[];
    }>(`/event/${eventId}/checkin/list`),
  toggleCheckIn: (eventId: string, registrationId: string, attended: boolean) =>
    request<EventRegistration>(`/event/${eventId}/checkin/${registrationId}`, {
      method: 'POST',
      ...json({ attended }),
    }),
  broadcastToAll: (body: BroadcastInput) =>
    request<{
      ok: boolean;
      recipientsCount: number;
      sentCount: number;
      failedCount: number;
    }>('/broadcast/global', {
      method: 'POST',
      ...json(body),
    }),
  broadcastStats: () => request<BroadcastStats>('/broadcast/stats'),
  broadcastHistory: (page = 1, limit = 20) =>
    request<Paginated<BroadcastMessage>>(
      `/broadcast/history?page=${page}&limit=${limit}`,
    ),

  // --- Blocked Users ---
  blockedUsers: (search?: string) =>
    request<BlockedUser[]>(`/blocked-users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createBlockedUser: (body: CreateBlockedUserInput) =>
    request<BlockedUser>('/blocked-users', { method: 'POST', ...json(body) }),
  updateBlockedUser: (id: string, body: UpdateBlockedUserInput) =>
    request<BlockedUser>(`/blocked-users/${id}`, { method: 'PATCH', ...json(body) }),
  deleteBlockedUser: (id: string) =>
    request<unknown>(`/blocked-users/${id}`, { method: 'DELETE' }),
};

export type VotingStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export interface VotingCandidate {
  id: string;
  votingId?: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  order: number;
  votesCount?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedByName?: string | null;
  submittedByTag?: string | null;
  submittedByTelegramId?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
}

export interface EventVoting {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  status: VotingStatus;
  onlyRegistered: boolean;
  showResultsLive: boolean;
  allowChangeVote: boolean;
  allowSubmissions: boolean;
  submissionsOpen: boolean;
  pendingSubmissionsCount?: number;
  createdAt: string;
  totalVotes: number;
  candidates: VotingCandidate[];
}

export interface VotingResults {
  voting: {
    id: string;
    title: string;
    status: VotingStatus;
    totalVotes: number;
  };
  candidates: {
    id: string;
    name: string;
    photoUrl: string | null;
    votesCount: number;
    percentage: number;
  }[];
  votes: {
    id: string;
    candidateId: string;
    candidateName: string;
    telegramId: string;
    voterName: string;
    telegramTag: string | null;
    group: string | null;
    createdAt: string;
  }[];
}

export interface VotingInput {
  title: string;
  description?: string;
  onlyRegistered?: boolean;
  showResultsLive?: boolean;
  allowChangeVote?: boolean;
  allowSubmissions?: boolean;
  submissionsOpen?: boolean;
}

export interface CandidateInput {
  name: string;
  description?: string;
  photoUrl?: string;
  order?: number;
}

export type BroadcastTarget = 'EVENT_PARTICIPANTS' | 'ALL_BOT_USERS';

export interface BroadcastMessage {
  id: string;
  eventId: string | null;
  target: BroadcastTarget;
  text: string;
  imageUrl: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  event?: { id: string; name: string } | null;
}

export interface BroadcastStats {
  totalUsers: number;
  activeUsers: number;
  totalBroadcasts: number;
}

export interface BroadcastInput {
  text: string;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
}

export interface BlockedUser {
  id: string;
  telegramTag: string;
  telegramUserId?: string | null;
  group?: string | null;
  faculty?: string | null;
  reason?: string | null;
  isBlocked: boolean;
  blockedAt: string;
  updatedAt: string;
}

export interface CreateBlockedUserInput {
  telegramTag: string;
  group?: string;
  faculty?: string;
  reason?: string;
  isBlocked?: boolean;
}

export interface UpdateBlockedUserInput {
  group?: string;
  faculty?: string;
  reason?: string;
  isBlocked?: boolean;
}

