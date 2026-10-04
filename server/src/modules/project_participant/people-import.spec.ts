import { strToU8, zipSync } from 'fflate';
import {
  ARCHIVE_FORMAT,
  normalizePersonName,
  PeopleArchiveError,
  readPeopleArchive,
} from './people-import';

const DEPT = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

const archive = (
  manifest: unknown,
  extra: Record<string, Uint8Array> = {},
) =>
  Buffer.from(
    zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest)),
      ...extra,
    }),
  );

const manifest = (people: unknown[], departmentId = DEPT) => ({
  format: ARCHIVE_FORMAT,
  skipped: { bots: 2, deleted: 1 },
  departments: [{ departmentId, name: 'Медіа', chat: '-1001', people }],
});

describe('readPeopleArchive', () => {
  it('reads people, their avatars and what the tool skipped', () => {
    const result = readPeopleArchive(
      archive(
        manifest([
          { telegramId: '111', fullName: '  Олена   Коваль ', avatar: 'avatars/111.jpg' },
          { telegramId: '222', fullName: 'Без Фото', avatar: null },
        ]),
        { 'avatars/111.jpg': JPEG },
      ),
    );

    expect(result.skippedByTool).toEqual({ bots: 2, deleted: 1 });
    expect(result.invalid).toBe(0);
    expect(result.departments).toHaveLength(1);
    const [first, second] = result.departments[0].people;
    expect(first.telegramId).toBe(111n);
    expect(first.fullName).toBe('Олена Коваль');
    expect(first.avatar).toEqual(Buffer.from(JPEG));
    expect(second.avatar).toBeNull();
  });

  it('never keeps usernames or other extra fields', () => {
    const result = readPeopleArchive(
      archive(manifest([{ telegramId: '5', fullName: 'A B', username: 'secret' }])),
    );
    expect(Object.keys(result.departments[0].people[0]).sort()).toEqual([
      'avatar',
      'fullName',
      'telegramId',
    ]);
  });

  it('counts broken or repeated entries as invalid', () => {
    const result = readPeopleArchive(
      archive(
        manifest([
          { telegramId: 'abc', fullName: 'X' },
          { telegramId: '7', fullName: '   ' },
          { telegramId: '0', fullName: 'Zero' },
          { telegramId: '8', fullName: 'Ok' },
          { telegramId: '8', fullName: 'Again' },
          null,
        ]),
      ),
    );
    expect(result.invalid).toBe(5);
    expect(result.departments[0].people.map((p) => p.fullName)).toEqual(['Ok']);
  });

  it('drops avatars that are not JPEG or not in the archive', () => {
    const result = readPeopleArchive(
      archive(
        manifest([
          { telegramId: '1', fullName: 'A', avatar: 'avatars/1.jpg' },
          { telegramId: '2', fullName: 'B', avatar: 'avatars/2.jpg' },
          { telegramId: '3', fullName: 'C', avatar: '../etc/passwd' },
        ]),
        { 'avatars/1.jpg': strToU8('<svg/>') },
      ),
    );
    expect(result.departments[0].people.every((p) => p.avatar === null)).toBe(
      true,
    );
  });

  it('skips departments with a malformed id', () => {
    const result = readPeopleArchive(
      archive(manifest([{ telegramId: '1', fullName: 'A' }], 'not-a-uuid')),
    );
    expect(result.departments).toHaveLength(0);
    expect(result.invalid).toBe(1);
  });

  it.each([
    ['a non-zip file', Buffer.from('{"format":"x"}')],
    ['a zip without a manifest', Buffer.from(zipSync({ 'a.txt': strToU8('hi') }))],
    ['an unknown format', archive({ format: 'other', departments: [] })],
    ['a broken manifest', Buffer.from(zipSync({ 'manifest.json': strToU8('{') }))],
  ])('rejects %s', (_label, data) => {
    expect(() => readPeopleArchive(data)).toThrow(PeopleArchiveError);
  });

  it('rejects an archive with too many people', () => {
    const people = Array.from({ length: 5001 }, (_, i) => ({
      telegramId: String(i + 1),
      fullName: `P ${i}`,
    }));
    expect(() => readPeopleArchive(archive(manifest(people)))).toThrow(
      /більше ніж 5000/,
    );
  });
});

describe('normalizePersonName', () => {
  it('ignores case, extra spaces and apostrophe variants', () => {
    expect(normalizePersonName('  Дарʼя   Цвілюк ')).toBe(
      normalizePersonName("дар'я цвілюк"),
    );
    expect(normalizePersonName('Дар’я Цвілюк')).toBe("дар'я цвілюк");
  });
});
