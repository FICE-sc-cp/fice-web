import {
  diffSlots,
  electivePair,
  isElective,
  normalizeGroup,
  parseCsv,
  parseElectives,
  parseStarostas,
  parseStudents,
  parseTeachersCsv,
  teachesGroup,
} from './shari-rules';

describe('normalizeGroup', () => {
  it('fixes spaces, dashes and latin lookalikes', () => {
    expect(normalizeGroup('ІП-61')).toBe('ІП-61');
    expect(normalizeGroup(' іп 61 ')).toBe('ІП-61');
    expect(normalizeGroup('IП–61')).toBe('ІП-61');
    expect(normalizeGroup('ІА-з61МП')).toBe('ІА-з61мп');
    expect(normalizeGroup('ІТ-в61ф')).toBe('ІТ-в61ф');
  });

  it('rejects headers and other faculties', () => {
    expect(normalizeGroup('група')).toBeNull();
    expect(normalizeGroup('КВ-31')).toBeNull();
    expect(normalizeGroup('@ip61')).toBeNull();
  });
});

describe('parseCsv', () => {
  it('handles quoted commas, quotes and line breaks', () => {
    expect(parseCsv('a,"b, c","d ""e""\nf"\r\ng,,')).toEqual([
      ['a', 'b, c', 'd "e"\nf'],
      ['g', '', ''],
    ]);
  });
});

describe('parseTeachersCsv', () => {
  const csv = [
    '\uFEFFВикладач,Дисципліна,Роль,Групи,Telegram,Пошта',
    'Коваленко Петро Іванович,Linux,практик,"ІО-51, ІО-52",https://t.me/petro_k,"a@kpi.ua',
    'b@gmail.com"',
    ',Linux,лабораторні,"ІО-53, ІО-51",,',
    ',Мережі,лектор,ІМ-41,,',
    'Шевченко Марія Олегівна,Англійська мова,практик,ІС-61,,',
  ].join('\n');

  it('merges a teacher block and the roles of one discipline', () => {
    expect(parseTeachersCsv(csv)).toEqual([
      {
        fullName: 'Коваленко Петро Іванович',
        email: 'a@kpi.ua, b@gmail.com',
        telegram: 'https://t.me/petro_k',
        courses: [
          { discipline: 'Linux', groups: ['ІО-51', 'ІО-52', 'ІО-53'] },
          { discipline: 'Мережі', groups: ['ІМ-41'] },
        ],
      },
      {
        fullName: 'Шевченко Марія Олегівна',
        email: null,
        telegram: null,
        courses: [{ discipline: 'Англійська мова', groups: ['ІС-61'] }],
      },
    ]);
  });

  it('refuses a file without the campus columns', () => {
    expect(() => parseTeachersCsv('ПІБ,Пошта\nX,y')).toThrow(/колонками/);
  });
});

describe('pasted rows', () => {
  it('reads starosta tags and removals, skipping junk', () => {
    expect(
      parseStarostas(
        'група\tтелеграм\nІП-61\t@Starosta_IP61\nіп-62 https://t.me/Some_User\nІП-63\nІП-64\tне тег!',
      ),
    ).toEqual({
      starostas: [
        { group: 'ІП-61', telegramTag: '@starosta_ip61' },
        { group: 'ІП-62', telegramTag: '@some_user' },
        { group: 'ІП-63', telegramTag: null },
      ],
      skipped: ['група\tтелеграм', 'ІП-64\tне тег!'],
    });
  });

  it('reads students in any column order', () => {
    const { groups, skipped } = parseStudents(
      '1\tІП-61\tІваненко\tІван\tІванович\nПетренко  Олена\tІП-61\nІП-62 Сидоренко Петро\nІП-63',
    );
    expect(
      Object.fromEntries([...groups].map(([g, n]) => [g, [...n]])),
    ).toEqual({
      'ІП-61': ['Іваненко Іван Іванович', 'Петренко Олена'],
      'ІП-62': ['Сидоренко Петро'],
    });
    expect(skipped).toEqual(['ІП-63']);
  });
});

