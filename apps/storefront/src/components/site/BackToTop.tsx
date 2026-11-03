import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 160);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to Top"
      className="fixed bottom-7 right-5 z-[70] flex flex-col items-center gap-2 bg-transparent p-1 text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
    >
      <ArrowUp aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
      <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-medium tracking-[0.08em]">
        Back to Top
      </span>
    </button>
  );
}
