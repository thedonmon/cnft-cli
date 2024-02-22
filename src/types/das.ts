export type Nullable<T> = T | null;

/**
 * Pagination params copied from non exported types in umi das plugin.
 * SortBy has a specific type as well for sortby options but wont copy over for breaking changes in case.
 * Only used to help type the autopaginate function better.
 */
export type Pagination = {
  sortBy?: Nullable<any>;
  limit?: Nullable<number>;
  page?: Nullable<number>;
  before?: Nullable<string>;
  after?: Nullable<string>;
};

export async function fetchWithAutoPagination<T, R>(
  fetchFunction: (params: T & Pagination) => Promise<{ items: R[] }>,
  params: T,
  paginate: boolean,
  pageLimit: number = 1000,
): Promise<{ items: R[] }> {
  let allItems: R[] = [];
  let page = 1;
  let hasMore = true;
  let response: { items: R[] } = { items: [] };

  while (paginate && hasMore) {
    const modifiedParams = { ...params, page: page, limit: pageLimit } as T;
    response = await fetchFunction(modifiedParams);

    allItems = [...allItems, ...response.items];
    hasMore = response.items.length === pageLimit;
    page++;
  }

  return { items: allItems };
}
