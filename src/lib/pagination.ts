/* ═══════════════════════════════════════════════════════════════
   Shared pagination helper for API routes
   ═══════════════════════════════════════════════════════════════
   Provides consistent offset-based pagination across all list endpoints.

   Usage:
     import { parsePagination, paginatedResponse } from "@/lib/pagination";

     const { take, skip } = parsePagination(req);
     const [items, total] = await Promise.all([
       prisma.model.findMany({ where, take, skip, orderBy }),
       prisma.model.count({ where }),
     ]);
     return paginatedResponse(items, total, take, skip);
   ═══════════════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";

/** Default and maximum page sizes */
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Parse pagination query params from a request URL.
 *
 * Supports:
 *   ?limit=50&offset=0   (offset-based)
 *   ?page=1&pageSize=50  (page-based, converted to offset)
 *
 * Returns `{ take, skip }` for Prisma queries.
 */
export function parsePagination(req: Request): { take: number; skip: number } {
  const { searchParams } = new URL(req.url);

  // Support both limit/offset and page/pageSize params
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");

  let take = DEFAULT_PAGE_SIZE;
  let skip = 0;

  if (limitParam) {
    take = Math.min(
      Math.max(parseInt(limitParam, 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );
  } else if (pageSizeParam) {
    take = Math.min(
      Math.max(parseInt(pageSizeParam, 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );
  }

  if (offsetParam) {
    skip = Math.max(parseInt(offsetParam, 10) || 0, 0);
  } else if (pageParam) {
    const page = Math.max(parseInt(pageParam, 10) || 1, 1);
    skip = (page - 1) * take;
  }

  return { take, skip };
}

/**
 * Build a standardised paginated JSON response.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  take: number,
  skip: number,
): NextResponse {
  return NextResponse.json({
    data,
    pagination: {
      total,
      limit: take,
      offset: skip,
      hasMore: skip + take < total,
    },
  });
}
