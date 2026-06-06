export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Wraps a page of results with its pagination metadata. */
export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): Paginated<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

/** Prisma `skip` value for the given page/limit. */
export function skipFor(page: number, limit: number): number {
  return (page - 1) * limit;
}
