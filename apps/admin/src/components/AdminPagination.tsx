import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminPaginationProps = {
  count: number;
  page: number;
  pageSize: number;
  noun: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function AdminPagination({
  count,
  page,
  pageSize,
  noun,
  onPageChange,
  onPageSizeChange,
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const startItem = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, count);

  const getPageNumbers = (): Array<number | "ellipsis"> => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "ellipsis", totalPages];
    if (page >= totalPages - 3) {
      return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
  };

  const iconButtonClass = "size-8 rounded-xs border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40";

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200/80 pt-4 sm:flex-row p-2">
      <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 sm:justify-start">
        <span className="text-sm font-medium text-slate-600">
          {count === 0
            ? `0 ${noun}`
            : `Hiển thị ${startItem.toLocaleString("vi-VN")}–${endItem.toLocaleString("vi-VN")} trên tổng ${count.toLocaleString("vi-VN")} ${noun}`}
        </span>
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span>Mỗi trang:</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 cursor-pointer rounded-xs border border-slate-200 bg-white px-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6941c6]"
          >
            {[10, 20, 30, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      <nav aria-label="Phân trang" className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Trang đầu"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          className={iconButtonClass}
        >
          <ChevronsLeft className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className={iconButtonClass}
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        {getPageNumbers().map((number, index) => number === "ellipsis" ? (
          <span key={`ellipsis-${index}`} aria-hidden="true" className="flex size-8 items-center justify-center text-sm text-slate-400">
            …
          </span>
        ) : (
          <button
            key={number}
            type="button"
            aria-label={`Trang ${number}`}
            aria-current={page === number ? "page" : undefined}
            onClick={() => onPageChange(number)}
            className={page === number
              ? "flex size-8 items-center justify-center rounded-xs bg-[#6941c6] text-sm font-semibold tabular-nums text-white"
              : "flex size-8 items-center justify-center rounded-xs border border-slate-200 bg-white text-sm font-medium tabular-nums text-slate-700 transition-colors hover:bg-slate-100"}
          >
            {number}
          </button>
        ))}

        <Button
          variant="outline"
          size="icon"
          aria-label="Trang sau"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className={iconButtonClass}
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Trang cuối"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className={iconButtonClass}
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </nav>
    </div>
  );
}
