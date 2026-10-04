import { BadRequestException } from '@nestjs/common';
import { EventQuestionType } from '@prisma/client';

export const YES_NO_OPTIONS = ['Так', 'Ні'];
export const SHORT_TEXT_MAX = 300;
export const LONG_TEXT_MAX = 2000;

interface Question {
  id: string;
  label: string;
  type: EventQuestionType;
  required: boolean;
  options: string[];
}

export function validateAnswers(
  questions: Question[],
  answers: { questionId: string; value?: string | null }[],
): { questionId: string; value: string }[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const values = new Map<string, string>();
  for (const a of answers) {
    if (!byId.has(a.questionId) || values.has(a.questionId)) continue;
    const value = (a.value ?? '').trim();
    if (value) values.set(a.questionId, value);
  }

  for (const q of questions) {
    const value = values.get(q.id);
    if (!value) {
      if (q.required) {
        throw new BadRequestException(
          `Обовʼязкове питання без відповіді: ${q.label}`,
        );
      }
      continue;
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
