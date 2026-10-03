import type { MetadataRoute } from 'next';
import { fice, safe, type Paginated } from '@/lib/api';
import { departmentSlugs } from '@/lib/departments';
import { absoluteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

const STATIC_PATHS = [
  '/',
  '/news',
  '/events',
  '/charity',
  '/team',
  '/join',
  '/partners/join',
  ...departmentSlugs.map((slug) => `/departments/${slug}`),
  '/departments/applicants',
];

async function loadAll<T>(load: (page: number) => Promise<Paginated<T>>): Promise<T[]> {
  const first = await safe(load(1), null);
  if (!first) return [];
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => safe(load(i + 2), null)),
  );
  return [first, ...rest].flatMap((page) => page?.items ?? []);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, events, fundraisers] = await Promise.all([
    loadAll((page) => fice.news(PAGE_SIZE, page)),
    loadAll((page) => fice.events(PAGE_SIZE, page)),
    loadAll((page) => fice.fundraisers(PAGE_SIZE, page)),
  ]);

  return [
    ...STATIC_PATHS.map((path) => ({ url: absoluteUrl(path) })),
    ...news.map((item) => ({
      url: absoluteUrl(`/news/${item.id}`),
      lastModified: item.publishDate,
    })),
    ...events.map((event) => ({ url: absoluteUrl(`/events/${event.id}`) })),
    ...fundraisers.map((fundraiser) => ({ url: absoluteUrl(`/charity/${fundraiser.id}`) })),
  ];
}
