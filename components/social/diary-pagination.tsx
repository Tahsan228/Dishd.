import Link from "next/link";

export function DiaryPagination({ page, hasMore, path }: { page: number; hasMore: boolean; path: string }) {
  if (page === 1 && !hasMore) return null;
  return <nav aria-label="Diary pages" className="flex items-center justify-between gap-3 pt-4 text-sm">
    {page > 1 ? <Link className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 font-medium text-forest hover:bg-forest-soft" href={`${path}?page=${page - 1}`}>Newer entries</Link> : <span />}
    <span className="tabular text-xs text-ink-muted">Page {page}</span>
    {hasMore ? <Link className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 font-medium text-forest hover:bg-forest-soft" href={`${path}?page=${page + 1}`}>Older entries</Link> : <span />}
  </nav>;
}
