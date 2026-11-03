import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({ title, className }: { title: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-8", className)}>
      <h2 className="text-center text-[clamp(1.25rem,2.2vw,1.75rem)] font-bold leading-tight tracking-tight text-neutral-600">{title}</h2>
      <div aria-hidden="true" className="mx-auto mt-2.5 flex h-4 w-60 max-w-[75%] items-center gap-3">
        <span className="h-px flex-1 bg-neutral-400" />
        <span className="flex h-4 shrink-0 items-center gap-1">
          <span className="h-4 w-px rotate-[35deg] bg-neutral-600" />
          <span className="h-4 w-px rotate-[35deg] bg-neutral-600" />
          <span className="h-4 w-px rotate-[35deg] bg-neutral-600" />
        </span>
        <span className="h-px flex-1 bg-neutral-400" />
      </div>
    </div>
  );
}
