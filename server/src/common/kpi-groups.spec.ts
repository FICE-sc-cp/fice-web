import { normalizeKpiGroup, parseKpiGroup } from './kpi-groups';

describe('parseKpiGroup', () => {
  it.each([
    'ІП-51',
    'ІП-о51',
    'ІП-з51',
    'ІП-п51',
    'ІП-зп51',
    'ІП-в51',
    'ІП-51мп',
    'ІП-51мн',
    'ІП-51ф',
    'ІП-51і',
    'ІП-51а',
    'ІП-51д',
    'ІП-о51мп',
    'ІП-зп51мпі',
  ])('accepts %s as a ФІОТ group', (group) => {
    expect(parseKpiGroup(group)).toMatchObject({
      valid: true,
      normalized: group,
      faculty: 'ФІОТ',
    });
  });

  it.each([
    [' іп - О51 ', 'ІП-о51'],
    ['ІП–о51', 'ІП-о51'],
    ['ІПо51', 'ІП-о51'],
    ['IП-o51', 'ІП-о51'],
    ['ІП-О51', 'ІП-о51'],
    ['ІП-51МП', 'ІП-51мп'],
  ])('cleans up %j to %s', (input, expected) => {
    expect(normalizeKpiGroup(input)).toBe(expected);
    expect(parseKpiGroup(input)).toMatchObject({
      valid: true,
      normalized: expected,
    });
  });

  it.each([
    'ІП-00',
    'ІП-5',
    'ІП-515',
    'ІП-х51',
    'ІП-51мх',
    'ІП-51ік',
    'ІП51-о',
    'Іван Петренко',
  ])('rejects %s with an example of the right format', (group) => {
    expect(parseKpiGroup(group)).toMatchObject({
      valid: false,
      error: 'Невірний формат групи. Приклади: ІП-51, ІП-о51, ІП-51мп',
    });
  });

  it('asks for a group when the field is empty', () => {
    expect(parseKpiGroup('   ')).toMatchObject({
      valid: false,
      error: 'Вкажи шифр академічної групи',
    });
  });

  it.each([
    ['КВ-51', 'ФПМ'],
    ['КА-о51', 'ННІПСА'],
    ['ЛА-51', 'ФЛ'],
    ['ЛХ-51мн', 'ІХФ'],
    ['ТВ-з51', 'ННІАТЕ'],
  ])('detects the faculty of %s as %s', (group, faculty) => {
    expect(parseKpiGroup(group)).toMatchObject({ valid: true, faculty });
  });

  it('rejects a first letter that belongs to no faculty', () => {
    expect(parseKpiGroup('ЯА-51')).toMatchObject({
      valid: false,
      error: 'Невідомий шифр факультету для групи ЯА-51',
    });
  });

  it('keeps the longest possible group within the 10-character column', () => {
    expect(parseKpiGroup('ІП-зп51мпі').normalized).toHaveLength(10);
  });
});
