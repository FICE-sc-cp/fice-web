import { teacherLinksTable } from './shari-sheet.service';

describe('teacherLinksTable', () => {
  it('lists teachers by name with their links', () => {
    expect(
      teacherLinksTable(
        [
          { fullName: 'Петренко Ольга', token: 'b' },
          { fullName: 'Андрієнко Іван', token: 'a' },
        ],
        'https://example.org',
      ),
    ).toEqual([
      ['ПІБ', 'Особисте посилання'],
      ['Андрієнко Іван', 'https://example.org/shari/t/a'],
      ['Петренко Ольга', 'https://example.org/shari/t/b'],
    ]);
  });
});
