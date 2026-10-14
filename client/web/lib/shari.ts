import { ApiError, request } from '@/lib/api';

export type Course = { discipline: string; groups: string[] };

export interface TeacherShara {
  id: string;
  discipline: string;
  group: string;
  bonus: string;
  condition: string | null;
  quantity: number;
}

export interface TeacherView {
  fullName: string;
  email: string | null;
  telegram: string | null;
  courses: Course[];
  /** Every FICE group, for "another group". */
  groups: string[];
  shari: TeacherShara[];
  open: boolean;
}

export interface SharaFields {
  bonus: string;
  condition?: string;
  quantity: number;
}

export interface ShariSettings {
  teachersOpen: boolean;
  starostasOpen: boolean;
}

export interface StaffMe {
  user: { name: string; username: string | null };
  isAdmin: boolean;
  group: string | null;
  settings: ShariSettings;
}

export interface Award {
  id: string;
  slot: number;
  studentName: string;
}

export interface GroupShara {
  id: string;
  discipline: string;
  teacher: string;
  bonus: string;
  condition: string | null;
  quantity: number;
  awards: Award[];
}

export interface GroupView {
  group: string;
  starosta: string | null;
  students: string[];
  shari: GroupShara[];
  canEdit: boolean;
  isAdmin: boolean;
}

/** What a certificate shows; the web app renders it (app/shari/certificate). */
export interface Certificate {
  studentName: string;
  group: string;
  discipline: string;
  bonus: string;
  condition: string | null;
  teacher: string;
  /** PNG data URL of the QR code that leads to the check page. */
  qr: string;
}

export interface AdminTeacher {
  id: string;
  fullName: string;
  email: string | null;
  telegram: string | null;
  token: string;
  openedAt: string | null;
  offers: number;
  quantity: number;
}

export interface AdminGroup {
  group: string;
  starosta: string | null;
  signedIn: boolean;
  students: number;
  shari: number;
  awarded: number;
}

export interface AdminView {
  settings: ShariSettings;
  totals: {
    teachers: number;
    teachersOpened: number;
    teachersWithShari: number;
    shari: number;
    awarded: number;
    groups: number;
    groupsWithShari: number;
    starostas: number;
    starostasSignedIn: number;
    students: number;
  };
  teachers: AdminTeacher[];
  groups: AdminGroup[];
}

export interface ImportResult {
  message: string;
  skipped: string[];
}

export interface CheckResult {
  studentName: string;
  group: string;
  discipline: string;
  bonus: string;
  condition: string | null;
  teacher: string;
}

const send = (method: string, headers: Record<string, string>, body?: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const teacherLink = (token: string) =>
  `${window.location.origin}/shari/t/${token}`;

/** Calls signed by a teacher's personal link. */
export function teacherApi(token: string) {
  const auth = { 'x-shari-token': token };
  const call = <T = TeacherView>(method: string, path: string, body?: unknown) =>
    request<T>(`/shari/teacher${path}`, send(method, auth, body));
  return {
    view: () => call('GET', ''),
    setContacts: (body: { email: string; telegram: string }) => call('PATCH', '', body),
    add: (body: SharaFields & { discipline: string; groups: string[] }) =>
      call('POST', '/shari', body),
    update: (id: string, body: SharaFields) => call('PATCH', `/shari/${id}`, body),
    remove: (id: string) => call('DELETE', `/shari/${id}`),
  };
}

export type StaffApi = ReturnType<typeof staffApi>;

/**
 * Calls signed with the Telegram Login Widget data. `dev` is the
 * `?tgUserId=&tgTag=` identity the API accepts only with AUTH_DISABLED.
 */
export function staffApi(login: string, dev = '') {
  const auth: Record<string, string> = login ? { 'x-telegram-login': login } : {};
  const call = <T = unknown>(method: string, path: string, body?: unknown) =>
    request<T>(`/shari${path}${dev}`, send(method, auth, body));
  const upload = (path: string, text: string) => {
    const form = new FormData();
    form.append('file', new Blob([text], { type: 'text/plain' }), 'import.txt');
    return request<ImportResult>(`/shari${path}${dev}`, {
      method: 'POST',
      headers: auth,
      body: form,
    });
  };
  const group = (name: string) => `/groups/${encodeURIComponent(name)}`;
  return {
    me: () => call<StaffMe>('GET', '/me'),
    group: (name: string) => call<GroupView>('GET', group(name)),
    setAwards: (sharaId: string, names: string[]) =>
      call<GroupView>('PUT', `/shari/${sharaId}/awards`, { names }),
    /** The PNG the site renders for an award. */
    certificate: (awardId: string, fileName: string) =>
      fetchFile(`/shari/certificate/${awardId}${dev}`, auth, `${fileName}.png`),
    admin: () => call<AdminView>('GET', '/admin'),
    setSettings: (body: Partial<ShariSettings>) =>
      call<ShariSettings>('PATCH', '/admin/settings', body),
    importTeachers: (csv: string) => upload('/admin/teachers/import', csv),
    addTeacher: (body: { fullName: string; email: string; telegram: string }) =>
      call<{ id: string; token: string }>('POST', '/admin/teachers', body),
    reissueLink: (id: string) =>
      call<{ id: string; token: string }>('POST', `/admin/teachers/${id}/link`),
    importStarostas: (text: string) => upload('/admin/starostas', text),
    importStudents: (text: string) => upload('/admin/students', text),
    removeShara: (id: string) => call('DELETE', `/admin/shari/${id}`),
    exportXlsx: async () =>
      saveFile(await fetchFile(`/api-proxy/shari/admin/export${dev}`, auth, 'shari.xlsx')),
  };
}

async function fetchFile(url: string, headers: Record<string, string>, name: string) {
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.message ?? 'Не вдалося завантажити файл', res.status);
  }
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type });
}

/** "ПІБ — предмет", safe as a file name and not cut mid-word. */
export function certificateName(studentName: string, discipline: string) {
  const name = `${studentName} — ${discipline}`
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name.length > 90 ? `${name.slice(0, 90).replace(/\s+\S*$/, '')}…` : name;
}

/** Phones get the share sheet (straight to Telegram); otherwise the files are downloaded. */
export const canShareFiles = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.canShare &&
  window.matchMedia('(pointer: coarse)').matches;

export async function deliver(files: File[]) {
  if (canShareFiles() && navigator.canShare({ files })) {
    try {
      await navigator.share({ files });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }
  for (const [i, file] of files.entries()) {
    if (i) await new Promise((resolve) => setTimeout(resolve, 400));
    saveFile(file);
  }
}

const LOGIN_KEY = 'shari-login';

export function savedLogin(): string {
  try {
    return localStorage.getItem(LOGIN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveLogin(value: string) {
  try {
    if (value) localStorage.setItem(LOGIN_KEY, value);
    else localStorage.removeItem(LOGIN_KEY);
  } catch {}
}

/** The Login Widget's user object → the query string the API checks the hash of. */
export const loginString = (user: Record<string, string | number>) =>
  new URLSearchParams(
    Object.entries(user).map(([key, value]) => [key, String(value)]),
  ).toString();

export function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const errorText = (err: unknown) =>
  err instanceof Error ? err.message : 'Щось пішло не так, спробуйте ще раз';

export const SHARI_WORDS: [string, string, string] = ['шара', 'шари', 'шар'];
export const COUNCIL_EMAIL = 'fiot.studrada@lll.kpi.ua';
