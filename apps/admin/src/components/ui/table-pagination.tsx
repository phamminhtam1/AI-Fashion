import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  itemName?: string;
  className?: string;
  compact?: boolean;
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  itemName = "mục",
  className,
  compact = false,
}: TablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    if (safeTotalPages <= 5) {
      return Array.from({ length: safeTotalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [];

    // Always include page 1
    pages.push(1);

    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(safeTotalPages - 1, safeCurrentPage + 1);

    if (start > 2) {
      pages.push("ellipsis");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < safeTotalPages - 1) {
      pages.push("ellipsis");
    }

    // Always include last page
    pages.push(safeTotalPages);

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 bg-card/30 text-xs",
        className
      )}
    >
      {/* Left: Summary Count */}
      <div className="flex items-center gap-2 text-muted-foreground font-mono">
        <span>
          {totalItems === 0
            ? `0 ${itemName}`
            : `Hiển thị ${startItem}–${endItem} / ${totalItems} ${itemName}`}
        </span>
      </div>

      {/* Right: Controls & Navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Page Size Selector */}
        {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 0 && (
          <div className="flex items-center gap-1.5 mr-1">
            <span className="text-[11px] text-muted-foreground">Hiển thị:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded border border-border bg-background px-2 py-0 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / trang
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Buttons */}
        {safeTotalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* First Page (only in full mode) */}
            {!compact && (
              <Button
                variant="outline"
                size="icon"
                disabled={safeCurrentPage <= 1}
                onClick={() => onPageChange(1)}
                className="size-7 text-xs"
                title="Trang đầu"
              >
                <ChevronsLeft className="size-3.5" />
              </Button>
            )}

            {/* Previous Page */}
            <Button
              variant="outline"
              size={compact ? "sm" : "icon"}
              disabled={safeCurrentPage <= 1}
              onClick={() => onPageChange(safeCurrentPage - 1)}
              className={cn("h-7 text-xs", compact ? "px-2 gap-1" : "size-7")}
              title="Trang trước"
            >
              <ChevronLeft className="size-3.5" />
              {compact && <span>Trước</span>}
            </Button>

            {/* Page indicator or Numbers */}
            {compact ? (
              <span className="px-2 text-xs font-mono text-muted-foreground whitespace-nowrap">
                {safeCurrentPage} / {safeTotalPages}
              </span>
            ) : (
              <div className="flex items-center gap-1">
                {pageNumbers.map((p, idx) =>
                  p === "ellipsis" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="size-7 flex items-center justify-center text-muted-foreground text-xs"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onPageChange(p)}
                      className={cn(
                        "size-7 rounded font-mono text-xs transition-colors flex items-center justify-center",
                        p === safeCurrentPage
                          ? "bg-foreground text-background font-bold shadow-xs"
                          : "border border-border bg-background text-foreground hover:bg-secondary"
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>
            )}

            {/* Next Page */}
            <Button
              variant="outline"
              size={compact ? "sm" : "icon"}
              disabled={safeCurrentPage >= safeTotalPages}
              onClick={() => onPageChange(safeCurrentPage + 1)}
              className={cn("h-7 text-xs", compact ? "px-2 gap-1" : "size-7")}
              title="Trang sau"
            >
              {compact && <span>Sau</span>}
              <ChevronRight className="size-3.5" />
            </Button>

            {/* Last Page (only in full mode) */}
            {!compact && (
              <Button
                variant="outline"
                size="icon"
                disabled={safeCurrentPage >= safeTotalPages}
                onClick={() => onPageChange(safeTotalPages)}
                className="size-7 text-xs"
                title="Trang cuối"
              >
                <ChevronsRight className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
