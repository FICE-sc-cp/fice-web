import { applyOrientation, RgbaBitmap } from './orientation';

const bitmap = (): RgbaBitmap => {
  const data = Buffer.alloc(3 * 2 * 4);
  [1, 2, 3, 4, 5, 6].forEach((v, i) => data.writeUInt8(v, i * 4));
  return { data, width: 3, height: 2 };
};

const rows = (b: RgbaBitmap) =>
  Array.from({ length: b.height }, (_, y) =>
    Array.from({ length: b.width }, (_, x) => b.data[(y * b.width + x) * 4]),
  );

describe('applyOrientation', () => {
  it.each([
    [1, [[1, 2, 3], [4, 5, 6]]],
    [2, [[3, 2, 1], [6, 5, 4]]],
    [3, [[6, 5, 4], [3, 2, 1]]],
    [4, [[4, 5, 6], [1, 2, 3]]],
    [5, [[1, 4], [2, 5], [3, 6]]],
    [6, [[4, 1], [5, 2], [6, 3]]],
    [7, [[6, 3], [5, 2], [4, 1]]],
    [8, [[3, 6], [2, 5], [1, 4]]],
  ])('turns orientation %i upright', (orientation, expected) => {
    const b = bitmap();
    applyOrientation(b, orientation);
    expect(rows(b)).toEqual(expected);
  });
});