describe('diffSlots', () => {
  it('keeps unchanged slots, reissues changed ones and frees the rest', () => {
    const current = [
      { id: '1', slot: 0, studentName: 'А' },
      { id: '2', slot: 1, studentName: 'Б' },
      { id: '3', slot: 2, studentName: 'В' },
      { id: '4', slot: 5, studentName: 'Г' },
    ];
    expect(diffSlots(current, ['А', 'Ґ', '', 'Д'])).toEqual({
      remove: ['2', '3', '4'],
      create: [
        { slot: 1, studentName: 'Ґ' },
        { slot: 3, studentName: 'Д' },
      ],
    });
  });
});

describe('teachesGroup', () => {
  it('finds the group in any discipline of the schedule', () => {
    const courses = [
      { discipline: 'Linux', groups: ['ІО-51', 'ІО-52'] },
      { discipline: 'Мережі', groups: ['ІМ-41'] },
    ];
    expect(teachesGroup(courses, 'ІМ-41')).toBe(true);
    expect(teachesGroup(courses, 'ІП-61')).toBe(false);
    expect(teachesGroup([], 'ІП-61')).toBe(false);
  });
});

describe('parseElectives', () => {
  it('keeps autumn choices once and reports bad rows by number only', () => {
    const row = (name: string, group: string, course: string, sem: string) => [
      'ФІОТ',
      name,
      group,
      course,
      sem,
      'Бюджет',
    ];
    const name = 'Ткач Мар`яна  Іванівна';
    expect(
      parseElectives([
        ['Fname', 'Student', 'Group', 'Course', 'Semestr', 'Payment'],
        row(name, 'ІП-41', ' Основи  Linux ', '5'),
        row("Ткач Мар'яна Іванівна", 'іп 41', 'Основи Linux', '5'),
        row(name, 'ІП-41', 'Основи Linux', '6'),
        row(name, 'ІП-41', '', '7'),
        row(name, 'КВ-31', 'Основи Linux', '3'),
        [],
      ]),
    ).toEqual({
      students: [
        {
          discipline: 'Основи Linux',
          group: 'ІП-41',
          fullName: "Ткач Мар'яна Іванівна",
        },
      ],
      skipped: [
        'рядок 5: немає дисципліни',
        'рядок 6: група «КВ-31» не з ФІОТ',
      ],
      otherSemesters: 2,
    });
  });

  it('refuses a sheet without the columns', () => {
    expect(() => parseElectives([['ПІБ', 'Група']])).toThrow(/колонками/);
  });
});

describe('isElective', () => {
  const listed = new Set([
    electivePair('Основи Linux', 'ІП-41'),
    electivePair('Комп’ютерна графіка', 'ІП-41'),
    electivePair('Розробка для пристроїв', 'ІП-41'),
    electivePair('Розробка під iOS', 'ІП-41'),
  ]);
  const course = (discipline: string, ...groups: string[]) => ({
    discipline,
    groups,
  });

  it('needs the name and one of the teacher’s groups', () => {
    expect(isElective(course('Основи  Linux', 'ІП-42', 'ІП-41'), listed)).toBe(
      true,
    );
    // The same name taught only where nobody chose it: an ordinary course.
    expect(isElective(course('Основи Linux', 'ІМ-51мн'), listed)).toBe(false);
  });

  it('evens out apostrophes and composed letters, nothing fuzzy', () => {
    expect(isElective(course("Комп'ютерна графіка", 'ІП-41'), listed)).toBe(
      true,
    );
    expect(isElective(course('Розробка для пристроїв', 'ІП-41'), listed)).toBe(
      true,
    );
    expect(isElective(course('Розробка під Android', 'ІП-41'), listed)).toBe(
      false,
    );
  });
});
