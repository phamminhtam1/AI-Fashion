import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Move,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { adminApi, type AdminProduct, type ElaneWomanPost } from "@/lib/api";
import { useConfirmDialog } from "@/components/ConfirmDialog";

function ProductCombobox({
  products,
  selectedId,
  onSelect,
}: {
  products: AdminProduct[];
  selectedId: string;
  onSelect: (productId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(q);
      const catMatch = p.category?.name?.toLowerCase().includes(q);
      const slugMatch = p.slug?.toLowerCase().includes(q);
      const skuMatch = (p.variants as Array<{ sku?: string }> | undefined)?.some((v) =>
        v.sku?.toLowerCase().includes(q),
      );
      return nameMatch || catMatch || slugMatch || skuMatch;
    });
  }, [products, search]);

  // Fix: Radix Dialog locks wheel events on document body.
  // Using capture phase wheel listener + direct scrollTop ensures mouse wheel always scrolls smoothly!
  useEffect(() => {
    const el = listRef.current;
    if (!el || !open) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      el.scrollTop += delta;
    };

    el.addEventListener("wheel", handleWheel, { passive: true, capture: true });
    return () => {
      el.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, [open, filtered]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {selectedProduct ? (
            <div className="flex items-center gap-2 min-w-0 pr-1">
              {selectedProduct.images?.[0] ? (
                <img
                  src={selectedProduct.images[0]}
                  alt=""
                  className="size-6 rounded object-cover border border-border shrink-0 bg-secondary"
                />
              ) : (
                <div className="size-6 rounded bg-muted flex items-center justify-center text-[10px] shrink-0 font-medium">
                  SP
                </div>
              )}
              <span className="truncate font-medium">{selectedProduct.name}</span>
              {selectedProduct.category?.name && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 font-normal">
                  {selectedProduct.category.name}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Search className="size-3.5" />
              Tìm kiếm và chọn sản phẩm...
            </span>
          )}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {selectedProduct && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect("");
                }}
                className="size-5 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Bỏ chọn sản phẩm"
              >
                <X className="size-3" />
              </button>
            )}
            <ChevronDown className="size-3.5 opacity-50" />
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent
        portal={false}
        align="start"
        className="w-[360px] p-0 shadow-xl border-border z-50 overflow-hidden"
      >
        <div className="p-2 border-b border-border bg-card">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Nhập tên sản phẩm, danh mục, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-7 h-8 text-xs bg-background"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div
          ref={listRef}
          className="max-h-60 overflow-y-auto p-1 divide-y divide-border/30 overscroll-contain"
        >
          <button
            type="button"
            onClick={() => {
              onSelect("");
              setOpen(false);
              setSearch("");
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded hover:bg-muted text-left transition ${
              !selectedId ? "bg-muted font-medium text-primary" : "text-muted-foreground"
            }`}
          >
            <span>-- Không gắn sản phẩm --</span>
            {!selectedId && <Check className="size-3.5 text-primary" />}
          </button>

          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Không tìm thấy sản phẩm nào khớp với "{search}"
            </div>
          ) : (
            filtered.map((prod) => {
              const isSelected = prod.id === selectedId;
              const img = prod.images?.[0] || prod.media?.[0]?.url;
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => {
                    onSelect(prod.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded hover:bg-muted text-left transition ${
                    isSelected ? "bg-primary/10 text-primary font-medium" : ""
                  }`}
                >
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="size-8 rounded object-cover border border-border shrink-0 bg-secondary"
                    />
                  ) : (
                    <div className="size-8 rounded bg-secondary flex items-center justify-center text-[10px] text-muted-foreground shrink-0 font-medium">
                      SP
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{prod.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                      {prod.category?.name && <span>{prod.category.name}</span>}
                      {prod.price_vnd ? (
                        <>
                          <span>·</span>
                          <span>{Number(prod.price_vnd).toLocaleString("vi-VN")}₫</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {isSelected && <Check className="size-4 text-primary shrink-0 ml-1" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ElaneWomanManager() {
  const [posts, setPosts] = useState<ElaneWomanPost[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Drag and drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ElaneWomanPost | null>(null);

  // Form fields
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [linkUrl, setLinkUrl] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [instagramUrl, setInstagramUrl] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [saving, setSaving] = useState(false);

  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const loadData = async () => {
    try {
      setLoading(true);
      const [resPosts, resProducts] = await Promise.all([
        adminApi.elaneWomanPosts(),
        adminApi.productsAll(),
      ]);
      setPosts(resPosts.items);
      setProducts(resProducts.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được danh sách bài đăng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const stats = useMemo(() => {
    const total = posts.length;
    const published = posts.filter((p) => p.status === "published").length;
    const draft = posts.filter((p) => p.status === "draft").length;
    return { total, published, draft };
  }, [posts]);

  const openCreateDialog = () => {
    setEditingPost(null);
    setImageMode("upload");
    setUploadFile(null);
    setPreviewUrl("");
    setImageUrl("");
    setTitle("");
    setLinkUrl("");
    setProductId("");
    setInstagramUrl("");
    // Next sort order
    const nextOrder = posts.length > 0 ? Math.max(...posts.map((p) => p.sort_order)) + 1 : 1;
    setSortOrder(nextOrder);
    setStatus("published");
    setDialogOpen(true);
  };

  const openEditDialog = (post: ElaneWomanPost) => {
    setEditingPost(post);
    setImageMode(post.image_url.startsWith("http") ? "url" : "upload");
    setUploadFile(null);
    setPreviewUrl(post.image_url);
    setImageUrl(post.image_url);
    setTitle(post.title ?? "");
    setLinkUrl(post.link_url ?? "");
    setProductId(post.product_id ?? "");
    setInstagramUrl(post.instagram_url ?? "");
    setSortOrder(post.sort_order);
    setStatus(post.status === "draft" ? "draft" : "published");
    setDialogOpen(true);
  };

  const handleProductChange = (prodId: string) => {
    setProductId(prodId);
    if (prodId) {
      const selected = products.find((p) => p.id === prodId);
      if (selected) {
        if (!linkUrl || linkUrl.startsWith("/san-pham/")) {
          setLinkUrl(`/san-pham/${selected.slug}`);
        }
        if (!title) {
          setTitle(`ÉLANEwoman · ${selected.name}`);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      const objUrl = URL.createObjectURL(file);
      setPreviewUrl(objUrl);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const finalImage = imageMode === "url" ? imageUrl.trim() : (uploadFile ? "" : previewUrl);

      if (imageMode === "url" && !finalImage) {
        toast.error("Vui lòng nhập đường dẫn ảnh (URL)");
        return;
      }
      if (imageMode === "upload" && !uploadFile && !previewUrl) {
        toast.error("Vui lòng chọn file ảnh để tải lên");
        return;
      }

      if (editingPost) {
        // Edit existing
        if (uploadFile) {
          const fd = new FormData();
          fd.append("file", uploadFile);
          if (title) fd.append("title", title);
          if (linkUrl) fd.append("link_url", linkUrl);
          if (productId) fd.append("product_id", productId);
          if (instagramUrl) fd.append("instagram_url", instagramUrl);
          fd.append("sort_order", String(sortOrder));
          fd.append("status", status);
          await adminApi.patchElaneWomanPost(editingPost.id, fd);
        } else {
          await adminApi.patchElaneWomanPost(editingPost.id, {
            title: title || null,
            image_url: finalImage || undefined,
            link_url: linkUrl || null,
            product_id: productId || null,
            instagram_url: instagramUrl || null,
            sort_order: sortOrder,
            status,
          });
        }
        toast.success("Cập nhật bài đăng thành công");
      } else {
        // Create new
        if (uploadFile) {
          const fd = new FormData();
          fd.append("file", uploadFile);
          if (title) fd.append("title", title);
          if (linkUrl) fd.append("link_url", linkUrl);
          if (productId) fd.append("product_id", productId);
          if (instagramUrl) fd.append("instagram_url", instagramUrl);
          fd.append("sort_order", String(sortOrder));
          fd.append("status", status);
          await adminApi.createElaneWomanPost(fd);
        } else {
          await adminApi.createElaneWomanPost({
            title: title || null,
            image_url: finalImage,
            link_url: linkUrl || null,
            product_id: productId || null,
            instagram_url: instagramUrl || null,
            sort_order: sortOrder,
            status,
          });
        }
        toast.success("Thêm bài đăng mới thành công");
      }

      setDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra khi lưu bài đăng");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (post: ElaneWomanPost) => {
    confirm({
      title: "Xóa ảnh ÉLANEwoman?",
      description: `Bạn có chắc chắn muốn xóa bài đăng "${post.title || "này"}" khỏi thư viện lookbook?`,
      confirmLabel: "Xóa bài đăng",
      variant: "destructive",
      onConfirm: async () => {
        try {
          await adminApi.deleteElaneWomanPost(post.id);
          toast.success("Đã xóa bài đăng");
          await loadData();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Xóa bài đăng thất bại");
        }
      },
    });
  };

  const handleToggleStatus = async (post: ElaneWomanPost) => {
    const nextStatus = post.status === "published" ? "draft" : "published";
    try {
      await adminApi.patchElaneWomanPost(post.id, { status: nextStatus });
      toast.success(
        nextStatus === "published"
          ? "Đã công khai trên trang chủ"
          : "Đã chuyển về bản nháp",
      );
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, status: nextStatus } : p)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
    }
  };

  const publishedPosts = useMemo(
    () => posts.filter((p) => p.status === "published"),
    [posts],
  );

  const movePost = async (fromIdx: number, toIdx: number) => {
    if (
      fromIdx < 0 ||
      fromIdx >= publishedPosts.length ||
      toIdx < 0 ||
      toIdx >= publishedPosts.length ||
      fromIdx === toIdx
    ) {
      return;
    }

    const reordered = [...publishedPosts];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved!);

    const updatedPublished = reordered.map((p, i) => ({ ...p, sort_order: i + 1 }));
    const publishedMap = new Map(updatedPublished.map((p) => [p.id, p]));
    const nextPosts = posts.map((p) => publishedMap.get(p.id) ?? p);
    nextPosts.sort((a, b) => a.sort_order - b.sort_order);

    setPosts(nextPosts);

    try {
      setReordering(true);
      await adminApi.reorderElaneWomanPosts(
        updatedPublished.map((p) => ({ id: p.id, sort_order: p.sort_order }))
      );
      toast.success(`Đã đổi vị trí #${fromIdx + 1} sang #${toIdx + 1}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cập nhật thứ tự thất bại");
      await loadData();
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{items.length} hình ảnh lookbook</span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            Trang chủ & Instagram
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading || reordering}>
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button onClick={openCreateDialog} size="sm" className="bg-primary text-primary-foreground">
            <Plus className="size-3.5 mr-1.5" />
            Thêm ảnh mới
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tổng số ảnh</p>
          <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">Trong thư viện lookbook</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Đang hiển thị
          </p>
          <p className="mt-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
            {stats.published}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Xuất hiện trên trang chủ storefront</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Bản nháp / Tạm ẩn
          </p>
          <p className="mt-2 text-3xl font-semibold text-amber-600 dark:text-amber-400">
            {stats.draft}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Chưa công khai cho khách hàng</p>
        </div>
      </div>

      {/* Live Preview Bar with Drag and Drop */}
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Xem trước hiển thị thực tế trên Trang chủ (#ÉLANEwoman)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full w-fit">
            <Move className="size-3.5" />
            <span>Kéo thả hoặc dùng mũi tên để đổi thứ tự hiển thị</span>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Camera className="size-10 text-muted-foreground stroke-[1.25]" />
            <p className="mt-3 text-sm font-medium">Chưa có bài đăng ÉLANEwoman nào</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Bấm nút "Thêm ảnh mới" để đưa những bức hình người mẫu, khách hàng mặc outfit lên trang chủ.
            </p>
            <Button onClick={openCreateDialog} size="sm" className="mt-4">
              <Plus className="size-4 mr-2" />
              Thêm bài đăng đầu tiên
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {publishedPosts.slice(0, 6).map((p, idx) => {
              const isDragging = dragIndex === idx;
              const isOver = dragOverIndex === idx && dragIndex !== idx;
              return (
                <div
                  key={p.id}
                  draggable={!reordering}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(idx));
                    setDragIndex(idx);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverIndex !== idx) setDragOverIndex(idx);
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === idx) setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromIdx = dragIndex ?? Number(e.dataTransfer.getData("text/plain"));
                    setDragIndex(null);
                    setDragOverIndex(null);
                    if (fromIdx !== null && !isNaN(fromIdx) && fromIdx !== idx) {
                      void movePost(fromIdx, idx);
                    }
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`group relative aspect-square overflow-hidden rounded-lg border bg-secondary shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                    isDragging
                      ? "opacity-30 scale-95 border-dashed border-primary"
                      : isOver
                      ? "scale-105 border-primary ring-2 ring-primary ring-offset-2 z-20 shadow-xl"
                      : "border-border hover:border-primary/60 hover:shadow-md"
                  }`}
                >
                  <img
                    src={p.image_url}
                    alt={p.title ?? "ÉLANEwoman"}
                    className="h-full w-full object-cover pointer-events-none"
                  />

                  {/* Order Badge */}
                  <div className="absolute top-1.5 left-1.5 z-10">
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-black/75 text-[10px] font-bold text-white shadow backdrop-blur-xs">
                      {idx + 1}
                    </span>
                  </div>

                  {/* Drag Grip Indicator */}
                  <div className="absolute top-1.5 right-1.5 z-10 rounded-full bg-black/60 p-1 text-white opacity-70 transition group-hover:opacity-100 group-hover:bg-primary shadow backdrop-blur-xs">
                    <GripVertical className="size-3" />
                  </div>

                  {/* Quick Shift arrow buttons on hover */}
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-1.5 opacity-0 group-hover:opacity-100 transition z-20 pointer-events-auto">
                    <button
                      type="button"
                      disabled={idx === 0 || reordering}
                      onClick={(e) => {
                        e.stopPropagation();
                        void movePost(idx, idx - 1);
                      }}
                      className="size-6 rounded-full bg-black/75 text-white flex items-center justify-center hover:bg-black disabled:opacity-0 shadow transition"
                      title="Chuyển sang trái"
                    >
                      <ArrowLeft className="size-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === publishedPosts.length - 1 || reordering}
                      onClick={(e) => {
                        e.stopPropagation();
                        void movePost(idx, idx + 1);
                      }}
                      className="size-6 rounded-full bg-black/75 text-white flex items-center justify-center hover:bg-black disabled:opacity-0 shadow transition"
                      title="Chuyển sang phải"
                    >
                      <ArrowRight className="size-3" />
                    </button>
                  </div>

                  {p.product_name && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 text-white">
                      <p className="truncate text-[11px] font-medium leading-tight">{p.product_name}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid of All Posts with Full Controls */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Tất cả bài đăng trong danh sách ({posts.length})</h3>
          <p className="text-xs text-muted-foreground">Rê chuột vào thẻ để sửa, ẩn/hiện hoặc xóa</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className={`group relative overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:shadow-md ${
                post.status === "draft" ? "border-dashed opacity-75" : "border-border"
              }`}
            >
              {/* Image Container */}
              <div className="relative aspect-square w-full overflow-hidden bg-secondary">
                <img
                  src={post.image_url}
                  alt={post.title ?? "ÉLANEwoman"}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Status & Order Badges */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <Badge variant="secondary" className="bg-black/70 text-white font-mono text-[10px] px-2 py-0.5">
                    #{post.sort_order}
                  </Badge>
                  {post.status === "published" ? (
                    <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5">
                      Công khai
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-background/90 text-muted-foreground text-[10px] px-2 py-0.5">
                      Bản nháp
                    </Badge>
                  )}
                </div>

                {/* Action Buttons Overlay on Hover */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="size-9 rounded-full bg-white/95 text-foreground hover:bg-white"
                    onClick={() => openEditDialog(post)}
                    title="Chỉnh sửa"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="size-9 rounded-full bg-white/95 text-foreground hover:bg-white"
                    onClick={() => handleToggleStatus(post)}
                    title={post.status === "published" ? "Tạm ẩn" : "Hiển thị"}
                  >
                    {post.status === "published" ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="size-9 rounded-full"
                    onClick={() => handleDelete(post)}
                    title="Xóa bài đăng"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Details Content */}
              <div className="p-3.5 space-y-2">
                <div>
                  <h4 className="font-medium text-sm truncate" title={post.title ?? "Chưa đặt tiêu đề"}>
                    {post.title || <span className="italic text-muted-foreground">Không có tiêu đề</span>}
                  </h4>
                  {post.product_name ? (
                    <p className="text-xs text-primary truncate mt-0.5" title={post.product_name}>
                      Sản phẩm: {post.product_name}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Không gắn sản phẩm</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                  <div className="flex items-center gap-1 truncate max-w-[180px]">
                    <LinkIcon className="size-3 shrink-0" />
                    <span className="truncate">{post.link_url || (post.product_slug ? `/san-pham/${post.product_slug}` : "—")}</span>
                  </div>

                  {post.link_url && (
                    <a
                      href={post.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-0.5"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dialog Create / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {editingPost ? "Chỉnh sửa bài đăng ÉLANEwoman" : "Thêm bài đăng mới"}
            </DialogTitle>
            <DialogDescription>
              Cấu hình hình ảnh, đường dẫn liên kết sản phẩm và thứ tự hiển thị lookbook.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Image Selection: Upload or URL */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hình ảnh bài đăng <span className="text-red-500">*</span>
              </label>

              <Tabs value={imageMode} onValueChange={(v) => setImageMode(v as "upload" | "url")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" className="text-xs">
                    <Upload className="size-3.5 mr-1.5" /> Tải ảnh từ máy
                  </TabsTrigger>
                  <TabsTrigger value="url" className="text-xs">
                    <ImageIcon className="size-3.5 mr-1.5" /> Dán đường dẫn ảnh (URL)
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-3 space-y-3">
                  <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-border p-6 text-center hover:bg-muted/50 transition">
                    <label className="cursor-pointer flex flex-col items-center">
                      <Upload className="size-8 text-muted-foreground mb-2" />
                      <span className="text-sm font-medium">Bấm vào đây để chọn ảnh</span>
                      <span className="text-xs text-muted-foreground mt-1">Hỗ trợ JPG, PNG, WebP (Tối đa 10MB)</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                </TabsContent>

                <TabsContent value="url" className="mt-3 space-y-2">
                  <Input
                    placeholder="https://images.unsplash.com/photo-..."
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setPreviewUrl(e.target.value);
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Dán link ảnh trực tiếp từ Unsplash, Pinterest hoặc CDN ngoài.
                  </p>
                </TabsContent>
              </Tabs>

              {/* Image Preview */}
              {previewUrl && (
                <div className="relative mt-2 aspect-video max-h-48 overflow-hidden rounded-lg border border-border bg-secondary flex items-center justify-center">
                  <img src={previewUrl} alt="Preview" className="h-full w-full object-contain" />
                </div>
              )}
            </div>

            {/* Title / Caption */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tiêu đề / Caption
              </label>
              <Input
                placeholder="Ví dụ: #ÉLANEwoman · Đầm lụa Parisienne quyến rũ"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Link with Product */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Gắn sản phẩm liên quan
                </label>
                <ProductCombobox
                  products={products}
                  selectedId={productId}
                  onSelect={handleProductChange}
                />
              </div>

              {/* Link URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Đường dẫn khi click vào ảnh
                </label>
                <Input
                  placeholder="/san-pham/dam-lua-noir hoặc URL"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Instagram Link & Sort order */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Link Instagram (tùy chọn)
                </label>
                <Input
                  placeholder="https://instagram.com/p/..."
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Thứ tự hiển thị
                </label>
                <Input
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Trạng thái hiển thị
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === "published"}
                    onChange={() => setStatus("published")}
                    className="accent-primary"
                  />
                  <span>Công khai (Hiển thị trên trang chủ)</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === "draft"}
                    onChange={() => setStatus("draft")}
                    className="accent-primary"
                  />
                  <span>Bản nháp (Tạm ẩn)</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              {editingPost ? "Lưu thay đổi" : "Thêm bài đăng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ConfirmDialogComponent}
    </div>
  );
}
