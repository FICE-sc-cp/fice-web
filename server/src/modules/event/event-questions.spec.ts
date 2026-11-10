import { BadRequestException } from '@nestjs/common';
import { assertQuestionsConfig, questionData } from './event-questions';

const file = (label: string, fileKinds: ('IMAGE' | 'PDF')[] = ['IMAGE']) => ({
  label,
  type: 'FILE' as const,
  fileKinds,
});

describe('assertQuestionsConfig', () => {
  it('allows up to three file questions next to any number of others', () => {
    expect(() =>
      assertQuestionsConfig([
        file('Фото'),
        file('PDF', ['PDF']),
        file('Ще фото'),
        { label: 'Нік', type: 'SHORT_TEXT' },
        { label: 'Розмір', type: 'SINGLE_CHOICE', options: ['S'] },
      ]),
    ).not.toThrow();
  });

  it('refuses a fourth file question', () => {
    expect(() =>
      assertQuestionsConfig([file('1'), file('2'), file('3'), file('4')]),
    ).toThrow('не більше 3 питань із файлами');
  });

  it('needs at least one allowed file type', () => {
    expect(() => assertQuestionsConfig([file('Портфоліо', [])])).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertQuestionsConfig([{ label: 'Портфоліо', type: 'FILE' }]),
    ).toThrow('Портфоліо');
  });
});

describe('questionData', () => {
  it('keeps the file settings of a file question, without duplicates', () => {
    expect(
      questionData(
        {
          label: 'Фото',
          type: 'FILE',
          required: true,
          fileKinds: ['IMAGE', 'IMAGE', 'PDF'],
          maxFiles: 4,
        },
        2,
      ),
    ).toEqual({
      label: 'Фото',
      type: 'FILE',
      required: true,
      options: [],
      fileKinds: ['IMAGE', 'PDF'],
      maxFiles: 4,
      order: 2,
    });
  });

  it('keeps the file count between 1 and 10', () => {
    expect(questionData({ ...file('a'), maxFiles: 50 }, 0).maxFiles).toBe(10);
    expect(questionData({ ...file('a'), maxFiles: 0 }, 0).maxFiles).toBe(1);
    expect(questionData(file('a'), 0).maxFiles).toBe(1);
  });

  it('drops file settings from other question types', () => {
    expect(
      questionData(
        {
          label: 'Нік',
          type: 'SHORT_TEXT',
          fileKinds: ['VIDEO'],
          maxFiles: 5,
          order: 7,
        },
        0,
      ),
    ).toMatchObject({ fileKinds: [], maxFiles: 1, order: 7 });
  });
});
