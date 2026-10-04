export interface RgbaBitmap {
  data: Buffer;
  width: number;
  height: number;
}

type SourcePixel = (x: number, y: number) => [number, number];

function mapping(orientation: number, w: number, h: number): SourcePixel | null {
  switch (orientation) {
    case 2:
      return (x, y) => [w - x - 1, y];
    case 3:
      return (x, y) => [w - x - 1, h - y - 1];
    case 4:
      return (x, y) => [x, h - y - 1];
    case 5:
      return (x, y) => [y, x];
    case 6:
      return (x, y) => [y, h - x - 1];
    case 7:
      return (x, y) => [w - y - 1, h - x - 1];
    case 8:
      return (x, y) => [w - y - 1, x];
    default:
      return null;
  }
}

export function applyOrientation(bitmap: RgbaBitmap, orientation: number): void {
  const { width: w, height: h, data: source } = bitmap;
  const sourceOf = mapping(orientation, w, h);
  if (!sourceOf) return;
  const swap = orientation >= 5;
  const width = swap ? h : w;
  const height = swap ? w : h;
  const data = Buffer.alloc(source.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [sx, sy] = sourceOf(x, y);
      source.copy(data, (y * width + x) * 4, (sy * w + sx) * 4, (sy * w + sx) * 4 + 4);
    }
  }
  bitmap.data = data;
  bitmap.width = width;
  bitmap.height = height;
}
