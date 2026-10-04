import { DEPARTMENT_PAGES } from './department-pages';
import { DepartmentSeedStore, seedDepartments } from './department-seed';

interface Row {
  id: string;
  name: string;
  slug: string | null;
  shortName: string | null;
}

function memoryStore(rows: Row[]): DepartmentSeedStore & { rows: Row[] } {
  let next = rows.length;
  return {
    rows,
    findBySlug: (slug) =>
      Promise.resolve(rows.find((r) => r.slug === slug) ?? null),
    findUnlinkedByName: (name) =>
      Promise.resolve(
        rows.find(
          (r) => r.slug === null && r.name.toLowerCase() === name.toLowerCase(),
        ) ?? null,
      ),
    link: (id, data) => {
      Object.assign(
        rows.find((r) => r.id === id)!,
        data,
      );
      return Promise.resolve();
    },
    create: (data) => {
      rows.push({ id: `new-${next++}`, ...data });
      return Promise.resolve();
    },
  };
}

describe('seedDepartments', () => {
  it('creates every department page on an empty database and no presidium', async () => {
    const store = memoryStore([]);
    const results = await seedDepartments(store);

    expect(results.every((r) => r.action === 'created')).toBe(true);
    expect(store.rows.map((r) => r.slug)).toEqual(
      DEPARTMENT_PAGES.map((p) => p.slug),
    );
    expect(store.rows.some((r) => r.name === 'Президія')).toBe(false);
  });

  it('does nothing on a second run', async () => {
    const store = memoryStore([]);
    await seedDepartments(store);
    const results = await seedDepartments(store);

    expect(results.every((r) => r.action === 'exists')).toBe(true);
    expect(store.rows).toHaveLength(DEPARTMENT_PAGES.length);
  });

  it('never recreates a department that was renamed after it got its slug', async () => {
    const store = memoryStore([
      { id: 'a', name: 'Мерч', slug: 'merch', shortName: 'Мерч' },
    ]);
    await seedDepartments(store);

    expect(store.rows.filter((r) => r.slug === 'merch')).toHaveLength(1);
    expect(store.rows.some((r) => r.name === 'Департамент мерчу')).toBe(false);
  });

  it('links an existing department with the page name instead of creating a copy', async () => {
    const store = memoryStore([
      { id: 'a', name: 'Департамент медіа', slug: null, shortName: null },
      { id: 'b', name: 'Департамент мерчу', slug: null, shortName: 'Свій' },
    ]);
    const results = await seedDepartments(store);

    expect(results.find((r) => r.slug === 'media')?.action).toBe('linked');
    expect(store.rows[0]).toMatchObject({ slug: 'media', shortName: 'Медіа' });
    expect(store.rows[1]).toMatchObject({ slug: 'merch', shortName: 'Свій' });
    expect(store.rows).toHaveLength(DEPARTMENT_PAGES.length);
  });
});
