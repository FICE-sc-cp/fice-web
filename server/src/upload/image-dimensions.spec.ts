import sharp from 'sharp';
import { imageDimensions } from './image-dimensions';

const make = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#123456' } });

describe('imageDimensions', () => {
  it('reads PNG dimensions from the header', async () => {
    const png = await make(321, 123).png().toBuffer();
    expect(imageDimensions(png)).toEqual({ width: 321, height: 123 });
  });

  it('reads JPEG dimensions behind EXIF segments', async () => {
    const jpeg = await make(1500, 700)
      .withExif({ IFD0: { Make: 'TestPhone', Model: 'x'.repeat(2000) } })
      .jpeg({ progressive: true })
      .toBuffer();
    expect(imageDimensions(jpeg)).toEqual({ width: 1500, height: 700 });
  });

  it('returns null for other or broken data', () => {
    expect(imageDimensions(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(imageDimensions(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    expect(imageDimensions(Buffer.alloc(0))).toBeNull();
  });

  it('reports a huge declared size without decoding it', () => {
    const header = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header);
    header.writeUInt32BE(13, 8);
    header.write('IHDR', 12, 'ascii');
    header.writeUInt32BE(20000, 16);
    header.writeUInt32BE(20000, 20);
    expect(imageDimensions(header)).toEqual({ width: 20000, height: 20000 });
  });
});
