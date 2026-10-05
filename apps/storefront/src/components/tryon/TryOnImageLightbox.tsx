import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Download, ShoppingBag, X, ZoomIn, ZoomOut } from "lucide-react";
import { formatVND } from "@/lib/products";
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
          <div className="z-10 flex w-full max-w-5xl items-center justify-between gap-3 px-1 py-1 text-zinc-900 shrink-0 overflow-hidden pointer-events-auto">
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
          <div className="relative flex flex-1 w-full max-w-5xl items-center justify-center overflow-hidden py-2 no-scrollbar pointer-events-auto">
            <div
              className="relative flex items-center justify-center transition-transform duration-300 ease-out"
              style={{
                transform: `scale(${zoomLevel})`,
              }}
            >
              <BeforeAfterSlider
                resultUrl={imageUrl}
                originalUrl={originalUrl}
                alt={productName || "Ảnh thử đồ AI"}
                className="max-h-[calc(100vh-175px)] w-auto max-w-[88vw] aspect-[3/4] rounded-xl shadow-2xl border border-zinc-200/80 bg-zinc-50/50"
              />
            </div>
          </div>

          {/* Bottom Bar (Product info & Add to cart) */}
          <div className="z-10 flex w-full max-w-xl items-center justify-between gap-2.5 sm:gap-4 rounded-2xl border border-zinc-200/80 bg-white/90 px-3.5 sm:px-5 py-2 sm:py-3 text-zinc-900 shadow-lg backdrop-blur-md shrink-0 pointer-events-auto">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {productPrice !== undefined && productPrice > 0 && (
                <span className="font-serif text-sm sm:text-base font-bold text-rose-600 shrink-0">
                  {formatVND(productPrice)}
                </span>
              )}
              {productSlug && (
                <Link
                  to="/san-pham/$slug"
                  params={{ slug: productSlug }}
                  className="cursor-pointer truncate text-[11px] sm:text-xs font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900 transition"
                  onClick={() => onOpenChange(false)}
                >
                  Trang sản phẩm
                </Link>
              )}
            </div>

            {onAddToCart && (
              <button
                type="button"
                onClick={() => {
                  onAddToCart();
                  onOpenChange(false);
                }}
                className="cursor-pointer inline-flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-full bg-zinc-900 px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow transition hover:bg-zinc-800 active:scale-95"
              >
                <ShoppingBag className="h-3.5 w-3.5" /> <span>Thêm vào giỏ</span>
              </button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
