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
  ChevronRight,
  Info,
  Maximize2,
  History,
  Trash2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
          className="max-h-[92vh] max-w-3xl overflow-y-auto overflow-x-hidden p-0 sm:max-w-4xl border border-border/80 bg-background shadow-2xl"
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
        {/* Header with Luxury Brand Accent */}
        <div className="relative border-b border-border bg-gradient-to-r from-secondary/50 via-background to-secondary/30 px-6 py-5 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <DialogTitle className="mt-2 text-xl font-normal tracking-wide sm:text-2xl font-serif">
                Phòng Thử Đồ ÉLANE
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Xem trước form dáng thực tế của trang phục trên chính hình ảnh của bạn với công nghệ AI thế hệ mới.
              </DialogDescription>
            </div>

            {/* Mode Switcher: Try-on vs History */}
            <div className="inline-flex shrink-0 items-center rounded-full border border-border/80 bg-secondary/50 p-1 text-xs shadow-xs">
              <button
                type="button"
                onClick={() => setDialogMode("tryon")}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 font-medium tracking-wide transition-all",
                  dialogMode === "tryon"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Thử đồ mới</span>
              </button>
              <button
                type="button"
                onClick={() => setDialogMode("history")}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 font-medium tracking-wide transition-all",
                  dialogMode === "history"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <History className="h-3.5 w-3.5" />
                <span>Lịch sử</span>
                {historyList.length > 0 && (
                  <span
                    className={cn(
                      "ml-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold leading-none",
                      dialogMode === "history"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {historyList.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {dialogMode === "history" ? (
            /* HISTORY TAB VIEW */
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-serif font-medium">Lịch sử ảnh đã thử đồ</h3>
                  <p className="text-xs text-muted-foreground">
                    Các bức ảnh thử đồ đã tạo được lưu trữ an toàn để bạn dễ dàng xem lại và so sánh.
                  </p>
                </div>
                {historyList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử thử đồ?")) {
                        historyList.forEach((it) => deleteTryOnRecord(it.id));
                        setHistoryList([]);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Xóa tất cả
                  </button>
                )}
              </div>

              {historyList.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-border/80 rounded-xl space-y-3 p-8">
                  <Sparkles className="mx-auto h-10 w-10 text-muted-foreground stroke-[1.2]" />
                  <h4 className="font-serif text-base">Chưa có ảnh thử đồ nào</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Tải lên một bức ảnh của bạn ở tab "Thử đồ mới" để bắt đầu trải nghiệm ngắm nhìn trang phục chuẩn xác.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDialogMode("tryon")}
                    className="mt-3 inline-flex items-center gap-2 rounded bg-primary px-5 py-2.5 text-xs uppercase tracking-widest text-primary-foreground hover:opacity-90 transition"
                  >
                    Bắt đầu thử ngay
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {historyList.map((item) => (
                    <div
                      key={item.id}
                      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md hover:border-foreground/40"
                    >
                      {/* Image Thumbnail with Click-to-Zoom */}
                      <div
                        onClick={() => {
                          setLightboxItem({
                            url: item.resultUrl,
                            originalUrl: item.userImageUrl,
                            name: item.productName,
                            price: item.productSalePrice ?? item.productPrice,
                            slug: item.productSlug,
                          });
                          setLightboxOpen(true);
                        }}
                        className="relative aspect-[3/4] w-full cursor-zoom-in overflow-hidden bg-secondary"
                      >
                        <img
                          src={item.resultUrl}
                          alt={item.productName}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
                            <Maximize2 className="h-3 w-3" /> Xem ảnh lớn
                          </span>
                        </div>
                        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                          AI Virtual Try-On
                        </span>
                      </div>

                      {/* Item Info */}
                      <div className="flex flex-1 flex-col justify-between p-3.5 text-xs">
                        <div>
                          <Link
                            to="/san-pham/$slug"
                            params={{ slug: item.productSlug }}
                            onClick={() => onOpenChange(false)}
                            className="line-clamp-1 font-medium hover:underline"
                          >
                            {item.productName}
                          </Link>
                          <div className="mt-1 flex items-center justify-between text-muted-foreground">
                            <span>
                              {formatVND(item.productSalePrice ?? item.productPrice)}
                              {item.size ? ` · Size ${item.size}` : ""}
                            </span>
                            <span className="text-[10px]">
                              {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxItem({
                                url: item.resultUrl,
                                originalUrl: item.userImageUrl,
                                name: item.productName,
                                price: item.productSalePrice ?? item.productPrice,
                                slug: item.productSlug,
                              });
                              setLightboxOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" /> Xem chi tiết
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteTryOnRecord(item.id, item.resultUrl);
                              toast.success("Đã xóa ảnh thử đồ khỏi lịch sử");
                            }}
                            className="text-muted-foreground transition hover:text-destructive p-1"
                            title="Xóa khỏi lịch sử"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* TRY-ON TAB VIEW */
            <>
              {/* Product Snapshot Bar */}
              <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded border border-border bg-secondary">
                    <img
                      src={cw?.thumbnail || cw?.images?.[0] || product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <h4 className="text-sm font-medium leading-snug truncate" title={product.name}>
                      {product.name}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Màu sắc: <strong>{cw?.id ? `Mẫu ${cw.id}` : "Tiêu chuẩn"}</strong></span>
                      <span>•</span>
                      <span>
                        Giá: <strong className="text-foreground">{formatVND(product.salePrice ?? product.price)}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Authentication Gate Reminder */}
              {!user ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
                  <UserCheck className="mx-auto h-10 w-10 text-amber-600/80" />
                  <h3 className="mt-3 text-base font-medium text-foreground">
                    Cần đăng nhập tài khoản khách hàng
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Để bảo vệ quyền riêng tư hình ảnh cá nhân và lưu trữ tủ đồ ảo của bạn, quý khách vui lòng đăng nhập trước khi sử dụng.
                  </p>
                  <div className="mt-5 flex justify-center gap-3">
                    <Link
                      to="/dang-nhap"
                      className="inline-flex items-center gap-2 rounded bg-primary px-5 py-2.5 text-xs uppercase tracking-widest text-primary-foreground hover:opacity-90"
                    >
                      Đăng nhập ngay <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      to="/dang-ky"
                      className="inline-flex items-center rounded border border-border px-5 py-2.5 text-xs uppercase tracking-widest text-foreground hover:bg-secondary"
                    >
                      Đăng ký tài khoản
                    </Link>
                  </div>
                </div>
              ) : job?.status === "COMPLETED" && job.result?.url ? (
                /* COMPLETED RESULT VIEW WITH BEFORE/AFTER SLIDER */
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-medium">Kết quả thử đồ AI đã hoàn thành</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setLightboxItem({
                          url: job.result!.url,
                          originalUrl: job.user_image?.url || previewUrl,
                          name: product.name,
                          price: variant ? (product.salePrice ?? product.price) : product.price,
                          slug: product.slug,
                        });
                        setLightboxOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>Xem toàn màn hình HD</span>
                    </button>
                  </div>

                  {/* Interactive Before/After Comparison Slider */}
                  <BeforeAfterSlider
                    resultUrl={job.result.url}
                    originalUrl={job.user_image?.url || previewUrl}
                    alt={product.name}
                    className="max-w-md shadow-xl"
                    onImageClick={() => {
                      setLightboxItem({
                        url: job.result!.url,
                        originalUrl: job.user_image?.url || previewUrl,
                        name: product.name,
                        price: variant ? (product.salePrice ?? product.price) : product.price,
                        slug: product.slug,
                      });
                      setLightboxOpen(true);
                    }}
                    overlayButton={
                      <span className="flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur">
                        <Maximize2 className="h-4 w-4" /> Bấm để phóng to xem ảnh HD
                      </span>
                    }
                  />



                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setJob(null);
                        setJobId(null);
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setElapsedSeconds(0);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Thử lại với ảnh khác
                    </button>

                    <div className="flex items-center gap-3">
                      <a
                        href={job.result.url}
                        download={`elane_tryon_${product.slug}.png`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded border border-border px-4 py-2.5 text-xs uppercase tracking-wider text-foreground transition hover:bg-secondary"
                      >
                        <Download className="h-3.5 w-3.5" /> Tải về
                      </a>
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        className="inline-flex items-center gap-2 rounded bg-primary px-6 py-2.5 text-xs uppercase tracking-widest text-primary-foreground shadow transition hover:opacity-90"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" /> Thêm vào giỏ hàng
                      </button>
                    </div>
                  </div>
                </div>
              ) : isSubmitting || (jobId && job?.status !== "FAILED") ? (
                /* PROCESSING / GENERATING REAL % PROGRESS VIEW */
                <div className="space-y-8 py-8 text-center animate-in fade-in duration-300">
                  {/* Circular Radial Gauge with Percentage */}
                  <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className="stroke-secondary"
                        strokeWidth="7"
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className="stroke-primary transition-all duration-700 ease-out"
                        strokeWidth="7"
                        strokeDasharray={263.89}
                        strokeDashoffset={263.89 - (263.89 * progressData.percent) / 100}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-serif text-3xl font-bold tracking-tight text-foreground">
                        {progressData.percent}%
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Tiến trình AI
                      </span>
                    </div>
                  </div>

                  {/* Stage Headline & Narrative */}
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary shadow-sm">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      {progressData.title}
                    </div>
                    <p className="mx-auto mt-2.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                      {progressData.desc}
                    </p>
                  </div>

                  {/* Horizontal Bar & Live Stats */}
                  <div className="mx-auto max-w-md space-y-2">
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-primary transition-all duration-700 ease-out"
                        style={{ width: `${progressData.percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                      <span>
                        Thời gian xử lý: <strong className="font-mono text-foreground">{formatTime(elapsedSeconds)}</strong>
                      </span>
                    </div>
                  </div>

                  <p className="mx-auto max-w-sm text-[11px] text-muted-foreground/80 leading-normal">
                    Quá trình xử lý không giới hạn thời gian chờ, xin vui lòng giữ nguyên cửa sổ này.
                  </p>
                </div>
              ) : (
                /* UPLOAD & FORM VIEW */
                <div className="space-y-6">
                  {(errorMsg || job?.status === "FAILED") && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive animate-in fade-in duration-200">
                      <div className="flex items-center gap-2.5">
                        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                        <span className="font-medium leading-relaxed">
                          {(() => {
                            const raw = errorMsg || job?.error_message;
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
                        className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-destructive/30 bg-background px-3.5 py-1.5 text-xs font-semibold text-destructive shadow-xs transition hover:bg-destructive hover:text-white active:scale-95"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Thử lại
                      </button>
                    </div>
                  )}

                  {/* Upload Dropzone */}
                  <div>
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
                          "group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200",
                          isDragging
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-foreground/40 hover:bg-secondary/40",
                        )}
                      >
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary transition group-hover:scale-105">
                          <Camera className="h-6 w-6 text-muted-foreground group-hover:text-foreground" />
                        </div>
                        <p className="mt-3 text-sm font-medium text-foreground">
                          Kéo thả ảnh của bạn vào đây, hoặc <span className="text-primary underline">chọn từ thiết bị</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Hỗ trợ JPG, PNG, WebP (Tối đa 15MB)
                        </p>
                      </div>
                    ) : (
                      <div className="relative mx-auto aspect-[3/4] max-w-xs overflow-hidden rounded-xl border border-border bg-secondary/40 shadow-sm">
                        <img
                          src={previewUrl}
                          alt="Ảnh tải lên"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            if (previewUrl) URL.revokeObjectURL(previewUrl);
                            setPreviewUrl(null);
                          }}
                          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                          aria-label="Xóa ảnh"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-2 left-2 right-2 rounded bg-black/60 px-2 py-1 text-center text-[11px] text-white backdrop-blur">
                          Nhấn vào góc trên để chọn ảnh khác
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Guidelines / Tips */}
                  <div className="rounded-lg border border-border/70 bg-secondary/20 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Info className="h-3.5 w-3.5 text-primary" /> Mẹo để AI cho kết quả đẹp & chuẩn nhất:
                    </div>
                    <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Chụp chính diện, đứng thẳng hoặc tạo dáng tự nhiên, đủ ánh sáng.
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Rõ từ nửa người trên (Upper body) hoặc toàn thân (Full body).
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Trang phục đang mặc gọn gàng, tránh bị che khuất bởi túi xách hay phụ kiện lớn.
                      </li>
                    </ul>
                  </div>

                  {/* Submit CTA */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="rounded border border-border px-5 py-2.5 text-xs uppercase tracking-wider text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={!selectedFile || isSubmitting}
                      onClick={handleStartTryOn}
                      className={cn(
                        "inline-flex items-center gap-2 rounded px-7 py-3 text-xs uppercase tracking-widest text-primary-foreground shadow transition cursor-pointer",
                        selectedFile && !isSubmitting
                          ? "bg-primary hover:opacity-90 active:scale-[0.98]"
                          : "cursor-not-allowed bg-muted text-muted-foreground",
                      )}
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Bắt đầu thử đồ ảo
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* High-Resolution Image Lightbox Modal with Before/After Slider */}
    <TryOnImageLightbox
      open={lightboxOpen}
      onOpenChange={setLightboxOpen}
      imageUrl={lightboxItem?.url || (job?.result?.url ?? "")}
      originalUrl={lightboxItem?.originalUrl ?? job?.user_image?.url ?? previewUrl}
      productName={lightboxItem?.name ?? product.name}
      productPrice={lightboxItem?.price ?? (product.salePrice ?? product.price)}
      productSlug={lightboxItem?.slug ?? product.slug}
      onAddToCart={handleAddToCart}
    />
  </>
  );
}

