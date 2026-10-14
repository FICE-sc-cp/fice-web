import { tagUsername } from '../interview/interview-rules';

export type Course = { discipline: string; groups: string[] };

export interface ImportedTeacher {
  fullName: string;
  email: string | null;
  telegram: string | null;
  courses: Course[];
}

const LOOKALIKES: Record<string, string> = {
  A: 'А',
  B: 'В',
  C: 'С',
  E: 'Е',
  H: 'Н',
  I: 'І',
  K: 'К',
  M: 'М',
  O: 'О',
  P: 'Р',
  T: 'Т',
  X: 'Х',
  a: 'а',
  c: 'с',
  e: 'е',
  i: 'і',
  k: 'к',
  o: 'о',
  p: 'р',
  x: 'х',
};
const FICE_GROUP =
  /^І[А-ЯІЇЄҐ]-(зп|з|п|в|о)?(0[1-9]|[1-9]\d)(мп|мн|ф)?(і|а|д)?$/;

/** "іп 61", "IП–61" → "ІП-61"; null when it is not a FICE group code. */
export function normalizeGroup(raw: string): string | null {
  const compact = [...raw.replace(/\s+/g, '').replace(/[‐-―−]/g, '-')]
    .map((ch) => LOOKALIKES[ch] ?? ch)
    .join('');
  const group = `${compact.slice(0, 2).toUpperCase()}-${compact
    .slice(2)
    .replace(/^-/, '')
    .toLowerCase()}`;
  return FICE_GROUP.test(group) ? group : null;
}

export const compareGroups = (a: string, b: string) =>
  a.localeCompare(b, 'uk', { numeric: true });

/** Trims and collapses whitespace, so a pasted line break can't split a name. */
export const oneLine = (value?: string | null) =>
  (value ?? '').replace(/\s+/g, ' ').trim();

/** RFC 4180: quoted fields may hold commas, doubled quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') field += text[++i];
      else quoted = false;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      rows.push([...row, field]);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

const TEACHER_COLUMNS = [
  'Викладач',
  'Дисципліна',
  'Групи',
  'Telegram',
  'Пошта',
];

/** Several contacts in one cell (one per line) → "a, b". */
const contacts = (cell = '', max: number) =>
  cell.split(/\s+/).filter(Boolean).join(', ').slice(0, max) || null;

interface TeacherBlock {
  email: string | null;
  telegram: string | null;
  courses: Map<string, Set<string>>;
}

/**
 * The campus export (fiot_teachers.py): a teacher's name and contacts sit on
 * the first row of their block, the next rows add disciplines. The same
 * discipline taught in several roles merges into one list of groups.
 */
export function parseTeachersCsv(text: string): ImportedTeacher[] {
  const [header = [], ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
  const at = TEACHER_COLUMNS.map((name) =>
    header.findIndex((cell) => cell.trim() === name),
  );
  if (at.some((i) => i < 0)) {
    throw new Error(
      `Очікую CSV з колонками: ${TEACHER_COLUMNS.join(', ')} (експорт з кампусу)`,
    );
  }
  const [name, discipline, groups, telegram, email] = at;

  const teachers = new Map<string, TeacherBlock>();
  let current: TeacherBlock | undefined;
  for (const row of rows) {
    const fullName = oneLine(row[name]).slice(0, 120);
    if (fullName) {
      current = teachers.get(fullName);
      if (!current) {
        current = { email: null, telegram: null, courses: new Map() };
        teachers.set(fullName, current);
      }
      current.email ??= contacts(row[email], 255);
      current.telegram ??= contacts(row[telegram], 120);
    }
    const title = oneLine(row[discipline]).slice(0, 255);
    if (!current || !title) continue;
    const list = current.courses.get(title) ?? new Set<string>();
    for (const raw of (row[groups] ?? '').split(',')) {
      const group = normalizeGroup(raw);
      if (group) list.add(group);
    }
    current.courses.set(title, list);
  }

  return [...teachers].map(([fullName, t]) => ({
    fullName,
    email: t.email,
    telegram: t.telegram,
    courses: [...t.courses].map(([title, list]) => ({
      discipline: title,
      groups: [...list].sort(compareGroups),
    })),
  }));
}

/**
 * One pasted spreadsheet row: the cell that is a group code, and the rest
 * joined (a name split into columns, or a tag). Row numbers are dropped.
 * "ІП-61⇥@tag", "ІП-61 Іваненко Іван", "Іваненко⇥Іван⇥ІП-61" all work.
 */
export function parseGroupLine(
  line: string,
): { group: string; value: string } | null {
  const cells = (
    line.includes('\t') ? line.split('\t') : line.trim().split(/\s+/)
  )
    .map((cell) => cell.trim())
    .filter((cell) => cell && !/^\d+\.?$/.test(cell));
  const at = cells.findIndex((cell) => normalizeGroup(cell) !== null);
  if (at < 0) return null;
  return {
    group: normalizeGroup(cells[at])!,
    value: oneLine(cells.filter((_, i) => i !== at).join(' ')),
  };
}

export interface StarostaLine {
  group: string;
  /** "@username", or null to remove the group's starosta. */
  telegramTag: string | null;
}

/** "група ⇥ @тег" lines; lines that are neither are returned as `skipped`. */
export function parseStarostas(text: string) {
  const starostas = new Map<string, StarostaLine>();
  const skipped: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parsed = parseGroupLine(line);
    const username = parsed?.value ? tagUsername(parsed.value) : null;
    if (!parsed || (parsed.value && !username)) {
      skipped.push(line.trim());
      continue;
    }
    starostas.set(parsed.group, {
      group: parsed.group,
      telegramTag: username ? `@${username}` : null,
    });
  }
  return { starostas: [...starostas.values()], skipped };
}

/** "група ⇥ ПІБ" lines → names per group. */
export function parseStudents(text: string) {
  const groups = new Map<string, Set<string>>();
  const skipped: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parsed = parseGroupLine(line);
    if (!parsed?.value) {
      skipped.push(line.trim());
      continue;
    }
    const names = groups.get(parsed.group) ?? new Set<string>();
    names.add(parsed.value.slice(0, 120));
    groups.set(parsed.group, names);
  }
  return { groups, skipped };
}

/**
 * Awards to delete and create when a shara's slots get `names` ("" = free).
 * A slot whose name stays keeps its award, and the certificate already issued
 * for it; a changed name gets a new award id, so the old certificate stops
 * checking out.
 */
export function diffSlots(
  current: { id: string; slot: number; studentName: string }[],
  names: string[],
) {
  const remove = current
    .filter((award) => names[award.slot] !== award.studentName)
    .map((award) => award.id);
  const create = names.flatMap((studentName, slot) =>
    studentName &&
    !current.some((a) => a.slot === slot && a.studentName === studentName)
      ? [{ slot, studentName }]
      : [],
  );
  return { remove, create };
}
