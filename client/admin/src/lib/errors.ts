export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(status: number, details: string[], message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Назва',
  title: 'Заголовок',
  description: 'Опис',
  story: 'Текст',
  details: 'Деталі',
  imageUrl: 'Зображення',
  image: 'Зображення',
  logoImage: 'Логотип',
  photo: 'Фото',
  photoUrl: 'Фото',
  location: 'Локація',
  goalAmount: 'Мета збору',
  currentAmount: 'Зібрано',
  donationsCount: 'Кількість донатів',
  cardNumber: 'Номер картки',
  jarUrl: 'Посилання на банку',
  monoJarId: 'ID банки monobank',
  startDate: 'Дата початку',
  endDate: 'Дата завершення',
  date: 'Дата',
  publishDate: 'Дата публікації',
  eventDate: 'Дата заходу',
  eventLocation: 'Локація заходу',
  registrationLink: 'Посилання на реєстрацію',
  detailsLink: 'Посилання на деталі',
  websiteLink: 'Вебсайт',
  telegramTag: 'Telegram-тег',
  telegramChatId: 'Telegram chat ID',
  firstName: 'Імʼя',
  lastName: 'Прізвище',
  middleName: 'По батькові',
  specialization: 'Спеціалізація',
  group: 'Група',
  phoneNumber: 'Номер телефону',
  category: 'Категорія',
  status: 'Статус',
  shortDescription: 'Короткий опис',
  jobDescription: 'Посада',
  value: 'Значення',
};

const RULES: { test: RegExp; text: (m: RegExpMatchArray) => string }[] = [
  { test: /should not be empty/i, text: () => 'обовʼязкове поле' },
  {
    test: /must be shorter than or equal to (\d+) characters/i,
    text: (m) => `занадто довге значення (максимум ${m[1]})`,
  },
  {
    test: /must be longer than or equal to (\d+) characters/i,
    text: (m) => `занадто коротке значення (мінімум ${m[1]})`,
  },
  { test: /must be a URL address/i, text: () => 'має бути коректним посиланням' },
  { test: /must be an email/i, text: () => 'має бути коректною поштою' },
  { test: /must be a valid enum value/i, text: () => 'недопустиме значення' },
  { test: /must be a number|must be an integer/i, text: () => 'має бути числом' },
  { test: /must be a Date|must be a valid ISO/i, text: () => 'некоректна дата' },
  { test: /must be a string/i, text: () => 'має бути текстом' },
  { test: /must be a boolean/i, text: () => 'має бути так/ні' },
  { test: /must be a UUID/i, text: () => 'некоректний ідентифікатор' },
  {
    test: /must not be less than (\d+)/i,
    text: (m) => `не може бути менше ${m[1]}`,
  },
  {
    test: /must not be greater than (\d+)/i,
    text: (m) => `не може бути більше ${m[1]}`,
  },
  { test: /property .* should not exist/i, text: () => 'недопустиме поле' },
];

export function describeDetail(detail: string): {
  field: string;
  message: string;
} {
  const field = detail.trim().split(/\s+/)[0];
  for (const rule of RULES) {
    const match = detail.match(rule.test);
    if (match) {
      const text = rule.text(match);
      return { field, message: text.charAt(0).toUpperCase() + text.slice(1) };
    }
  }
  return { field, message: detail };
}

export function translateDetail(detail: string): string {
  const { field, message } = describeDetail(detail);
  const label = FIELD_LABELS[field];
  return label ? `${label}: ${message.toLowerCase()}` : message;
}

const BY_STATUS: Record<number, string> = {
  400: 'Перевірте правильність заповнених полів.',
  401: 'Немає доступу. Відкрий адмінку через Telegram-бот.',
  403: 'Недостатньо прав для цієї дії.',
  404: 'Запис не знайдено. Можливо, його вже видалено.',
  409: 'Конфлікт даних. Онови сторінку та спробуй ще раз.',
  413: 'Файл завеликий. Максимум 5 МБ.',
  429: 'Забагато запитів. Зачекай хвилину та спробуй ще раз.',
};

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.details.length > 0) {
      return error.details.map(translateDetail).join('\n');
    }
    if (BY_STATUS[error.status]) return BY_STATUS[error.status];
    if (error.status >= 500) return 'Помилка сервера. Спробуй пізніше.';
    if (error.status === 0) {
      return 'Немає звʼязку із сервером. Перевір інтернет і спробуй ще раз.';
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Сталася помилка. Спробуй ще раз.';
}

export function errorList(error: unknown): string[] {
  if (error instanceof ApiError && error.details.length > 0) {
    return error.details.map(translateDetail);
  }
  return [errorText(error)];
}
