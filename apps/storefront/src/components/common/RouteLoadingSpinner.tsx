import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

export function RouteLoadingSpinner() {
  const isNavigating = useRouterState({
    select: (s) =>
      s.isLoading ||
      s.status === "pending" ||
      s.location.pathname !== s.resolvedLocation?.pathname ||
      s.location.searchStr !== s.resolvedLocation?.searchStr,
  });

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isNavigating) {
      setVisible(true);
    } else {
      timer = setTimeout(() => {
        setVisible(false);
      }, 150);
    }
    return () => clearTimeout(timer);
  }, [isNavigating]);

  if (!visible) return null;

  return (
    <aside
      role="status"
      aria-label="Đang tải trang..."
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/20 backdrop-blur-[2px] transition-all duration-200 pointer-events-none"
    >
      <div
        role="status"
        aria-live="polite"
        className="flex min-w-[210px] flex-col items-center gap-5 rounded-3xl border border-black/[0.06] bg-white/95 px-9 py-8 shadow-[0_20px_70px_-20px_rgba(0,0,0,0.22)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none dark:border-white/10 dark:bg-[#171717]/95"
      >
        <div
          aria-hidden="true"
          className="relative flex h-14 w-14 items-center justify-center"
        >
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-black/10 border-t-black motion-reduce:animate-none dark:border-white/10 dark:border-t-white" />
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-50 font-serif text-2xl italic text-neutral-950 dark:bg-white/5 dark:text-white">
            É
          </span>
        </div>
        <div className="space-y-2 text-center">
          <p
            aria-hidden="true"
            className="pl-[0.35em] font-serif text-sm tracking-[0.35em] text-neutral-950 dark:text-white"
          >
            ÉLANE
          </p>
          <p className="text-[13px] tracking-wide text-neutral-500 dark:text-neutral-400">
            Đang tải trải nghiệm của bạn…
          </p>
        </div>
      </div>
    </aside>
  );
}

export default RouteLoadingSpinner;
