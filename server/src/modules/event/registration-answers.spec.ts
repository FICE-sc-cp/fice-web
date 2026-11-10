import { BadRequestException } from '@nestjs/common';
import { parseFileAnswer, validateAnswers } from './registration-answers';

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

describe('validateAnswers with file questions', () => {
  const id = (n: number) => `0000000${n}-aaaa-4bbb-8ccc-dddddddddddd`;
  const upload = (n: number, ext: string) => `/uploads/${id(n)}.${ext}`;
  const photos = {
    id: 'f1',
    label: 'Фото костюма',
    type: 'FILE' as const,
    required: true,
    options: [],
    fileKinds: ['IMAGE' as const],
    maxFiles: 2,
  };
  const docs = {
    id: 'f2',
    label: 'Резюме',
    type: 'FILE' as const,
    required: false,
    options: [],
    fileKinds: ['PDF' as const, 'WORD' as const],
    maxFiles: 1,
  };
  const exists = jest.fn((url: string, pattern: RegExp) => pattern.test(url));
  const check = (
    answers: Parameters<typeof validateAnswers>[1],
    questions = [photos, docs],
  ) => validateAnswers(questions, answers, exists);

  beforeEach(() => exists.mockClear());

  it('stores one file with its name', () => {
    const [answer] = check([
      { questionId: 'f1', files: [{ url: upload(1, 'jpg'), name: 'me.jpg' }] },
    ]);
    expect(JSON.parse(answer.value)).toEqual([
      { url: upload(1, 'jpg'), name: 'me.jpg' },
    ]);
  });

  it('stores several files in their order', () => {
    const [answer] = check([
      {
        questionId: 'f1',
        files: [
          { url: upload(1, 'png'), name: 'front.png' },
          { url: upload(2, 'webp'), name: 'back.webp' },
        ],
      },
    ]);
    expect(parseFileAnswer(answer.value)?.map((f) => f.name)).toEqual([
      'front.png',
      'back.webp',
    ]);
  });

  it('refuses more files than the question allows', () => {
    expect(() =>
      check([
        {
          questionId: 'f1',
          files: [1, 2, 3].map((n) => ({ url: upload(n, 'jpg') })),
        },
      ]),
    ).toThrow('Забагато файлів (можна до 2)');
  });

  it('refuses a file type the question does not accept', () => {
    expect(() =>
      check([{ questionId: 'f1', files: [{ url: upload(1, 'pdf') }] }]),
    ).toThrow('тип файлу');
    expect(() =>
      check([
        { questionId: 'f1', files: [{ url: upload(1, 'jpg') }] },
        { questionId: 'f2', files: [{ url: upload(2, 'mp4') }] },
      ]),
    ).toThrow('тип файлу');
  });

  it('refuses links that are not our uploads or are gone', () => {
    for (const url of [
      'https://evil.example/a.jpg',
      '/uploads/../.env',
      `/uploads/${id(1)}.svg`,
      `/uploads/${id(1)}.jpg?x=1`,
    ]) {
      expect(() => check([{ questionId: 'f1', files: [{ url }] }])).toThrow(
        BadRequestException,
      );
    }
    exists.mockReturnValueOnce(false);
    expect(() =>
      check([{ questionId: 'f1', files: [{ url: upload(1, 'jpg') }] }]),
    ).toThrow('Файл не знайдено');
  });

  it('refuses the same file twice', () => {
    expect(() =>
      check([
        {
          questionId: 'f1',
          files: [{ url: upload(1, 'jpg') }, { url: upload(1, 'jpg') }],
        },
      ]),
    ).toThrow('двічі');
  });

  it('asks for a file on a required question and skips an optional one', () => {
    expect(() => check([])).toThrow('Додайте файл: Фото костюма');
    expect(() => check([{ questionId: 'f1', files: [] }])).toThrow(
      'Додайте файл',
    );
    expect(
      check([{ questionId: 'f1', files: [{ url: upload(1, 'jpg') }] }]),
    ).toHaveLength(1);
  });

  it('accepts a Word document or a PDF where both are allowed', () => {
    for (const ext of ['pdf', 'doc', 'docx']) {
      expect(
        check(
          [{ questionId: 'f2', files: [{ url: upload(3, ext), name: 'cv' }] }],
          [docs],
        ),
      ).toHaveLength(1);
    }
  });

  it('ignores text sent to a file question and files sent to a text question', () => {
    expect(() =>
      check([{ questionId: 'f1', value: upload(1, 'jpg') }]),
    ).toThrow('Додайте файл');
    expect(
      validateAnswers(
        [Q.name],
        [
          {
            questionId: 'q1',
            value: 'Neo',
            files: [{ url: upload(1, 'jpg') }],
          },
        ],
        exists,
      ),
    ).toEqual([{ questionId: 'q1', value: 'Neo' }]);
  });

  it('cleans file names for display', () => {
    const [answer] = check([
      {
        questionId: 'f1',
        files: [
          { url: upload(1, 'jpg'), name: ' my\nphoto‮gpj.exe ' },
          { url: upload(2, 'jpg'), name: '' },
        ],
      },
    ]);
    const files = parseFileAnswer(answer.value)!;
    expect(files[0].name).toBe('my photo gpj.exe');
    expect(files[1].name).toBe('Файл 2');
    const [long] = check([
      {
        questionId: 'f1',
        files: [{ url: upload(1, 'jpg'), name: 'x'.repeat(300) }],
      },
    ]);
    expect(parseFileAnswer(long.value)![0].name).toHaveLength(120);
  });

  it('never stores half of a character in a file name', () => {
    const [answer] = check([
      {
        questionId: 'f1',
        files: [
          { url: upload(1, 'jpg'), name: 'фото\ud800.jpg' },
          { url: upload(2, 'jpg'), name: `${'a'.repeat(118)}📎📎📎.jpg` },
        ],
      },
    ]);
    const [broken, cut] = parseFileAnswer(answer.value)!;
    expect(broken.name).toBe('фото .jpg');
    expect(cut.name).toBe(`${'a'.repeat(118)}📎…`);
    expect(answer.value).not.toMatch(/\\ud[89a-f]/i);
  });

  it('refuses a text answer dressed up as attached files', () => {
    const fake = JSON.stringify([{ url: upload(1, 'mp4'), name: 'x.mp4' }]);
    expect(() =>
      validateAnswers([Q.name], [{ questionId: 'q1', value: fake }], exists),
    ).toThrow('неприпустимий формат');
    expect(
      validateAnswers(
        [Q.about],
        [{ questionId: 'q4', value: `Моє відео: ${upload(1, 'mp4')}` }],
        exists,
      ),
    ).toHaveLength(1);
  });
});

describe('parseFileAnswer', () => {
  it('reads only stored file lists', () => {
    expect(parseFileAnswer('[{"url":"/uploads/a.jpg","name":"a"}]')).toEqual([
      { url: '/uploads/a.jpg', name: 'a' },
    ]);
    for (const value of [
      'Так',
      '[]',
      '[1,2]',
      '[{"url":"https://x.y/a.jpg","name":"a"}]',
      '[{"url":"/uploads/a.jpg"}]',
      '[not json',
    ]) {
      expect(parseFileAnswer(value)).toBeNull();
    }
  });
});
