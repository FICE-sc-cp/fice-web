export interface BaseQuestionConfig {
  enabled: boolean;
  required: boolean;
  label: string;
}

export interface BaseQuestionsConfig {
  fullName?: BaseQuestionConfig;
  telegramTag?: BaseQuestionConfig;
  group?: BaseQuestionConfig;
  birthDate?: BaseQuestionConfig;
  phone?: BaseQuestionConfig;
}

export const DEFAULT_BASE_QUESTIONS: BaseQuestionsConfig = {
  fullName: { enabled: true, required: true, label: 'ПІБ' },
  telegramTag: { enabled: true, required: true, label: 'Telegram-тег' },
  group: { enabled: true, required: true, label: 'Академічна група' },
  birthDate: { enabled: true, required: false, label: 'Дата народження' },
  phone: { enabled: false, required: false, label: 'Номер телефону' },
};

export function baseQuestionsOf(event: {
  baseQuestionsConfig?: unknown;
}): BaseQuestionsConfig {
  return (
    (event.baseQuestionsConfig as BaseQuestionsConfig | null | undefined) ??
    DEFAULT_BASE_QUESTIONS
  );
}

export const YES_NO_OPTIONS = ['Так', 'Ні'];

export function choiceOptions(question: {
  type: string;
  options?: string[];
}): string[] | null {
  if (question.type === 'YES_NO') return YES_NO_OPTIONS;
  if (question.type === 'SINGLE_CHOICE') return question.options ?? [];
  return null;
}
