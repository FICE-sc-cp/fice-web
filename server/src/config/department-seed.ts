import { DEPARTMENT_PAGES } from './department-pages';

export interface DepartmentSeedStore {
  findBySlug(slug: string): Promise<{ id: string } | null>;
  findUnlinkedByName(
    name: string,
  ): Promise<{ id: string; shortName: string | null } | null>;
  link(id: string, data: { slug: string; shortName?: string }): Promise<void>;
  create(data: { slug: string; name: string; shortName: string }): Promise<void>;
}

export type DepartmentSeedAction = 'exists' | 'linked' | 'created';

export async function seedDepartments(
  store: DepartmentSeedStore,
): Promise<{ slug: string; name: string; action: DepartmentSeedAction }[]> {
  const results: { slug: string; name: string; action: DepartmentSeedAction }[] =
    [];
  for (const page of DEPARTMENT_PAGES) {
    if (await store.findBySlug(page.slug)) {
      results.push({ slug: page.slug, name: page.name, action: 'exists' });
      continue;
    }
    const unlinked = await store.findUnlinkedByName(page.name);
    if (unlinked) {
      await store.link(unlinked.id, {
        slug: page.slug,
        ...(unlinked.shortName ? {} : { shortName: page.shortName }),
      });
      results.push({ slug: page.slug, name: page.name, action: 'linked' });
      continue;
    }
    await store.create({
      slug: page.slug,
      name: page.name,
      shortName: page.shortName,
    });
    results.push({ slug: page.slug, name: page.name, action: 'created' });
  }
  return results;
}
