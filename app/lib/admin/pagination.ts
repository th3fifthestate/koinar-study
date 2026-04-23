// app/lib/admin/pagination.ts

/**
 * Shared pagination parsing and response shaping for admin list endpoints.
 * Eliminates copy-paste across admin routes.
 */

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Parse and clamp pagination params from a URL search params object.
 * Defaults: page=1, pageSize=50, max pageSize=100.
 */
export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

/**
 * Build a standard paginated response object.
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
