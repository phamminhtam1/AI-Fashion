import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeAfterSliderProps {
  originalUrl?: string | null;
  resultUrl: string;
  alt?: string;
  className?: string;
  onImageClick?: () => void;
  overlayButton?: ReactNode;
}

export function BeforeAfterSlider({
  originalUrl,
  resultUrl,
  alt = "Ảnh thử đồ",
  className,
  onImageClick,
  overlayButton,
}: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDragging, setIsDragging] = useState(false);
  const [originalFailed, setOriginalFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset when URLs change
  useEffect(() => {
    setSliderPos(50);
    setOriginalFailed(false);
  }, [originalUrl, resultUrl]);

  // Pointer position updater
  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  // Global window listeners for drag
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      updatePosition(e.clientX);
    };

    const onPointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isDragging, updatePosition]);

  const hasComparison = Boolean(
    originalUrl && !originalFailed && originalUrl.trim() !== "" && originalUrl !== resultUrl,
  );

  return (
    <div
      ref={containerRef}
      onPointerDown={(e) => {
        // If clicking on comparison slider, start dragging
        if (hasComparison) {
          setIsDragging(true);
          updatePosition(e.clientX);
        }
      }}
      className={cn(
        "group relative mx-auto aspect-[3/4] w-full select-none overflow-hidden rounded-xl border border-border/80 bg-secondary/30 shadow-lg",
        hasComparison ? "cursor-ew-resize touch-none" : onImageClick ? "cursor-zoom-in" : "",
        className,
      )}
    >
      {/* Base Layer: AI Try-On Result (Full Width) */}
      <img
        src={resultUrl}
        alt={alt}
        className="h-full w-full object-cover pointer-events-none"
        draggable={false}
      />

      {/* Top Layer: Original Photo (Clipped by slider position) */}
      {hasComparison && (
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{
            clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
          }}
        >
          <img
            src={originalUrl!}
            alt="Ảnh Gốc"
            className="h-full w-full object-cover pointer-events-none"
            draggable={false}
            onError={() => {
              console.warn("Original user image failed to load, falling back to AI result.");
              setOriginalFailed(true);
            }}
          />
        </div>
      )}

      {/* Comparison Draggable Vertical Divider */}
      {hasComparison && (
        <div
          className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          {/* Centered Draggable Handle */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white text-zinc-900 shadow-2xl border-2 border-zinc-200/90 flex items-center justify-center cursor-ew-resize transition-transform pointer-events-auto",
              isDragging ? "scale-110 shadow-emerald-500/20" : "hover:scale-105",
            )}
          >
            <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5 -mr-1 stroke-[2.5]" />
            <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />
          </div>
        </div>
      )}

      {/* Badges for identification */}
      {hasComparison ? (
        <>
          <span
            className={cn(
              "absolute top-2.5 left-2.5 sm:top-3 sm:left-3 rounded-full bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-medium tracking-wide text-white backdrop-blur-sm pointer-events-none transition-opacity duration-200",
              sliderPos < 12 ? "opacity-0" : "opacity-100",
            )}
          >
            Ảnh Gốc
          </span>
          <span
            className={cn(
              "absolute top-2.5 right-2.5 sm:top-3 sm:right-3 rounded-full bg-primary/90 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-medium tracking-wide text-primary-foreground backdrop-blur-sm pointer-events-none transition-opacity duration-200",
              sliderPos > 88 ? "opacity-0" : "opacity-100",
            )}
          >
            Ảnh AI Thử Đồ
          </span>
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 max-w-[85%] truncate rounded-full bg-black/60 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] text-white/90 backdrop-blur-sm pointer-events-none select-none">
            Kéo thanh trượt để so sánh
          </div>
        </>
      ) : (
        <div className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 rounded bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium tracking-wide text-white backdrop-blur-sm pointer-events-none">
          AI Virtual Try-On
        </div>
      )}

      {/* Optional Click Overlay (e.g. click to zoom modal) */}
      {overlayButton && (
        <div
          onClick={(e) => {
            // Only trigger zoom if not actively dragging
            if (!isDragging && onImageClick) {
              e.stopPropagation();
              onImageClick();
            }
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100 cursor-zoom-in"
        >
          {overlayButton}
        </div>
      )}
    </div>
  );
}
