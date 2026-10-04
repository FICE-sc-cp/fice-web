import { strFromU8, unzipSync } from 'fflate';

export const ARCHIVE_FORMAT = 'fice-people-wall/1';
export const CONFIG_FORMAT = 'fice-people-wall-config/1';

export const MAX_ARCHIVE_BYTES = 40 * 1024 * 1024;
const MAX_FILES = 6000;
const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_BYTES = 1024 * 1024;
const MAX_UNPACKED_BYTES = 200 * 1024 * 1024;
const MAX_PEOPLE = 5000;
const FULL_NAME_MAX = 120;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AVATAR_PATH = /^avatars\/\d{1,20}\.jpg$/;

export class PeopleArchiveError extends Error {}

export interface ArchivePerson {
  telegramId: bigint;
  fullName: string;
  avatar: Buffer | null;
}

export interface ArchiveDepartment {
  departmentId: string;
  people: ArchivePerson[];
}

export interface PeopleArchive {
  departments: ArchiveDepartment[];
  invalid: number;
  skippedByTool: { bots: number; deleted: number };
}

const isZip = (data: Buffer) =>
  data.length > 4 &&
  data[0] === 0x50 &&
  data[1] === 0x4b &&
  data[2] === 0x03 &&
  data[3] === 0x04;

const isJpeg = (data: Uint8Array) =>
  data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;

const count = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : 0;

function unpack(data: Buffer): Record<string, Uint8Array> {
  if (!isZip(data)) {
    throw new PeopleArchiveError('Це не архів експорту (очікується .zip).');
  }
  let files = 0;
  let unpacked = 0;
  try {
    return unzipSync(new Uint8Array(data), {
      filter: (file) => {
        files += 1;
        if (files > MAX_FILES) {
          throw new PeopleArchiveError('В архіві забагато файлів.');
        }
        const limit =
          file.name === 'manifest.json'
            ? MAX_MANIFEST_BYTES
            : AVATAR_PATH.test(file.name)
              ? MAX_AVATAR_BYTES
              : 0;
        if (!limit || file.originalSize > limit) return false;
        unpacked += file.originalSize;
        if (unpacked > MAX_UNPACKED_BYTES) {
          throw new PeopleArchiveError('Архів завеликий після розпакування.');
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof PeopleArchiveError) throw err;
    throw new PeopleArchiveError('Не вдалося розпакувати архів.');
  }
}

function readPerson(
  raw: unknown,
  files: Record<string, Uint8Array>,
): ArchivePerson | null {
  if (!raw || typeof raw !== 'object') return null;
  const { telegramId, fullName, avatar } = raw as Record<string, unknown>;
  if (typeof telegramId !== 'string' || !/^\d{1,20}$/.test(telegramId)) {
    return null;
  }
  const id = BigInt(telegramId);
  if (id <= 0n || id > 9_223_372_036_854_775_807n) return null;
  if (typeof fullName !== 'string') return null;
  const name = Array.from(fullName.replace(/\s+/g, ' ').trim())
    .slice(0, FULL_NAME_MAX)
    .join('');
  if (!name) return null;
  const file =
    typeof avatar === 'string' && AVATAR_PATH.test(avatar) ? files[avatar] : undefined;
  return {
    telegramId: id,
    fullName: name,
    avatar: file && isJpeg(file) ? Buffer.from(file) : null,
  };
}

export function readPeopleArchive(data: Buffer): PeopleArchive {
  const files = unpack(data);
  const manifestFile = files['manifest.json'];
  if (!manifestFile) {
    throw new PeopleArchiveError('В архіві немає manifest.json.');
  }
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(strFromU8(manifestFile)) as Record<string, unknown>;
  } catch {
    throw new PeopleArchiveError('manifest.json пошкоджено.');
  }
  if (manifest?.format !== ARCHIVE_FORMAT || !Array.isArray(manifest.departments)) {
    throw new PeopleArchiveError(
      'Невідомий формат архіву. Згенеруй його свіжою версією інструмента експорту.',
    );
  }

  const skipped = (manifest.skipped ?? {}) as Record<string, unknown>;
  const result: PeopleArchive = {
    departments: [],
    invalid: 0,
    skippedByTool: { bots: count(skipped.bots), deleted: count(skipped.deleted) },
  };
  let people = 0;

  for (const rawDept of manifest.departments as unknown[]) {
    const dept = (rawDept ?? {}) as Record<string, unknown>;
    const list = Array.isArray(dept.people) ? (dept.people as unknown[]) : [];
    if (typeof dept.departmentId !== 'string' || !UUID.test(dept.departmentId)) {
      result.invalid += list.length;
      continue;
    }
    const parsed: ArchivePerson[] = [];
    const seen = new Set<bigint>();
    for (const raw of list) {
      people += 1;
      if (people > MAX_PEOPLE) {
        throw new PeopleArchiveError(`В архіві більше ніж ${MAX_PEOPLE} людей.`);
      }
      const person = readPerson(raw, files);
      if (!person || seen.has(person.telegramId)) {
        result.invalid += 1;
        continue;
      }
      seen.add(person.telegramId);
      parsed.push(person);
    }
    result.departments.push({ departmentId: dept.departmentId, people: parsed });
  }
  return result;
}

export function normalizePersonName(name: string): string {
  return name
    .normalize('NFC')
    .replace(/[ʼ’`']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
