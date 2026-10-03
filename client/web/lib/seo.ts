import type { Metadata } from 'next';

export const SITE_URL = 'https://fice-sc.kpi.ua';

export const SITE_NAME = 'Студентська рада ФІОТ';

export const SITE_SHORT_NAME = 'Студрада ФІОТ';

export const SITE_TITLE = 'Студентська рада ФІОТ — КПІ ім. Ігоря Сікорського';

export const SITE_DESCRIPTION =
  'Офіційний сайт Студентської ради ФІОТ КПІ ім. Ігоря Сікорського: новини факультету, заходи, благодійні збори, департаменти та вступ до команди Студради.';

const ALTERNATE_NAMES = [SITE_SHORT_NAME, 'СР ФІОТ', 'Student Council FICE', 'fice-sc.kpi.ua'];

const SOCIAL_PROFILES = [
  'https://t.me/fice_time',
  'https://www.instagram.com/sr_fiot',
  'https://www.tiktok.com/@sr_fiot',
  'https://www.youtube.com/@studentcouncilfice',
  'https://www.twitch.tv/studentcouncilfice',
  'https://www.linkedin.com/company/fice-student-council/',
];

const OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: SITE_TITLE,
};

export const OPEN_GRAPH = {
  type: 'website',
  locale: 'uk_UA',
  siteName: SITE_NAME,
  url: './',
  images: [OG_IMAGE],
} satisfies Metadata['openGraph'];

export const NOINDEX = { index: false, follow: false } satisfies Metadata['robots'];

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

export function openGraph(path: string, image?: string | null): Metadata['openGraph'] {
  return { ...OPEN_GRAPH, url: path, images: image ? [image] : OPEN_GRAPH.images };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntity(entity: string, code: string): string {
  if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  const point = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
  return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
}

export function plainText(text: string | null | undefined, max = 160): string {
  if (!text) return '';
  const plain = text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max + 1).replace(/\s+\S*$/, '').replace(/[\s,;:—–-]+$/, '')}…`;
}

export const SITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      alternateName: ALTERNATE_NAMES,
      inLanguage: 'uk',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      alternateName: ALTERNATE_NAMES,
      description:
        'Орган студентського самоврядування факультету інформатики та обчислювальної техніки КПІ ім. Ігоря Сікорського.',
      logo: `${SITE_URL}/icon.png`,
      email: 'fiot.studrada@lll.kpi.ua',
      sameAs: SOCIAL_PROFILES,
      parentOrganization: {
        '@type': 'CollegeOrUniversity',
        name: 'КПІ ім. Ігоря Сікорського',
        url: 'https://kpi.ua/',
      },
    },
  ],
};

export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
