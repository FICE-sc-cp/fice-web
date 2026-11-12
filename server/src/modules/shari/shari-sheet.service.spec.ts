import { REMOVED, teacherLinksTable } from './shari-sheet.service';

const url = 'https://example.org';

describe('teacherLinksTable', () => {
  it('lists teachers by name with their links on an empty sheet', () => {
    expect(
      teacherLinksTable(
        [
          { fullName: 'Петренко Ольга', token: 'b' },
          { fullName: 'Андрієнко Іван', token: 'a' },
        ],
        url,
      ),
    ).toEqual([
      ['ПІБ', 'Особисте посилання'],
      ['Андрієнко Іван', 'https://example.org/shari/t/a'],
      ['Петренко Ольга', 'https://example.org/shari/t/b'],
    ]);
  });

  it('never moves a teacher, so notes in the next columns stay with them', () => {
    const sheet = [
      ['ПІБ', 'Особисте посилання'],
      ['Петренко Ольга', 'https://example.org/shari/t/old'],
      [],
      ['Андрієнко Іван', 'https://example.org/shari/t/a'],
      ['Видалений Тест', 'https://example.org/shari/t/x'],
    ];
    expect(
      teacherLinksTable(
        [
          { fullName: 'Андрієнко Іван', token: 'a' },
          { fullName: 'Петренко Ольга', token: 'new' },
          { fullName: 'Ярошенко Дарина', token: 'y' },
          { fullName: 'Бондар Олег', token: 'o' },
        ],
        url,
        sheet,
      ),
    ).toEqual([
      ['ПІБ', 'Особисте посилання'],
      ['Петренко Ольга', 'https://example.org/shari/t/new'],
      ['', ''],
      ['Андрієнко Іван', 'https://example.org/shari/t/a'],
      ['Видалений Тест', REMOVED],
      ['Бондар Олег', 'https://example.org/shari/t/o'],
      ['Ярошенко Дарина', 'https://example.org/shari/t/y'],
    ]);
  });
});
