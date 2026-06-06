/** Directory where uploaded files are stored (relative to the process cwd). */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

/** Public URL prefix the files are served under. */
export const UPLOAD_URL_PREFIX = '/uploads';

/** Max upload size in bytes. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
