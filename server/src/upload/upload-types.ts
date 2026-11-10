import { QuestionFileKind } from '@prisma/client';

const MB = 1024 * 1024;

export const KIND_EXTENSIONS: Record<QuestionFileKind, string[]> = {
  IMAGE: ['.jpg', '.jpeg', '.png', '.webp'],
  VIDEO: ['.mp4', '.mov', '.webm'],
  PDF: ['.pdf'],
  WORD: ['.doc', '.docx'],
};

export const KIND_MAX_BYTES: Record<QuestionFileKind, number> = {
  IMAGE: 10 * MB,
  VIDEO: 50 * MB,
  PDF: 10 * MB,
  WORD: 10 * MB,
};

export const MAX_PUBLIC_UPLOAD_BYTES = Math.max(
  ...Object.values(KIND_MAX_BYTES),
);

export const PUBLIC_MIME_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    '.docx',
  ],
};

export function kindOf(ext: string): QuestionFileKind | null {
  const lower = ext.toLowerCase();
  const kinds = Object.keys(KIND_EXTENSIONS) as QuestionFileKind[];
  return kinds.find((kind) => KIND_EXTENSIONS[kind].includes(lower)) ?? null;
}

export function extensionsOf(kinds: QuestionFileKind[]): string[] {
  return kinds.flatMap((kind) => KIND_EXTENSIONS[kind]);
}

export function tooLargeMessage(kind: QuestionFileKind): string {
  return kind === 'VIDEO'
    ? `Відео завелике: максимум ${KIND_MAX_BYTES.VIDEO / MB} МБ.`
    : `Файл завеликий: максимум ${KIND_MAX_BYTES[kind] / MB} МБ.`;
}
