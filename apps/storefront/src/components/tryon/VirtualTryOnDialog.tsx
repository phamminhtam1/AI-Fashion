import { useState, useEffect, useRef, type ChangeEvent, type DragEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  X,
  ShoppingBag,
  UserCheck,
  Info,
  Maximize2,
  History,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { type Product, formatVND } from "@/lib/products";
import { findVariant } from "@/lib/variant-stock";
import { storeApi, type StoreTryOnJob, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { TryOnImageLightbox } from "./TryOnImageLightbox";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import {
  deleteTryOnRecord,
  fetchUnifiedTryOnHistory,
  getLocalTryOnHistory,
  saveTryOnRecord,
  subscribeTryOnHistory,
  type LocalTryOnRecord,
} from "@/lib/tryon-history";

interface VirtualTryOnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  selectedColorwayId: string;
  selectedSize: string | null;
  onSelectSize?: (size: string) => void;
}

export function VirtualTryOnDialog({
  open,
  onOpenChange,
  product,
  selectedColorwayId,
  selectedSize,
  onSelectSize,
}: VirtualTryOnDialogProps) {
  const { user, addToCart } = useStore();

  const [size, setSize] = useState<string | null>(selectedSize);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Job states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<StoreTryOnJob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Progress & Lightbox states
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<{
    url: string;
    originalUrl?: string | null;
    name?: string;
    price?: number;
    slug?: string;
  } | null>(null);
  const [dialogMode, setDialogMode] = useState<"tryon" | "history">("tryon");
  const [historyList, setHistoryList] = useState<LocalTryOnRecord[]>(() => getLocalTryOnHistory());

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync unified try-on history (Server API + LocalStorage)
  useEffect(() => {
    if (open) {
      void fetchUnifiedTryOnHistory(!!user).then((items) => setHistoryList(items));
    }
  }, [open, user, dialogMode]);

  useEffect(() => {
    return subscribeTryOnHistory(() => {
      setHistoryList(getLocalTryOnHistory());
    });
  }, []);

  // Timer effect for elapsed time and real percentage animation
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isSubmitting || (jobId && job?.status !== "COMPLETED" && job?.status !== "FAILED")) {
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (job?.status !== "COMPLETED") {
        setElapsedSeconds(0);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSubmitting, jobId, job?.status]);

  // Keep size in sync if parent selectedSize changes
  useEffect(() => {
    if (selectedSize) setSize(selectedSize);
  }, [selectedSize]);

  // Clean up object URLs and polling timers
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [previewUrl]);

  // Reset state when modal is closed
  useEffect(() => {
    if (!open) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setJobId(null);
      setJob(null);
      setErrorMsg(null);
      setIsSubmitting(false);
      setElapsedSeconds(0);
    }
  }, [open]);

  const cw =
    product.colorways.find((c) => c.id === selectedColorwayId) ??
    product.colorways[0];
  const variant =
    (size ? findVariant(product.variants, cw?.id ?? "", size) : null) ??
    product.variants.find((v) => v.colorwayId === cw?.id) ??
    product.variants[0];

  // Real Progress Calculation
  const getProgressData = (seconds: number, isCompleted: boolean) => {
    if (isCompleted) {
      return {
        percent: 100,
        title: "Hoàn tất xử lý!",
        desc: "Bức ảnh thử đồ AI độ nét cao của bạn đã sẵn sàng.",
      };
    }

    let p = 5;
    if (seconds < 4) {
      p = Math.min(18, 5 + seconds * 3);
    } else if (seconds < 15) {
      p = Math.min(42, 18 + Math.round((seconds - 4) * 2.2));
    } else if (seconds < 35) {
      p = Math.min(70, 42 + Math.round((seconds - 15) * 1.4));
    } else if (seconds < 65) {
      p = Math.min(93, 70 + Math.round((seconds - 35) * 0.77));
    } else {
      p = Math.min(98, 93 + Math.round((seconds - 65) * 0.12));
    }

    let title = "Đang kiểm tra ảnh người dùng & góc chụp...";
    let desc = "AI Vision đang chuẩn bị khung hình và phân tích trang phục.";

    if (p >= 18 && p < 42) {
      title = "Phân tích ảnh người dùng";
      desc = "Đang xác định chiều cao, vai, eo và phom dáng người chuẩn mực.";
    } else if (p >= 42 && p < 70) {
      title = "Bóc tách & chuẩn bị trang phục mẫu";
      desc = "Đang trích xuất chất liệu vải, phom dáng và đường nét thiết kế.";
    } else if (p >= 70 && p < 94) {
      title = "Mô phỏng mặc thử & cân chỉnh ánh sáng thực tế";
      desc = "Đang tái tạo nếp gấp tự nhiên, độ rủ của vải và đổ bóng theo vóc dáng của bạn.";
    } else if (p >= 94) {
      title = "Khử nhiễu & xuất ảnh độ nét cao";
      desc = "Đang hoàn tất những chi tiết cuối cùng để bức ảnh đạt độ chân thực cao nhất.";
    }

    return { percent: p, title, desc };
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressData = getProgressData(elapsedSeconds, job?.status === "COMPLETED");

  // Handle Image Selection
  const handleFileChange = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng tải lên file ảnh hợp lệ (JPEG, PNG, WebP)");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Ảnh quá lớn. Vui lòng chọn ảnh dưới 15MB");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMsg(null);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileChange(f);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileChange(f);
  };

  // Start polling when jobId is set
  const startPolling = (createdJobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await storeApi.getTryOn(createdJobId);
        setJob(data);

        if (data.status === "COMPLETED") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsSubmitting(false);
          toast.success("Thử đồ AI thành công!");

          // Automatically persist to local and account history
          if (data.result?.url) {
            saveTryOnRecord({
              id: data.id,
              createdAt: data.created_at || new Date().toISOString(),
              completedAt: data.completed_at || new Date().toISOString(),
              status: "COMPLETED",
              productId: product.id,
              productName: product.name,
              productSlug: product.slug,
              productPrice: product.price,
              productSalePrice: product.salePrice,
              productImage: cw?.thumbnail || cw?.images?.[0] || product.images[0] || "",
              variantId: variant?.id,
              sku: variant?.sku,
              size: size,
              colorwayId: selectedColorwayId,
              resultUrl: data.result.url,
              userImageUrl: data.user_image?.url || previewUrl,
            });
          }
        } else if (data.status === "FAILED") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsSubmitting(false);
          setErrorMsg("Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.");
        }
      } catch (err: unknown) {
        console.error("Polling try-on error:", err);
      }
    }, 2500);
  };

  // Submit Try-On
  const handleStartTryOn = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để trải nghiệm tính năng thử đồ ảo");
      return;
    }
    if (!variant) {
      toast.error("Không tìm thấy thông tin sản phẩm mẫu để thử");
      return;
    }
    if (!selectedFile) {
      toast.error("Vui lòng chọn ảnh của bạn để thử trang phục");
      return;
    }

    setIsSubmitting(true);
    setElapsedSeconds(0);
    setErrorMsg(null);
    setJob(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("variant_id", variant.id);

      const res = await storeApi.createTryOn(formData);
      setJobId(res.id);
      startPolling(res.id);
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (err instanceof ApiError && (err.code === "customer_not_logged_in" || err.status === 401)) {
        setErrorMsg("Vui lòng đăng nhập để trải nghiệm tính năng thử đồ ảo.");
      } else {
        setErrorMsg("Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.");
      }
    }
  };

  const handleAddToCart = () => {
    if (!variant) return;
    addToCart(product, variant.id, 1);
    toast.success("Đã thêm trang phục vừa thử vào giỏ hàng!");
    onOpenChange(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(val) => {
          if (!val && lightboxOpen) return;
          onOpenChange(val);
        }}
      >
        <DialogContent
          className="w-[calc(100vw-1rem)] max-w-[1180px] overflow-hidden border border-border/70 bg-background p-0 shadow-2xl sm:w-[calc(100vw-2rem)] sm:rounded-[24px]"
          onPointerDownOutside={(e) => {
            if (lightboxOpen) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (lightboxOpen) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (lightboxOpen) {
              e.preventDefault();
              setLightboxOpen(false);
            }
          }}
        >
          <DialogTitle className="sr-only">Phòng Thử Đồ ÉLANE</DialogTitle>
          <DialogDescription className="sr-only">
            Thử trang phục ÉLANE trên ảnh của bạn bằng công nghệ AI.
          </DialogDescription>

          <div className="grid max-h-[92dvh] min-h-[680px] grid-cols-1 overflow-y-auto lg:max-h-[88vh] lg:grid-cols-[0.88fr_1.12fr] lg:overflow-hidden">
            {/* LEFT — PRODUCT / VISUAL */}
            <aside className="relative hidden overflow-hidden bg-[#eee9e2] lg:flex lg:min-h-[680px] lg:flex-col">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.9),transparent_34%)]" />

              <div className="relative z-10 flex items-center justify-between px-7 pt-7">
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-[0.24em] text-neutral-600">
                    ÉLANE
                  </p>
                  <p className="mt-1 font-serif text-[18px] tracking-[-0.02em] text-neutral-900">
                    Virtual Atelier
                  </p>
                </div>

                <span className="text-[9px] uppercase tracking-[0.18em] text-neutral-500">
                  Private fitting
                </span>
              </div>

              <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-4">
                <div className="relative flex h-full w-full max-w-[440px] items-center justify-center">
                  <div className="aspect-[3/4] w-full overflow-hidden bg-[#ddd5cc] shadow-[0_28px_80px_rgba(50,40,30,0.12)]">
                    <img
                      src={cw?.images?.[0] || cw?.thumbnail || product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </aside>

            {/* RIGHT — INTERACTION */}
            <section className="flex min-h-0 flex-col bg-background">
              {/* HEADER */}
              <header className="border-b border-border/60 px-5 py-5 sm:px-7 lg:px-9 lg:py-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="max-w-xl pr-8 sm:pr-0">
                    <p className="text-[9px] font-medium uppercase tracking-[0.23em] text-muted-foreground">
                      ÉLANE / Virtual Atelier
                    </p>

                    <h2 className="mt-2 font-serif text-[28px] font-normal leading-[1.05] tracking-[-0.03em] sm:text-[34px]">
                      {dialogMode === "tryon"
                        ? "Thử thiết kế trên chính bạn."
                        : "Your fitting archive."}
                    </h2>

                    <p className="mt-2 max-w-lg text-[11px] leading-5 text-muted-foreground sm:text-[12px]">
                      {dialogMode === "tryon"
                        ? "Một trải nghiệm fitting riêng tư, tối giản và tập trung hoàn toàn vào hình ảnh của bạn."
                        : "Những lần thử đồ đã tạo trước đây, được lưu lại để bạn xem và so sánh."}
                    </p>
                  </div>

                  <nav className="flex shrink-0 items-center gap-6 border-b border-border/60">
                    <button
                      type="button"
                      onClick={() => setDialogMode("tryon")}
                      className={cn(
                        "relative cursor-pointer pb-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors",
                        dialogMode === "tryon"
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Thử đồ mới
                      <span
                        className={cn(
                          "absolute bottom-[-1px] left-0 h-px bg-foreground transition-all duration-300",
                          dialogMode === "tryon" ? "w-full" : "w-0",
                        )}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDialogMode("history")}
                      className={cn(
                        "relative cursor-pointer pb-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors",
                        dialogMode === "history"
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Lịch sử
                      {historyList.length > 0 && (
                        <sup className="ml-1 text-[8px] text-muted-foreground">
                          {historyList.length}
                        </sup>
                      )}
                      <span
                        className={cn(
                          "absolute bottom-[-1px] left-0 h-px bg-foreground transition-all duration-300",
                          dialogMode === "history" ? "w-full" : "w-0",
                        )}
                      />
                    </button>
                  </nav>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 lg:px-9 lg:py-7">
                {dialogMode === "history" ? (
                  /* HISTORY */
                  <div>
                    <div className="mb-6 flex items-end justify-between gap-4 border-b border-border/60 pb-4">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                          Archive
                        </p>
                        <h3 className="mt-1 font-serif text-[22px]">
                          Lịch sử thử đồ
                        </h3>
                      </div>

                      {historyList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                "Bạn có chắc chắn muốn xóa toàn bộ lịch sử thử đồ?",
                              )
                            ) {
                              historyList.forEach((it) =>
                                deleteTryOnRecord(it.id),
                              );
                              setHistoryList([]);
                            }
                          }}
                          className="cursor-pointer text-[9px] uppercase tracking-[0.13em] text-muted-foreground transition-colors hover:text-destructive"
                        >
                          Xóa tất cả
                        </button>
                      )}
                    </div>

                    {historyList.length === 0 ? (
                      <div className="py-16 text-center">
                        <Sparkles className="mx-auto size-8 stroke-[1.1] text-muted-foreground/60" />
                        <h4 className="mt-5 font-serif text-[20px]">
                          Chưa có fitting nào
                        </h4>
                        <p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-muted-foreground">
                          Tải lên một bức ảnh ở tab “Thử đồ mới” để bắt đầu
                          bộ sưu tập fitting cá nhân của bạn.
                        </p>

                        <button
                          type="button"
                          onClick={() => setDialogMode("tryon")}
                          className="group mt-6 inline-flex cursor-pointer items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em]"
                        >
                          <span className="border-b border-foreground pb-1">
                            Bắt đầu thử đồ
                          </span>
                          <span className="transition-transform duration-300 group-hover:translate-x-1">
                            →
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2">
                        {historyList.map((item) => (
                          <article key={item.id} className="group">
                            <button
                              type="button"
                              onClick={() => {
                                setLightboxItem({
                                  url: item.resultUrl,
                                  originalUrl: item.userImageUrl,
                                  name: item.productName,
                                  price:
                                    item.productSalePrice ?? item.productPrice,
                                  slug: item.productSlug,
                                });
                                setLightboxOpen(true);
                              }}
                              className="relative block w-full cursor-zoom-in overflow-hidden bg-secondary/30 text-left"
                            >
                              <div className="aspect-[3/4] overflow-hidden">
                                <img
                                  src={item.resultUrl}
                                  alt={item.productName}
                                  className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.035]"
                                />
                              </div>

                              <div className="absolute inset-0 flex items-center justify-center bg-black/15 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <span className="rounded-full bg-white/90 px-3.5 py-2 text-[9px] font-medium uppercase tracking-[0.12em] text-black backdrop-blur">
                                  Xem fitting
                                </span>
                              </div>
                            </button>

                            <div className="pt-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <Link
                                    to="/san-pham/$slug"
                                    params={{ slug: item.productSlug }}
                                    onClick={() => onOpenChange(false)}
                                    className="line-clamp-1 font-serif text-[16px] leading-tight transition-opacity hover:opacity-60"
                                  >
                                    {item.productName}
                                  </Link>

                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    {formatVND(
                                      item.productSalePrice ??
                                      item.productPrice,
                                    )}
                                    {item.size ? ` · Size ${item.size}` : ""}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteTryOnRecord(
                                      item.id,
                                      item.resultUrl,
                                    );
                                    toast.success(
                                      "Đã xóa ảnh thử đồ khỏi lịch sử",
                                    );
                                  }}
                                  className="cursor-pointer p-1 text-muted-foreground transition-colors hover:text-destructive"
                                  title="Xóa khỏi lịch sử"
                                >
                                  <Trash2 className="size-3.5 stroke-[1.4]" />
                                </button>
                              </div>

                              <p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                                {new Date(item.createdAt).toLocaleDateString(
                                  "vi-VN",
                                )}
                              </p>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* CURRENT GARMENT */}
                    <div className="mb-6 grid grid-cols-[60px_minmax(0,1fr)_auto] items-center gap-4 border-b border-border/60 pb-5">
                      <div className="aspect-[3/4] overflow-hidden bg-secondary/40">
                        <img
                          src={
                            cw?.thumbnail ||
                            cw?.images?.[0] ||
                            product.images[0]
                          }
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
                          Selected piece
                        </p>
                        <h4 className="mt-1 line-clamp-1 font-serif text-[17px] leading-tight">
                          {product.name}
                        </h4>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {size ? `Size ${size}` : "Chưa chọn size"}
                          {cw?.name ? ` · ${cw.name}` : ""}
                        </p>
                      </div>

                      <p className="text-[11px] font-medium">
                        {formatVND(product.salePrice ?? product.price)}
                      </p>
                    </div>

                    {!user ? (
                      /* AUTH GATE */
                      <div className="py-10">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                          Private fitting
                        </p>
                        <h3 className="mt-2 font-serif text-[26px]">
                          Đăng nhập để bắt đầu.
                        </h3>
                        <p className="mt-2 max-w-md text-[11px] leading-5 text-muted-foreground">
                          Hình ảnh của bạn được sử dụng cho trải nghiệm fitting
                          cá nhân và lịch sử thử đồ trong tài khoản ÉLANE.
                        </p>

                        <div className="mt-7 flex flex-wrap items-center gap-5">
                          <Link
                            to="/dang-nhap"
                            className="bg-foreground px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-background"
                          >
                            Đăng nhập
                          </Link>

                          <Link
                            to="/dang-ky"
                            className="group inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em]"
                          >
                            <span className="border-b border-foreground pb-1">
                              Tạo tài khoản
                            </span>
                            <span className="transition-transform duration-300 group-hover:translate-x-1">
                              →
                            </span>
                          </Link>
                        </div>
                      </div>
                    ) : job?.status === "COMPLETED" && job.result?.url ? (
                      /* COMPLETED */
                      <div className="animate-in fade-in duration-300">
                        <div className="flex flex-col items-center justify-center py-1">
                          <BeforeAfterSlider
                            resultUrl={job.result.url}
                            originalUrl={
                              job.user_image?.url || previewUrl
                            }
                            alt={product.name}
                            className="w-full max-w-[430px] shadow-[0_24px_70px_rgba(0,0,0,0.10)]"
                          />

                          <button
                            type="button"
                            onClick={() => {
                              setLightboxItem({
                                url: job.result!.url,
                                originalUrl:
                                  job.user_image?.url || previewUrl,
                                name: product.name,
                                price:
                                  product.salePrice ?? product.price,
                                slug: product.slug,
                              });
                              setLightboxOpen(true);
                            }}
                            className="group mt-3.5 inline-flex cursor-pointer items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Maximize2 className="size-3.5 stroke-[1.4]" />
                            <span className="border-b border-transparent pb-0.5 group-hover:border-foreground">
                              Xem toàn màn hình
                            </span>
                          </button>
                        </div>

                        <div className="mt-6 flex flex-col gap-4 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setJob(null);
                              setJobId(null);
                              setSelectedFile(null);
                              setPreviewUrl(null);
                              setElapsedSeconds(0);
                            }}
                            className="group inline-flex cursor-pointer items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <RefreshCw className="size-3.5 stroke-[1.4]" />
                            Thử ảnh khác
                          </button>

                          <div className="flex items-center gap-3">
                            <a
                              href={job.result.url}
                              download={`elane_tryon_${product.slug}.png`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-secondary/50"
                            >
                              <Download className="size-3.5 stroke-[1.4]" />
                              Tải ảnh
                            </a>

                            <button
                              type="button"
                              onClick={handleAddToCart}
                              className="inline-flex cursor-pointer items-center gap-2 bg-foreground px-5 py-2.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-background transition-opacity hover:opacity-80"
                            >
                              <ShoppingBag className="size-3.5 stroke-[1.4]" />
                              Thêm vào giỏ
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : isSubmitting ||
                      (jobId && job?.status !== "FAILED") ? (
                      /* PROCESSING */
                      <div className="animate-in fade-in py-8 duration-300">
                        <div className="grid gap-8 sm:grid-cols-[150px_1fr] sm:items-center">
                          <div>
                            <p className="font-serif text-[58px] leading-none tracking-[-0.05em]">
                              {progressData.percent}
                              <span className="ml-1 text-[22px] text-muted-foreground">
                                %
                              </span>
                            </p>
                            <p className="mt-2 text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
                              Rendering
                            </p>
                          </div>

                          <div>
                            <div className="mb-5 grid grid-cols-3 gap-4">
                              {[
                                ["01", "Analyze", progressData.percent >= 18],
                                ["02", "Fit", progressData.percent >= 42],
                                ["03", "Render", progressData.percent >= 70],
                              ].map(([n, label, active]) => (
                                <div
                                  key={String(n)}
                                  className="border-t border-border/60 pt-2"
                                >
                                  <span
                                    className={cn(
                                      "text-[8px] uppercase tracking-[0.15em]",
                                      active
                                        ? "text-foreground"
                                        : "text-muted-foreground/50",
                                    )}
                                  >
                                    {n} · {label}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <h3 className="font-serif text-[23px] leading-tight">
                              {progressData.title}
                            </h3>
                            <p className="mt-2 max-w-md text-[11px] leading-5 text-muted-foreground">
                              {progressData.desc}
                            </p>

                            <div className="mt-5 h-px w-full overflow-hidden bg-border">
                              <div
                                className="h-full bg-foreground transition-all duration-700 ease-out"
                                style={{
                                  width: `${progressData.percent}%`,
                                }}
                              />
                            </div>

                            <div className="mt-2 flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                              <span>AI processing</span>
                              <span>{formatTime(elapsedSeconds)}</span>
                            </div>
                          </div>
                        </div>

                        <p className="mt-9 border-t border-border/60 pt-4 text-[10px] leading-5 text-muted-foreground">
                          Vui lòng giữ cửa sổ này mở trong khi ÉLANE hoàn thiện
                          fitting của bạn.
                        </p>
                      </div>
                    ) : (
                      /* UPLOAD */
                      <div className="space-y-5">
                        {(errorMsg || job?.status === "FAILED") && (
                          <div className="flex flex-col gap-3 border-y border-destructive/20 py-4 text-[11px] text-destructive sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="mt-0.5 size-4 shrink-0" />
                              <span className="leading-5">
                                {(() => {
                                  const raw =
                                    errorMsg || job?.error_message;
                                  if (
                                    !raw ||
                                    raw.includes("{") ||
                                    raw.includes("code:") ||
                                    raw.includes("Kie") ||
                                    raw.includes("Krea") ||
                                    raw.includes("HTTP") ||
                                    raw.includes("当前服务繁忙")
                                  ) {
                                    return "Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.";
                                  }
                                  return raw;
                                })()}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setErrorMsg(null);
                                setJob(null);
                                setJobId(null);
                                if (selectedFile) handleStartTryOn();
                              }}
                              className="shrink-0 cursor-pointer text-[9px] font-semibold uppercase tracking-[0.12em] underline underline-offset-4"
                            >
                              Thử lại
                            </button>
                          </div>
                        )}

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={onInputChange}
                          className="hidden"
                          id="tryon-photo-input"
                        />

                        {!previewUrl ? (
                          <div
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                              "group flex min-h-[260px] cursor-pointer flex-col items-center justify-center border text-center transition-all duration-300",
                              isDragging
                                ? "border-foreground bg-secondary/35"
                                : "border-border bg-[#fcfbf9] hover:border-foreground/40 hover:bg-secondary/20",
                            )}
                          >
                            <div className="flex size-11 items-center justify-center rounded-full border border-border transition-transform duration-300 group-hover:scale-105">
                              <Camera className="size-4 stroke-[1.3] text-muted-foreground" />
                            </div>

                            <h3 className="mt-4 font-serif text-[21px]">
                              Thêm ảnh của bạn
                            </h3>

                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Kéo thả hoặc chọn ảnh từ thiết bị
                            </p>

                            <p className="mt-4 text-[8px] uppercase tracking-[0.14em] text-muted-foreground/70">
                              JPG · PNG · WebP · tối đa 15MB
                            </p>
                          </div>
                        ) : (
                          <div className="relative mx-auto w-full max-w-[330px] overflow-hidden bg-secondary/30">
                            <div className="aspect-[3/4]">
                              <img
                                src={previewUrl}
                                alt="Ảnh tải lên"
                                className="h-full w-full object-cover"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFile(null);
                                if (previewUrl)
                                  URL.revokeObjectURL(previewUrl);
                                setPreviewUrl(null);
                              }}
                              className="absolute right-3 top-3 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/65 text-white backdrop-blur transition-colors hover:bg-black"
                              aria-label="Xóa ảnh"
                            >
                              <X className="size-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-4 py-2 text-[9px] font-medium uppercase tracking-[0.12em] text-black backdrop-blur"
                            >
                              Chọn ảnh khác
                            </button>
                          </div>
                        )}

                        {/* PHOTO GUIDELINES */}
                        <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
                          {[
                            ["01", "Chính diện", "Tư thế tự nhiên, không che cơ thể."],
                            ["02", "Đủ ánh sáng", "Ảnh rõ nét, hạn chế ngược sáng."],
                            ["03", "Đủ khung hình", "Nửa người hoặc toàn thân đều được."],
                          ].map(([n, title, desc]) => (
                            <div key={String(n)}>
                              <p className="text-[8px] uppercase tracking-[0.17em] text-muted-foreground">
                                {n}
                              </p>
                              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
                                {title}
                              </p>
                              <p className="mt-1 text-[9px] leading-4 text-muted-foreground">
                                {desc}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* FOOTER ACTION */}
                        <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                          <p className="max-w-sm text-[9px] leading-4 text-muted-foreground">
                            Ảnh được dùng để tạo fitting cá nhân và lưu vào lịch sử
                            thử đồ của bạn.
                          </p>

                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => onOpenChange(false)}
                              className="cursor-pointer text-[9px] font-medium uppercase tracking-[0.13em] text-muted-foreground transition-colors hover:text-foreground"
                            >
                              Hủy
                            </button>

                            <button
                              type="button"
                              disabled={!selectedFile || isSubmitting}
                              onClick={handleStartTryOn}
                              className={cn(
                                "inline-flex cursor-pointer items-center justify-center gap-2 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.14em] transition-all",
                                selectedFile && !isSubmitting
                                  ? "bg-foreground text-background hover:opacity-80 active:scale-[0.98]"
                                  : "cursor-not-allowed bg-secondary text-muted-foreground",
                              )}
                            >
                              <Sparkles className="size-3.5 stroke-[1.4]" />
                              Bắt đầu thử đồ
                              <span>→</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <TryOnImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={lightboxItem?.url || (job?.result?.url ?? "")}
        originalUrl={
          lightboxItem?.originalUrl ??
          job?.user_image?.url ??
          previewUrl
        }
        productName={lightboxItem?.name ?? product.name}
        productPrice={
          lightboxItem?.price ?? (product.salePrice ?? product.price)
        }
        productSlug={lightboxItem?.slug ?? product.slug}
        onAddToCart={handleAddToCart}
      />
    </>
  );
}
