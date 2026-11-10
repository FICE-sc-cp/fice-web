import { existsSync } from 'fs';
import { basename, resolve } from 'path';
import { UPLOAD_DIR } from './upload.constants';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export const OWN_UPLOAD_URL = new RegExp(
  `^/uploads/${UUID}\\.(jpg|jpeg|png|webp|pdf)$`,
);
export const OWN_IMAGE_URL = new RegExp(
  `^/uploads/${UUID}\\.(jpg|jpeg|png|webp)$`,
);

const UPLOAD_IN_TEXT = new RegExp(`/uploads/(${UUID}\\.[a-z0-9]+)`, 'g');

export function ownUploadUrl(extensions: string[]): RegExp {
  const names = extensions.map((ext) => ext.replace(/^\./, '')).join('|');
  return new RegExp(`^/uploads/${UUID}\\.(${names})$`);
}

export function ownUploadExists(
  url: string,
  pattern = OWN_UPLOAD_URL,
): boolean {
  if (!pattern.test(url)) return false;
  return existsSync(resolve(UPLOAD_DIR, basename(url)));
}

export function uploadFilenames(
  values: (string | null | undefined)[],
): string[] {
  const names = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(UPLOAD_IN_TEXT)) names.add(match[1]);
  }
  return [...names];
}
