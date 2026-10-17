import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
};

/** "Showing x to y of n entries" and previous / next, under each Pravasi Vayana table. */
function TablePager({ page, pageSize, total, loading, onPageChange }: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-6 flex flex-col items-center gap-4 px-1 sm:flex-row sm:justify-between">
      <p className="text-[12px] text-[#555]">
        Showing {from} to {to} of {total} entries
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="grid size-7 place-items-center rounded border border-[#ddd] text-[#333] disabled:opacity-50"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[12px] text-[#555]">Page {page}</span>
        <button
          type="button"
          disabled={loading || to >= total}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="grid size-7 place-items-center rounded border border-[#ddd] text-[#333] disabled:opacity-50"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export default TablePager;
