import { BadRequestException } from '@nestjs/common';
import { validateAnswers } from './registration-answers';

const Q = {
  name: {
    id: 'q1',
    label: 'Нік',
    type: 'SHORT_TEXT' as const,
    required: true,
    options: [],
  },
  size: {
    id: 'q2',
    label: 'Розмір',
    type: 'SINGLE_CHOICE' as const,
    required: false,
    options: ['S', 'M', 'L'],
  },
  vegan: {
    id: 'q3',
    label: 'Веган?',
    type: 'YES_NO' as const,
    required: false,
    options: [],
  },
  about: {
    id: 'q4',
    label: 'Про себе',
    type: 'LONG_TEXT' as const,
    required: false,
    options: [],
  },
};
const ALL = Object.values(Q);

describe('validateAnswers', () => {
  it('keeps valid answers in question order and drops unknown questions', () => {
    expect(
      validateAnswers(ALL, [
        { questionId: 'q3', value: 'Так' },
        { questionId: 'nope', value: 'x' },
        { questionId: 'q1', value: '  Neo  ' },
        { questionId: 'q2', value: 'M' },
      ]),
    ).toEqual([
      { questionId: 'q1', value: 'Neo' },
      { questionId: 'q2', value: 'M' },
      { questionId: 'q3', value: 'Так' },
    ]);
  });

  it('requires required questions', () => {
    expect(() => validateAnswers(ALL, [])).toThrow(BadRequestException);
    expect(() =>
      validateAnswers(ALL, [{ questionId: 'q1', value: '   ' }]),
    ).toThrow('Обовʼязкове');
  });

  it('accepts only listed options for choice questions', () => {
    expect(() =>
      validateAnswers(ALL, [
        { questionId: 'q1', value: 'Neo' },
        { questionId: 'q2', value: 'XXL' },
      ]),
    ).toThrow('варіантів');
    expect(() =>
      validateAnswers(ALL, [
        { questionId: 'q1', value: 'Neo' },
        { questionId: 'q3', value: 'maybe' },
      ]),
    ).toThrow('варіантів');
  });

  it('caps answer length by question type', () => {
    expect(() =>
      validateAnswers(ALL, [{ questionId: 'q1', value: 'x'.repeat(301) }]),
    ).toThrow('задовга');
    expect(
      validateAnswers(ALL, [
        { questionId: 'q1', value: 'Neo' },
        { questionId: 'q4', value: 'x'.repeat(2000) },
      ]),
    ).toHaveLength(2);
  });

  it('uses the first answer when a question is answered twice', () => {
    expect(
      validateAnswers(ALL, [
        { questionId: 'q1', value: 'first' },
        { questionId: 'q1', value: 'second' },
      ]),
    ).toEqual([{ questionId: 'q1', value: 'first' }]);
  });
});
