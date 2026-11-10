import { closeSync, openSync, readFileSync, readSync } from 'fs';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const WORD_STREAM = Buffer.from('WordDocument', 'utf16le');
const OOXML_TYPES = Buffer.from('[Content_Types].xml', 'ascii');
const WORD_PART = Buffer.from('word/', 'ascii');
const QUICKTIME_ATOMS = ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'];

function readHead(filePath: string, length: number): Buffer {
  const fd = openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(length);
    const read = readSync(fd, buf, 0, length, 0);
    return buf.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

export function matchesSignature(filePath: string, ext: string): boolean {
  try {
    const buf = readHead(filePath, 16);
    if (buf.length < 4) return false;
    switch (ext.toLowerCase()) {
      case '.jpg':
      case '.jpeg':
        return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      case '.png':
        return buf.subarray(0, 8).equals(PNG);
      case '.webp':
        return (
          buf.toString('ascii', 0, 4) === 'RIFF' &&
          buf.toString('ascii', 8, 12) === 'WEBP'
        );
      case '.pdf':
        return buf.toString('ascii', 0, 4) === '%PDF';
      case '.gif':
        return /^GIF8[79]a$/.test(buf.toString('ascii', 0, 6));
      case '.mp4':
        return buf.toString('ascii', 4, 8) === 'ftyp';
      case '.mov':
        return QUICKTIME_ATOMS.includes(buf.toString('ascii', 4, 8));
      case '.webm':
        return buf.readUInt32BE(0) === 0x1a45dfa3;
      case '.doc':
        return (
          buf.subarray(0, 8).equals(OLE2) &&
          readFileSync(filePath).includes(WORD_STREAM)
        );
      case '.docx': {
        if (!buf.subarray(0, 4).equals(ZIP)) return false;
        const whole = readFileSync(filePath);
        return whole.includes(OOXML_TYPES) && whole.includes(WORD_PART);
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}
