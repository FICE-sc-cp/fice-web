export interface ImageDimensions {
  width: number;
  height: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const isJpegFrameMarker = (marker: number) =>
  marker >= 0xc0 &&
  marker <= 0xcf &&
  marker !== 0xc4 &&
  marker !== 0xc8 &&
  marker !== 0xcc;

function pngDimensions(data: Buffer): ImageDimensions | null {
  if (data.length < 24 || !data.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }
  if (data.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function jpegDimensions(data: Buffer): ImageDimensions | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = data.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (isJpegFrameMarker(marker)) {
      if (offset + 9 > data.length) return null;
      return {
        height: data.readUInt16BE(offset + 5),
        width: data.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

export function imageDimensions(data: Buffer): ImageDimensions | null {
  return pngDimensions(data) ?? jpegDimensions(data);
}

function exifOrientation(tiff: Buffer): number {
  if (tiff.length < 8) return 1;
  const order = tiff.toString('ascii', 0, 2);
  if (order !== 'II' && order !== 'MM') return 1;
  const little = order === 'II';
  const u16 = (at: number) =>
    little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at);
  const u32 = (at: number) =>
    little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at);
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return 1;
  const entries = u16(ifd);
  for (let i = 0; i < entries; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return 1;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

export function jpegOrientation(data: Buffer): number {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return 1;
  let offset = 2;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) return 1;
    const marker = data[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda || isJpegFrameMarker(marker)) {
      return 1;
    }
    const length = data.readUInt16BE(offset + 2);
    if (length < 2) return 1;
    const start = offset + 4;
    if (
      marker === 0xe1 &&
      start + 6 <= data.length &&
      data.toString('ascii', start, start + 4) === 'Exif'
    ) {
      const end = Math.min(offset + 2 + length, data.length);
      return exifOrientation(data.subarray(start + 6, end));
    }
    offset += 2 + length;
  }
  return 1;
}
