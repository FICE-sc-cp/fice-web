import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DEPARTMENT_PAGES, DEPARTMENT_SLUGS } from './department-pages';

const WEB_DEPARTMENTS = resolve(
  __dirname,
  '../../../client/web/lib/departments.ts',
);

describe('DEPARTMENT_PAGES', () => {
  it('lists every department page of the website except the presidium', () => {
    const source = readFileSync(WEB_DEPARTMENTS, 'utf8');
    const table = source.slice(
      source.indexOf('export const DEPARTMENTS'),
      source.indexOf('export const APPLICANTS_DEPARTMENT'),
    );
    const slugs = [
      ...table.matchAll(/^ {4}slug: "([^"]+)"/gm),
    ].map((m) => m[1]);
    const applicants = /APPLICANTS_DEPARTMENT = dept\(\{\s*slug: "([^"]+)"/.exec(
      source,
    )?.[1];

    expect(slugs).toContain('presidium');
    expect([...DEPARTMENT_SLUGS].sort()).toEqual(
      [...slugs.filter((s) => s !== 'presidium'), applicants].sort(),
    );
  });

  it('fits the Department columns', () => {
    for (const page of DEPARTMENT_PAGES) {
      expect(page.slug.length).toBeLessThanOrEqual(32);
      expect(page.name.length).toBeLessThanOrEqual(50);
      expect(page.shortName.length).toBeLessThanOrEqual(50);
    }
  });

  it('has unique slugs', () => {
    expect(new Set(DEPARTMENT_SLUGS).size).toBe(DEPARTMENT_SLUGS.length);
  });
});
