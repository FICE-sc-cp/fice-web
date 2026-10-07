export const KPI_FACULTIES: Record<string, string> = {
  ФІОТ: 'Факультет інформатики та обчислювальної техніки',
  ФПМ: 'Факультет прикладної математики',
  ННІПСА: 'ННІ прикладного системного аналізу',
  ФЛ: 'Факультет лінгвістики',
  ІХФ: 'Інженерно-хімічний факультет',
  ННІАТ: 'ННІ аерокосмічних технологій',
  ФБТ: 'Факультет біотехнології і біотехніки',
  ННВПІ: 'Видавничо-поліграфічний інститут',
  ННІЕЕ: 'ННІ енергозбереження та енергоменеджменту',
  ФЕЛ: 'Факультет електроніки',
  ФЕА: 'Факультет електроенерготехніки та автоматики',
  ФБМІ: 'Факультет біомедичної інженерії',
  ННММІ: 'Механіко-машинобудівний інститут',
  ННІМЗ: 'ННІ матеріалознавства та зварювання ім. Є.О. Патона',
  ФМФ: 'Фізико-математичний факультет',
  ПБФ: 'Приладобудівний факультет',
  РТФ: 'Радіотехнічний факультет',
  ФСП: 'Факультет соціології і права',
  ННІАТЕ: 'ННІ атомної та теплової енергетики',
  ФММ: 'Факультет менеджменту та маркетингу',
  ННФТІ: 'Фізико-технічний інститут',
  ХТФ: 'Хіміко-технологічний факультет',
  ННІТС: 'ННІ телекомунікаційних систем',
};

const LATIN_TO_CYRILLIC: Record<string, string> = {
  A: 'А',
  B: 'В',
  C: 'С',
  E: 'Е',
  H: 'Н',
  I: 'І',
  K: 'К',
  M: 'М',
  O: 'О',
  P: 'Р',
  T: 'Т',
  X: 'Х',
  a: 'а',
  c: 'с',
  e: 'е',
  i: 'і',
  k: 'к',
  o: 'о',
  p: 'р',
  x: 'х',
};

const DASHES = /[‐-―−]/g;

const GROUP_FORMAT =
  /^([А-ЯІЇЄҐ]{2})-(зп|з|п|в|о)?(0[1-9]|[1-9]\d)(мп|мн|ф)?(і|а|д)?$/;

export function normalizeKpiGroup(raw: string): string {
  if (!raw) return '';
  const compact = raw
    .replace(/\s+/g, '')
    .replace(DASHES, '-')
    .split('')
    .map((ch) => LATIN_TO_CYRILLIC[ch] ?? ch)
    .join('');
  const prefix = compact.slice(0, 2).toUpperCase();
  const rest = compact.slice(2).replace(/^-/, '').toLowerCase();
  return rest ? `${prefix}-${rest}` : prefix;
}

export interface KpiGroupParseResult {
  valid: boolean;
  normalized: string;
  faculty?: string;
  facultyName?: string;
  error?: string;
}

export function parseKpiGroup(input: string): KpiGroupParseResult {
  const normalized = normalizeKpiGroup(input);
  if (!normalized) {
    return { valid: false, normalized: '', error: 'Вкажи шифр академічної групи' };
  }

  const match = normalized.match(GROUP_FORMAT);
  if (!match) {
    return {
      valid: false,
      normalized,
      error: 'Невірний формат групи. Приклади: ІП-51, ІП-о51, ІП-51мп',
    };
  }

  const prefix = match[1]; // e.g. ІП, КВ, ЛА, ФБ
  const firstLetter = prefix[0];

  let faculty: string | undefined;

  if (firstLetter === 'І') {
    faculty = 'ФІОТ';
  } else if (firstLetter === 'К') {
    if (['КВ', 'КМ', 'КП'].includes(prefix)) {
      faculty = 'ФПМ';
    } else {
      faculty = 'ННІПСА';
    }
  } else if (firstLetter === 'Л') {
    if (['ЛА', 'ЛН', 'ЛФ', 'ЛО'].includes(prefix)) {
      faculty = 'ФЛ';
    } else {
      faculty = 'ІХФ';
    }
  } else {
    const map: Record<string, string> = {
      А: 'ННІАТ',
      Б: 'ФБТ',
      В: 'ННВПІ',
      Г: 'ННІЕЕ',
      Д: 'ФЕЛ',
      Е: 'ФЕА',
      З: 'ФБМІ',
      М: 'ННММІ',
      Н: 'ННІМЗ',
      О: 'ФМФ',
      П: 'ПБФ',
      Р: 'РТФ',
      С: 'ФСП',
      Т: 'ННІАТЕ',
      У: 'ФММ',
      Ф: 'ННФТІ',
      Х: 'ХТФ',
      Ц: 'ННІТС',
    };
    faculty = map[firstLetter];
  }

  if (!faculty) {
    return {
      valid: false,
      normalized,
      error: `Невідомий шифр факультету для групи ${normalized}`,
    };
  }

  return {
    valid: true,
    normalized,
    faculty,
    facultyName: KPI_FACULTIES[faculty] ?? faculty,
  };
}
