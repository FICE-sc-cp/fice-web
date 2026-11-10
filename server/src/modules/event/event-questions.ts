import { BadRequestException } from '@nestjs/common';
import { EventQuestionType, QuestionFileKind } from '@prisma/client';

export const MAX_FILE_QUESTIONS = 3;
export const MAX_FILES_PER_QUESTION = 10;

interface QuestionInput {
  label: string;
  type: EventQuestionType;
  required?: boolean;
  options?: string[];
  fileKinds?: QuestionFileKind[];
  maxFiles?: number;
  order?: number;
}

export function assertQuestionsConfig(questions: QuestionInput[]): void {
  const files = questions.filter((q) => q.type === EventQuestionType.FILE);
  if (files.length > MAX_FILE_QUESTIONS) {
    throw new BadRequestException(
      `Можна додати не більше ${MAX_FILE_QUESTIONS} питань із файлами`,
    );
  }
  const untyped = files.find((q) => !q.fileKinds?.length);
  if (untyped) {
    throw new BadRequestException(
      `Обери, які файли можна прикріпити: ${untyped.label}`,
    );
  }
}

export function questionData(q: QuestionInput, index: number) {
  const isFile = q.type === EventQuestionType.FILE;
  return {
    label: q.label,
    type: q.type,
    required: q.required ?? false,
    options: q.options ?? [],
    fileKinds: isFile ? [...new Set(q.fileKinds ?? [])] : [],
    maxFiles: isFile
      ? Math.min(Math.max(q.maxFiles ?? 1, 1), MAX_FILES_PER_QUESTION)
      : 1,
    order: q.order ?? index,
  };
}
