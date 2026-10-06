import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, X, ZoomIn, ZoomOut } from "lucide-react";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

interface TryOnImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  originalUrl?: string | null | undefined;
  productName?: string | undefined;
  productPrice?: number | undefined;
  productSlug?: string | undefined;
  onAddToCart?: (() => void) | undefined;
}

export function TryOnImageLightbox({
  open,
  onOpenChange,
  imageUrl,
  originalUrl,
  productName,
  productPrice,
  productSlug,
  onAddToCart,
}: TryOnImageLightboxProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Reset zoom when open state changes
  useEffect(() => {
    if (open) {
      setZoomLevel(1);
    }
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 pointer-events-auto" />

        {/* Modal Dialog Content */}
        <DialogPrimitive.Content
          className="fixed inset-0 z-[101] flex h-screen max-h-screen w-screen max-w-full flex-col items-center justify-between overflow-hidden bg-white/95 p-4 sm:p-6 backdrop-blur-md no-scrollbar select-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 pointer-events-auto"
        >
          <DialogPrimitive.Title className="sr-only">
            {productName || "Xem ảnh thử đồ AI phóng to"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Chế độ xem ảnh lớn so sánh trực tiếp ảnh gốc và ảnh AI
          </DialogPrimitive.Description>

          {/* Top Header Bar */}
          <div className="z-10 flex w-full max-w-7xl items-center justify-between gap-3 px-1 py-1 text-zinc-900 shrink-0 overflow-hidden pointer-events-auto">
            {/* Left: Product Name with strict max-width and ellipsis truncation */}
            <div className="min-w-0 max-w-[50%] sm:max-w-[60%] overflow-hidden">
              {productName && (
                <div className="min-w-0 overflow-hidden">
                  <p
                    className="truncate font-serif text-sm sm:text-base font-medium tracking-tight text-zinc-900"
                    title={productName}
                  >
                    {productName}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500 font-sans">
                    Kéo thanh trượt ở giữa để so sánh trực tiếp ảnh gốc & ảnh thử đồ AI
                  </p>
                </div>
              )}
            </div>

            {/* Right Tools: Zoom, Download, Close */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pointer-events-auto">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => (z === 1 ? 1.4 : z === 1.4 ? 1.8 : 1))}
                className="cursor-pointer rounded-full border border-zinc-200/80 bg-zinc-100 p-2 text-zinc-700 transition hover:bg-zinc-200 hover:text-zinc-950 shadow-xs active:scale-95"
                title={zoomLevel > 1 ? "Thu nhỏ (1x)" : "Phóng to"}
              >
                {zoomLevel > 1 ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              </button>

              <a
                href={imageUrl}
                download={`elane_tryon_${Date.now()}.png`}
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-100 px-3.5 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 hover:text-zinc-950 shadow-xs active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tải ảnh AI</span>
              </a>

              <DialogPrimitive.Close
                className="cursor-pointer rounded-full border border-zinc-200/80 bg-zinc-100 p-2 text-zinc-700 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600 shadow-xs active:scale-95"
                aria-label="Đóng xem ảnh lớn"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Main Image View Area with Interactive Draggable Before/After Slider */}
          <div className="relative flex flex-1 w-full items-center justify-center overflow-hidden py-1 sm:py-2 no-scrollbar pointer-events-auto">
            <div
              className="relative flex h-full max-h-[calc(100vh-100px)] w-full items-center justify-center transition-transform duration-300 ease-out"
              style={{
                transform: `scale(${zoomLevel})`,
              }}
            >
              <BeforeAfterSlider
                resultUrl={imageUrl}
                originalUrl={originalUrl}
                alt={productName || "Ảnh thử đồ AI"}
                className="h-[calc(100vh-110px)] max-h-[920px] w-auto aspect-[3/4] max-w-[94vw] rounded-2xl shadow-2xl border border-zinc-200/80 bg-zinc-50/50"
              />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
