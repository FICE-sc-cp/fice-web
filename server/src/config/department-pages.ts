export const DEPARTMENT_PAGES = [
  { slug: 'projects', name: 'Проєктний департамент', shortName: 'Проєктний' },
  { slug: 'media', name: 'Департамент медіа', shortName: 'Медіа' },
  {
    slug: 'partnerships',
    name: 'Департамент партнерств',
    shortName: 'Партнерства',
  },
  { slug: 'merch', name: 'Департамент мерчу', shortName: 'Мерч' },
  {
    slug: 'education',
    name: 'Департамент якості освіти',
    shortName: 'Якість освіти',
  },
  {
    slug: 'applicants',
    name: 'Департамент по роботі з абітурієнтами',
    shortName: 'Абітурієнти',
  },
] as const;

export type DepartmentSlug = (typeof DEPARTMENT_PAGES)[number]['slug'];

export const DEPARTMENT_SLUGS: readonly string[] = DEPARTMENT_PAGES.map(
  (p) => p.slug,
);
