import type { AnswerFile, QuestionFileKind } from '@/lib/api';

export const MAX_UPLOAD_MB = 10;
export const RECEIPT_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const HEIC = /\.(heic|heif)$/i;
const HEIC_TIP = 'Фото з iPhone (HEIC) збережіть як JPG або зробіть скриншот.';

export function uploadProblem(
  file: File,
  { allowPdf }: { allowPdf: boolean },
): string | null {
  const isImage = IMAGE_TYPES.includes(file.type) || IMAGE_EXTENSIONS.test(file.name);
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isImage && !(allowPdf && isPdf)) {
    return allowPdf
      ? `Підтримуються лише JPG, PNG, WEBP або PDF. ${HEIC_TIP}`
      : `Підтримуються лише JPG, PNG або WEBP. ${HEIC_TIP}`;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `Файл завеликий: максимум ${MAX_UPLOAD_MB} МБ.`;
  }
  return null;
}
export const isRemoteImage = (src: string) => /^https?:\/\//i.test(src);

/** News covers may be MP4/WEBM videos (or GIFs, which render as images). */
export const isVideo = (src: string) => /\.(mp4|webm)(\?|$)/i.test(src);
export const isGif = (src: string) => /\.gif(\?|$)/i.test(src);

interface FileKindInfo {
  label: string;
  noun: string;
  formats: string;
  icon: string;
  extensions: string[];
  types: string[];
  maxMb: number;
}

export const FILE_KINDS: Record<QuestionFileKind, FileKindInfo> = {
  IMAGE: {
    label: 'Фото',
    noun: 'фото',
    formats: 'JPG, PNG, WEBP',
    icon: '🖼️',
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    types: IMAGE_TYPES,
    maxMb: 10,
  },
  VIDEO: {
    label: 'Відео',
    noun: 'відео',
    formats: 'MP4, MOV, WEBM',
    icon: '🎬',
    extensions: ['.mp4', '.mov', '.webm'],
    types: ['video/mp4', 'video/quicktime', 'video/webm'],
    maxMb: 50,
  },
  PDF: {
    label: 'PDF',
    noun: 'PDF',
    formats: 'PDF',
    icon: '📄',
    extensions: ['.pdf'],
    types: ['application/pdf'],
    maxMb: 10,
  },
  WORD: {
    label: 'Word',
    noun: 'Word',
    formats: 'DOC, DOCX',
    icon: '📝',
    extensions: ['.doc', '.docx'],
    types: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxMb: 10,
  },
};

const KIND_ORDER = Object.keys(FILE_KINDS) as QuestionFileKind[];

export const extensionOf = (name: string) =>
  name.match(/\.[^./\\]+$/)?.[0].toLowerCase() ?? '';

export function fileKindOf(file: { name: string; type?: string }): QuestionFileKind | null {
  const type = file.type?.toLowerCase() ?? '';
  const ext = extensionOf(file.name);
  return (
    KIND_ORDER.find((kind) => FILE_KINDS[kind].types.includes(type)) ??
    KIND_ORDER.find((kind) => FILE_KINDS[kind].extensions.includes(ext)) ??
    null
  );
}

export function shortName(name: string): string {
  const chars = [...name];
  if (chars.length <= 40) return name;
  const ext = extensionOf(name);
  return `${chars.slice(0, 36 - ext.length).join('')}…${ext}`;
}

function joinOr(items: string[]): string {
  return items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} або ${items[items.length - 1]}`;
}

const sortKinds = (kinds: QuestionFileKind[]) =>
  KIND_ORDER.filter((kind) => kinds.includes(kind));

export function fileAccept(kinds: QuestionFileKind[]): string {
  return sortKinds(kinds)
    .flatMap((kind) => [...FILE_KINDS[kind].extensions, ...FILE_KINDS[kind].types])
    .join(',');
}

export function fileHint(kinds: QuestionFileKind[], maxFiles: number): string {
  const sorted = sortKinds(kinds);
  const types = joinOr(
    sorted.map((kind, i) => {
      const { label, noun, formats } = FILE_KINDS[kind];
      const name = i === 0 ? label : noun;
      return formats === label ? name : `${name} (${formats})`;
    }),
  );
  const count = maxFiles === 1 ? 'один файл' : `до ${maxFiles} файлів`;
  const limits = [...new Set(sorted.map((kind) => FILE_KINDS[kind].maxMb))];
  const size =
    limits.length > 1
      ? `відео до ${FILE_KINDS.VIDEO.maxMb} МБ, решта до ${MAX_UPLOAD_MB} МБ`
      : `до ${limits[0] ?? MAX_UPLOAD_MB} МБ${maxFiles > 1 ? ' кожен' : ''}`;
  return `${types} · ${count} · ${size}`;
}

export function tooLargeText(name: string, kind: QuestionFileKind): string {
  const { maxMb } = FILE_KINDS[kind];
  return kind === 'VIDEO'
    ? `Відео «${shortName(name)}» завелике: максимум ${maxMb} МБ.`
    : `Файл «${shortName(name)}» завеликий: максимум ${maxMb} МБ.`;
}

export function fileProblem(file: File, kinds: QuestionFileKind[]): string | null {
  const kind = fileKindOf(file);
  if (!kind || !kinds.includes(kind)) {
    const allowed = joinOr(sortKinds(kinds).map((k) => FILE_KINDS[k].formats));
    const tip = HEIC.test(file.name) ? ` ${HEIC_TIP}` : '';
    return `Файл «${shortName(file.name)}» не підходить: можна ${allowed}.${tip}`;
  }
  if (file.size === 0) return `Файл «${shortName(file.name)}» порожній, обери інший.`;
  if (file.size > FILE_KINDS[kind].maxMb * 1024 * 1024) return tooLargeText(file.name, kind);
  return null;
}

export function formatSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 1
    ? `${mb.toLocaleString('uk-UA', { maximumFractionDigits: 1 })} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function isAnswerFile(item: unknown): item is AnswerFile {
  if (typeof item !== 'object' || item === null) return false;
  const { url, name } = item as Record<string, unknown>;
  return typeof url === 'string' && url.startsWith('/uploads/') && typeof name === 'string';
}

export function parseFileAnswer(value: string): AnswerFile[] | null {
  if (!value.startsWith('[')) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.every(isAnswerFile) ? parsed : null;
  } catch {
    return null;
  }
}
