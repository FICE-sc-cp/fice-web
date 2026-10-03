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

export function ownUploadExists(
  url: string,
  pattern = OWN_UPLOAD_URL,
): boolean {
  if (!pattern.test(url)) return false;
  return existsSync(resolve(UPLOAD_DIR, basename(url)));
}
