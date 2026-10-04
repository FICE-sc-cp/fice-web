import { ADMIN_IMAGE_PROFILE, PUBLIC_IMAGE_PROFILE } from './image-processing';
import { needsReencode } from './reencode-plan';

const file = (name: string, width: number, height: number, kb: number) => ({
  name,
  width,
  height,
  bytes: kb * 1024,
});

describe('needsReencode', () => {
  it('picks images larger than the profile allows', () => {
    expect(needsReencode(file('a.png', 3872, 2581, 300), ADMIN_IMAGE_PROFILE)).toBe(true);
    expect(needsReencode(file('a.jpg', 1080, 2400, 200), ADMIN_IMAGE_PROFILE)).toBe(true);
  });

  it('keeps receipts up to the public limit', () => {
    expect(needsReencode(file('r.jpg', 1200, 2600, 600), PUBLIC_IMAGE_PROFILE)).toBe(false);
  });

  it('picks heavy JPEGs even within the size limit', () => {
    expect(needsReencode(file('a.jpeg', 1920, 1280, 3100), ADMIN_IMAGE_PROFILE)).toBe(true);
    expect(needsReencode(file('a.jpg', 1920, 1280, 700), ADMIN_IMAGE_PROFILE)).toBe(false);
  });

  it('leaves small PNGs alone, since re-encoding them rarely helps', () => {
    expect(needsReencode(file('a.png', 1600, 900, 2100), ADMIN_IMAGE_PROFILE)).toBe(false);
  });
});
