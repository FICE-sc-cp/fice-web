import { BadRequestException } from '@nestjs/common';
import { EventQuestionType, QuestionFileKind } from '@prisma/client';
import { ownUploadExists, ownUploadUrl } from '../../upload/own-upload';
import { extensionsOf } from '../../upload/upload-types';

export const YES_NO_OPTIONS = ['Так', 'Ні'];
export const SHORT_TEXT_MAX = 300;
export const LONG_TEXT_MAX = 2000;
const FILE_NAME_MAX = 120;

interface Question {
  id: string;
  label: string;
  type: EventQuestionType;
  required: boolean;
  options: string[];
  fileKinds?: QuestionFileKind[];
  maxFiles?: number;
}

export interface AnswerFile {
  url: string;
  name: string;
}

interface AnswerInput {
  questionId: string;
  value?: string | null;
  files?: { url: string; name?: string | null }[] | null;
}

type FileCheck = (url: string, pattern: RegExp) => boolean;

export function cleanFileName(
  raw: string | null | undefined,
  index: number,
): string {
  const name = (raw ?? '')
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) return `Файл ${index + 1}`;
  const chars = [...name];
  return chars.length > FILE_NAME_MAX
    ? `${chars.slice(0, FILE_NAME_MAX - 1).join('')}…`
    : name;
}

function fileAnswer(
  q: Question,
  files: NonNullable<AnswerInput['files']>,
  fileExists: FileCheck,
): string {
  if (files.length === 0) return '';
  const max = q.maxFiles ?? 1;
  if (files.length > max) {
    throw new BadRequestException(
      `Забагато файлів (можна до ${max}): ${q.label}`,
    );
  }
  const pattern = ownUploadUrl(extensionsOf(q.fileKinds ?? []));
  const seen = new Set<string>();
  const clean = files.map((file, i): AnswerFile => {
    const url = (file.url ?? '').trim();
    if (!pattern.test(url)) {
      throw new BadRequestException(
        `Цей тип файлу тут не приймається: ${q.label}`,
      );
    }
    if (seen.has(url)) {
      throw new BadRequestException(
        `Один і той самий файл додано двічі: ${q.label}`,
      );
    }
    if (!fileExists(url, pattern)) {
      throw new BadRequestException(
        `Файл не знайдено, завантажте його ще раз: ${q.label}`,
      );
    }
    seen.add(url);
    return { url, name: cleanFileName(file.name, i) };
  });
  return JSON.stringify(clean);
}

function isAnswerFile(item: unknown): item is AnswerFile {
  if (typeof item !== 'object' || item === null) return false;
  const { url, name } = item as Record<string, unknown>;
  return (
    typeof url === 'string' &&
    url.startsWith('/uploads/') &&
    typeof name === 'string'
  );
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

export function validateAnswers(
  questions: Question[],
  answers: AnswerInput[],
  fileExists: FileCheck = ownUploadExists,
): { questionId: string; value: string }[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const values = new Map<string, string>();
  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q || values.has(q.id)) continue;
    const value =
      q.type === EventQuestionType.FILE
        ? fileAnswer(q, a.files ?? [], fileExists)
        : (a.value ?? '').trim();
    if (value) values.set(q.id, value);
  }

  for (const q of questions) {
    const value = values.get(q.id);
    if (!value) {
      if (q.required) {
        throw new BadRequestException(
          q.type === EventQuestionType.FILE
            ? `Додайте файл: ${q.label}`
            : `Обовʼязкове питання без відповіді: ${q.label}`,
        );
      }
      continue;
    }
    if (q.type === EventQuestionType.FILE) continue;
    if (parseFileAnswer(value)) {
      throw new BadRequestException(
        `Відповідь має неприпустимий формат: ${q.label}`,
      );
    }
    const allowed =
      q.type === EventQuestionType.YES_NO
        ? YES_NO_OPTIONS
        : q.type === EventQuestionType.SINGLE_CHOICE
          ? q.options
          : null;
    if (allowed && !allowed.includes(value)) {
      throw new BadRequestException(
        `Оберіть один із варіантів відповіді: ${q.label}`,
      );
    }
    const max =
      q.type === EventQuestionType.SHORT_TEXT ? SHORT_TEXT_MAX : LONG_TEXT_MAX;
    if (value.length > max) {
      throw new BadRequestException(
        `Відповідь задовга (до ${max} символів): ${q.label}`,
      );
    }
  }

  return questions
    .filter((q) => values.has(q.id))
    .map((q) => ({ questionId: q.id, value: values.get(q.id)! }));
}
