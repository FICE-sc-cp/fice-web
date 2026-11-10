import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { matchesSignature } from './file-signature';
import { extensionsOf, kindOf, MAX_PUBLIC_UPLOAD_BYTES } from './upload-types';

const ascii = (s: string) => Buffer.from(s, 'ascii');
const box = (type: string, brand = 'isom') =>
  Buffer.concat([Buffer.from([0, 0, 0, 24]), ascii(type), ascii(brand)]);
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const SAMPLES: Record<string, Buffer> = {
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
  webp: Buffer.concat([ascii('RIFF'), Buffer.alloc(4), ascii('WEBPVP8 ')]),
  pdf: ascii('%PDF-1.7\n'),
  mp4: box('ftyp'),
  mov: box('ftyp', 'qt  '),
  movOld: box('moov'),
  webm: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42]),
  doc: Buffer.concat([
    OLE2,
    Buffer.alloc(504),
    Buffer.from('WordDocument', 'utf16le'),
  ]),
  xls: Buffer.concat([
    OLE2,
    Buffer.alloc(504),
    Buffer.from('Workbook', 'utf16le'),
  ]),
  docx: Buffer.concat([
    ZIP,
    Buffer.alloc(26),
    ascii('[Content_Types].xml'),
    Buffer.alloc(40),
    ascii('word/document.xml'),
  ]),
  zip: Buffer.concat([ZIP, Buffer.alloc(26), ascii('secret/payload.exe')]),
  xlsx: Buffer.concat([
    ZIP,
    Buffer.alloc(26),
    ascii('[Content_Types].xml'),
    ascii('xl/workbook.xml'),
  ]),
  html: ascii('<!doctype html><script>alert(1)</script>'),
  svg: ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
};

describe('matchesSignature', () => {
  let dir: string;
  const fileWith = (name: string, bytes: Buffer) => {
    const path = join(dir, name);
    writeFileSync(path, bytes);
    return path;
  };

  beforeAll(() => (dir = mkdtempSync(join(tmpdir(), 'sig-'))));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it.each([
    ['.jpg', 'jpg'],
    ['.jpeg', 'jpg'],
    ['.png', 'png'],
    ['.webp', 'webp'],
    ['.pdf', 'pdf'],
    ['.mp4', 'mp4'],
    ['.mov', 'mov'],
    ['.mov', 'movOld'],
    ['.webm', 'webm'],
    ['.doc', 'doc'],
    ['.docx', 'docx'],
  ])('accepts a real %s file', (ext, sample) => {
    expect(matchesSignature(fileWith(`ok${ext}`, SAMPLES[sample]), ext)).toBe(
      true,
    );
  });

  it.each([
    ['.docx', 'png'],
    ['.docx', 'zip'],
    ['.docx', 'xlsx'],
    ['.doc', 'xls'],
    ['.doc', 'pdf'],
    ['.pdf', 'html'],
    ['.jpg', 'svg'],
    ['.png', 'jpg'],
    ['.mp4', 'webm'],
    ['.mov', 'pdf'],
    ['.webm', 'mp4'],
    ['.exe', 'doc'],
  ])('refuses a %s that is really %s', (ext, sample) => {
    expect(matchesSignature(fileWith(`bad${ext}`, SAMPLES[sample]), ext)).toBe(
      false,
    );
  });

  it('refuses empty and missing files', () => {
    expect(
      matchesSignature(fileWith('empty.pdf', Buffer.alloc(0)), '.pdf'),
    ).toBe(false);
    expect(matchesSignature(join(dir, 'missing.pdf'), '.pdf')).toBe(false);
  });
});

describe('upload types', () => {
  it('maps extensions to the kinds a question can allow', () => {
    expect(kindOf('.JPEG')).toBe('IMAGE');
    expect(kindOf('.mov')).toBe('VIDEO');
    expect(kindOf('.docx')).toBe('WORD');
    expect(kindOf('.gif')).toBeNull();
    expect(kindOf('.svg')).toBeNull();
    expect(extensionsOf(['PDF', 'WORD'])).toEqual(['.pdf', '.doc', '.docx']);
  });

  it('accepts videos up to 50 MB at the endpoint', () => {
    expect(MAX_PUBLIC_UPLOAD_BYTES).toBe(50 * 1024 * 1024);
  });
});
