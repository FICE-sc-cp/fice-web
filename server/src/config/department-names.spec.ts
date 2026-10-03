import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DEPARTMENT_NAMES } from './department-names';

const WEB_DEPARTMENTS = resolve(
  __dirname,
  '../../../client/web/lib/departments.ts',
);

describe('DEPARTMENT_NAMES', () => {
  it('matches the names the website looks departments up by', () => {
    const source = readFileSync(WEB_DEPARTMENTS, 'utf8');
    const table = source.slice(
      source.indexOf('export const DEPARTMENTS'),
      source.indexOf('export const APPLICANTS_DEPARTMENT'),
    );
    const names = [
      ...table.matchAll(/^ {2}[\w-]+: dept\(\{[\s\S]*?^ {4}name: "([^"]+)"/gm),
    ].map((m) => m[1]);
    const applicants = /APPLICANTS_DB_NAME = "([^"]+)"/.exec(source)?.[1];

    expect(names.length).toBeGreaterThan(0);
    expect([...DEPARTMENT_NAMES]).toEqual([...names, applicants]);
  });

  it('fits the Department.name column', () => {
    for (const name of DEPARTMENT_NAMES) {
      expect(name.length).toBeLessThanOrEqual(50);
    }
  });
});
