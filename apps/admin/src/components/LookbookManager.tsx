import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
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
  ShoppingBag,
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
import {
  adminApi,
  type AdminLookbook,
  type AdminLookbookItem,
  type AdminProduct,
} from "@/lib/api";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { ProductCombobox } from "@/components/ProductCombobox";

export function LookbookManager() {
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

  const [lookbooks, setLookbooks] = useState<AdminLookbook[]>([]);
  const [selectedLookbook, setSelectedLookbook] = useState<AdminLookbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);

  // Lookbook Modal state
  const [lookbookDialogOpen, setLookbookDialogOpen] = useState(false);
  const [editingLookbook, setEditingLookbook] = useState<AdminLookbook | null>(null);
  const [lookbookForm, setLookbookForm] = useState({
    title: "",
    slug: "",
    subtitle: "",
    season: "",
    description: "",
    cover_image_url: "",
    status: "published",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [savingLookbook, setSavingLookbook] = useState(false);

  // Frame Item Modal state
  const [frameDialogOpen, setFrameDialogOpen] = useState(false);
  const [editingFrame, setEditingFrame] = useState<AdminLookbookItem | null>(null);
  const [frameForm, setFrameForm] = useState({
    title: "",
    caption: "",
    image_url: "",
    product_id: "",
    link_url: "",
    status: "published",
  });
  const [frameFile, setFrameFile] = useState<File | null>(null);
  const [framePreview, setFramePreview] = useState<string>("");
  const [savingFrame, setSavingFrame] = useState(false);

  // Drag reordering for frames
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const lbRes = await adminApi.lookbooks();
      setLookbooks(lbRes.items || []);

      // Refresh selected lookbook if open
      if (selectedLookbook) {
        const updated = await adminApi.lookbook(selectedLookbook.id);
        setSelectedLookbook(updated);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải dữ liệu thất bại");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const totalCollections = lookbooks.length;
    const totalFrames = lookbooks.reduce((acc, lb) => acc + (lb.item_count || 0), 0);
    const published = lookbooks.filter((lb) => lb.status === "published").length;
    const draft = lookbooks.filter((lb) => lb.status !== "published").length;
    return { totalCollections, totalFrames, published, draft };
  }, [lookbooks]);

  // Open Create Lookbook Dialog
  const handleOpenCreateLookbook = () => {
    setEditingLookbook(null);
    setLookbookForm({
      title: "",
      slug: "",
      subtitle: "",
      season: "AW26",
      description: "",
      cover_image_url: "",
      status: "published",
    });
    setCoverFile(null);
    setCoverPreview("");
    setLookbookDialogOpen(true);
  };

  // Open Edit Lookbook Dialog
  const handleOpenEditLookbook = (lb: AdminLookbook) => {
    setEditingLookbook(lb);
    setLookbookForm({
      title: lb.title || "",
      slug: lb.slug || "",
      subtitle: lb.subtitle || "",
      season: lb.season || "",
      description: lb.description || "",
      cover_image_url: lb.cover_image_url || "",
      status: lb.status || "published",
    });
    setCoverFile(null);
    setCoverPreview(lb.cover_image_url || "");
    setLookbookDialogOpen(true);
  };

  // Save Lookbook (Create or Update)
  const handleSaveLookbook = async () => {
    if (!lookbookForm.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề bộ Lookbook");
      return;
    }
    if (!coverFile && !lookbookForm.cover_image_url.trim() && !coverPreview) {
      toast.error("Vui lòng tải lên hoặc dán link ảnh bìa");
      return;
    }

    try {
      setSavingLookbook(true);
      let coverUrl = lookbookForm.cover_image_url.trim();

      if (coverFile) {
        const uploadRes = await adminApi.uploadLookbookImage(coverFile);
        coverUrl = uploadRes.url;
      }

      if (editingLookbook) {
        const updated = await adminApi.updateLookbook(editingLookbook.id, {
          title: lookbookForm.title.trim(),
          slug: lookbookForm.slug.trim() || undefined,
          subtitle: lookbookForm.subtitle.trim() || null,
          season: lookbookForm.season.trim() || null,
          description: lookbookForm.description.trim() || null,
          cover_image_url: coverUrl,
          status: lookbookForm.status,
        });
        toast.success(`Đã cập nhật bộ Lookbook "${updated.title}"`);
        if (selectedLookbook?.id === updated.id) {
          setSelectedLookbook((prev) => (prev ? { ...prev, ...updated } : null));
        }
      } else {
        const created = await adminApi.createLookbook({
          title: lookbookForm.title.trim(),
          slug: lookbookForm.slug.trim() || undefined,
          subtitle: lookbookForm.subtitle.trim() || null,
          season: lookbookForm.season.trim() || null,
          description: lookbookForm.description.trim() || null,
          cover_image_url: coverUrl,
          status: lookbookForm.status,
          sort_order: lookbooks.length + 1,
        });
        toast.success(`Đã tạo bộ Lookbook mới "${created.title}"`);
      }

      setLookbookDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu bộ Lookbook thất bại");
    } finally {
      setSavingLookbook(false);
    }
  };

  // Delete Lookbook
  const handleDeleteLookbook = async (lb: AdminLookbook) => {
    const ok = await confirm({
      title: `Xóa bộ Lookbook "${lb.title}"?`,
      description: `Thao tác này sẽ xóa toàn bộ bộ ảnh và các khung hình bên trong khỏi hệ thống. Bạn có chắc chắn muốn xóa?`,
      confirmText: "Xóa vĩnh viễn",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await adminApi.deleteLookbook(lb.id);
      toast.success(`Đã xóa bộ Lookbook "${lb.title}"`);
      if (selectedLookbook?.id === lb.id) {
        setSelectedLookbook(null);
      }
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa thất bại");
    }
  };

  // Open Manage Frames for a Lookbook
  const handleOpenFramesManager = async (lb: AdminLookbook) => {
    try {
      setLoading(true);
      const detail = await adminApi.lookbook(lb.id);
      setSelectedLookbook(detail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải chi tiết bộ ảnh thất bại");
    } finally {
      setLoading(false);
    }
  };

  // Open Create Frame Item Dialog
  const handleOpenCreateFrame = () => {
    if (!selectedLookbook) return;
    setEditingFrame(null);
    setFrameForm({
      title: "",
      caption: "",
      image_url: "",
      product_id: "",
      link_url: "",
      status: "published",
    });
    setFrameFile(null);
    setFramePreview("");
    setFrameDialogOpen(true);
  };

  // Open Edit Frame Item Dialog
  const handleOpenEditFrame = (frame: AdminLookbookItem) => {
    setEditingFrame(frame);
    setFrameForm({
      title: frame.title || "",
      caption: frame.caption || "",
      image_url: frame.image_url || "",
      product_id: frame.product_id || "",
      link_url: frame.link_url || "",
      status: frame.status || "published",
    });
    setFrameFile(null);
    setFramePreview(frame.image_url || "");
    setFrameDialogOpen(true);
  };

  // Save Frame Item (Create or Update)
  const handleSaveFrame = async () => {
    if (!selectedLookbook) return;
    if (!frameFile && !frameForm.image_url.trim() && !framePreview) {
      toast.error("Vui lòng tải lên hoặc dán link ảnh khung hình");
      return;
    }

    try {
      setSavingFrame(true);
      let imgUrl = frameForm.image_url.trim();

      if (frameFile) {
        const uploadRes = await adminApi.uploadLookbookImage(frameFile);
        imgUrl = uploadRes.url;
      }

      if (editingFrame) {
        await adminApi.updateLookbookItem(editingFrame.id, {
          title: frameForm.title.trim() || null,
          caption: frameForm.caption.trim() || null,
          image_url: imgUrl,
          product_id: frameForm.product_id || null,
          link_url: frameForm.link_url.trim() || null,
          status: frameForm.status,
        });
        toast.success("Đã cập nhật khung hình");
      } else {
        const currentCount = selectedLookbook.items?.length || 0;
        await adminApi.addLookbookItem(selectedLookbook.id, {
          title: frameForm.title.trim() || null,
          caption: frameForm.caption.trim() || null,
          image_url: imgUrl,
          product_id: frameForm.product_id || null,
          link_url: frameForm.link_url.trim() || null,
          status: frameForm.status,
          sort_order: currentCount + 1,
        });
        toast.success("Đã thêm khung hình mới vào bộ Lookbook");
      }

      setFrameDialogOpen(false);
      const refreshed = await adminApi.lookbook(selectedLookbook.id);
      setSelectedLookbook(refreshed);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lưu khung hình thất bại");
    } finally {
      setSavingFrame(false);
    }
  };

  // Delete Frame Item
  const handleDeleteFrame = async (frame: AdminLookbookItem) => {
    if (!selectedLookbook) return;
    const ok = await confirm({
      title: `Xóa khung hình #${frame.sort_order}?`,
      description: "Bạn có chắc chắn muốn xóa khung hình này khỏi bộ Lookbook?",
      confirmText: "Xóa khung hình",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await adminApi.deleteLookbookItem(frame.id);
      toast.success("Đã xóa khung hình");
      const refreshed = await adminApi.lookbook(selectedLookbook.id);
      setSelectedLookbook(refreshed);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xóa khung hình thất bại");
    }
  };

  // Reorder Frame Items (move left / move right or drag)
  const handleMoveFrame = async (fromIdx: number, toIdx: number) => {
    if (!selectedLookbook?.items || fromIdx === toIdx) return;
    const items = [...selectedLookbook.items];
    if (toIdx < 0 || toIdx >= items.length) return;

    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);

    const reorderedPayload = items.map((it, idx) => ({
      id: it.id,
      sort_order: idx + 1,
    }));

    try {
      setReordering(true);
      setSelectedLookbook({
        ...selectedLookbook,
        items: items.map((it, idx) => ({ ...it, sort_order: idx + 1 })),
      });
      await adminApi.reorderLookbookItems(selectedLookbook.id, reorderedPayload);
      toast.success(`Đã đổi vị trí khung hình #${fromIdx + 1} sang #${toIdx + 1}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đổi thứ tự thất bại");
      const refreshed = await adminApi.lookbook(selectedLookbook.id);
      setSelectedLookbook(refreshed);
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {ConfirmDialogElement}

      {/* VIEW LEVEL 1: COLLECTIONS LIST */}
      {!selectedLookbook ? (
        <>
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{lookbooks.length} bộ sưu tập Lookbook</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {stats.totalFrames} khung hình nghệ thuật
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading || reordering}>
                <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
              <Button onClick={handleOpenCreateLookbook} size="sm" className="bg-primary text-primary-foreground">
                <Plus className="size-3.5 mr-1.5" />
                Tạo bộ Lookbook mới
              </Button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Bộ Lookbook</p>
              <p className="mt-2 text-3xl font-semibold">{stats.totalCollections}</p>
              <p className="mt-1 text-xs text-muted-foreground">Chủ đề & câu chuyện mùa</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tổng khung hình</p>
              <p className="mt-2 text-3xl font-semibold">{stats.totalFrames}</p>
              <p className="mt-1 text-xs text-muted-foreground">Ảnh phối đồ thời trang</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Đã xuất bản
              </p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
                {stats.published}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Hiển thị trên /lookbook</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Bản nháp / Tạm ẩn
              </p>
              <p className="mt-2 text-3xl font-semibold text-amber-600 dark:text-amber-400">
                {stats.draft}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Chưa công khai cho khách</p>
            </div>
          </div>

          {/* Lookbook Sets Grid */}
          {lookbooks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <BookOpen className="size-12 mx-auto text-muted-foreground/60 stroke-[1.25]" />
              <h3 className="mt-4 text-base font-medium">Chưa có bộ Lookbook nào</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Tạo bộ Lookbook đầu tiên để giới thiệu câu chuyện thời trang và cảm hứng phối đồ cao cấp cho khách hàng.
              </p>
              <Button onClick={handleOpenCreateLookbook} size="sm" className="mt-5">
                <Plus className="size-4 mr-2" />
                Tạo bộ Lookbook đầu tiên
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {lookbooks.map((lb) => {
                const isPublished = lb.status === "published";
                return (
                  <div
                    key={lb.id}
                    className="group rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/40 flex flex-col justify-between"
                  >
                    <div>
                      {/* Cover Photo */}
                      <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
                        <img
                          src={lb.cover_image_url}
                          alt={lb.title}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute top-3 left-3 flex items-center gap-2">
                          {lb.season && (
                            <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-medium tracking-wider text-white backdrop-blur-md">
                              {lb.season}
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-md ${isPublished
                              ? "bg-emerald-500/80 text-white"
                              : "bg-amber-500/80 text-white"
                              }`}
                          >
                            {isPublished ? "Đã xuất bản" : "Bản nháp"}
                          </span>
                        </div>
                        <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                          {lb.item_count || 0} khung hình
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 space-y-2">
                        <h3 className="font-serif text-xl font-medium text-foreground">
                          {lb.title}
                        </h3>
                        {lb.subtitle && (
                          <p className="font-serif italic text-xs text-muted-foreground">
                            "{lb.subtitle}"
                          </p>
                        )}
                        {lb.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {lb.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-5 pt-0 border-t border-border/50 mt-4 flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleOpenFramesManager(lb)}
                        className="flex-1 bg-primary text-primary-foreground text-xs"
                      >
                        <Camera className="size-3.5 mr-1.5" />
                        Quản lý khung hình ({lb.item_count || 0})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditLookbook(lb)}
                        className="size-8 p-0"
                        title="Chỉnh sửa thông tin"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteLookbook(lb)}
                        className="size-8 p-0 text-destructive hover:bg-destructive/10"
                        title="Xóa bộ ảnh"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* VIEW LEVEL 2: DETAIL FRAMES MANAGER FOR SELECTED LOOKBOOK */
        <div className="space-y-6">
          {/* Top Bar with Back Button */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLookbook(null)}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                Quay lại danh sách Lookbook
              </Button>
              <div className="h-4 w-px bg-border hidden sm:block" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-xl font-medium text-foreground">
                    {selectedLookbook.title}
                  </h2>
                  {selectedLookbook.season && (
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedLookbook.season}
                    </Badge>
                  )}
                  <Badge
                    variant={selectedLookbook.status === "published" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {selectedLookbook.status === "published" ? "Đang xuất bản" : "Bản nháp"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedLookbook.items?.length || 0} khung hình · Đường dẫn: /lookbook (mục {selectedLookbook.slug})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenEditLookbook(selectedLookbook)}
                className="text-xs"
              >
                <Pencil className="size-3.5 mr-1.5" />
                Sửa bộ Lookbook
              </Button>
              <Button
                onClick={handleOpenCreateFrame}
                size="sm"
                className="bg-primary text-primary-foreground text-xs"
              >
                <Plus className="size-3.5 mr-1.5" />
                Thêm khung hình mới
              </Button>
            </div>
          </div>

          {/* Frames Grid */}
          {!selectedLookbook.items || selectedLookbook.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Camera className="size-12 mx-auto text-muted-foreground/60 stroke-[1.25]" />
              <h3 className="mt-4 text-base font-medium">Chưa có khung hình nào trong bộ này</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Bấm nút "Thêm khung hình mới" để đăng ảnh người mẫu và gắn sản phẩm trang phục tương ứng.
              </p>
              <Button onClick={handleOpenCreateFrame} size="sm" className="mt-5">
                <Plus className="size-4 mr-2" />
                Thêm khung hình đầu tiên
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {selectedLookbook.items.map((frame, idx) => {
                const totalFrames = selectedLookbook.items?.length || 0;
                const isDragging = dragIndex === idx;
                const isOver = dragOverIndex === idx && dragIndex !== idx;

                return (
                  <div
                    key={frame.id}
                    draggable={!reordering}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(idx));
                      setDragIndex(idx);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverIndex !== idx) setDragOverIndex(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverIndex === idx) setDragOverIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const sourceIdx = Number(e.dataTransfer.getData("text/plain"));
                      setDragIndex(null);
                      setDragOverIndex(null);
                      if (!isNaN(sourceIdx) && sourceIdx !== idx) {
                        handleMoveFrame(sourceIdx, idx);
                      }
                    }}
                    className={`group rounded-xl border bg-card overflow-hidden flex flex-col justify-between transition-all duration-200 ${isDragging
                      ? "opacity-40 scale-95 border-primary shadow-xl"
                      : isOver
                        ? "border-primary ring-2 ring-primary/30 scale-[1.02]"
                        : "border-border hover:border-primary/40 hover:shadow-md"
                      }`}
                  >
                    <div>
                      {/* Photo Thumbnail */}
                      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                        <img
                          src={frame.image_url}
                          alt={frame.title || "Khung hình"}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {/* Number Badge */}
                        <div className="absolute top-2.5 left-2.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                          #{idx + 1}
                        </div>
                        {/* Status Badge */}
                        <div className="absolute top-2.5 right-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-md ${frame.status === "published"
                              ? "bg-emerald-500/80 text-white"
                              : "bg-amber-500/80 text-white"
                              }`}
                          >
                            {frame.status === "published" ? "Hiển thị" : "Bản nháp"}
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3.5 space-y-2">
                        <h4 className="font-serif text-sm font-medium text-foreground truncate">
                          {frame.title || `Khung hình #${idx + 1}`}
                        </h4>
                        {frame.caption && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {frame.caption}
                          </p>
                        )}

                        {/* Linked Product Info */}
                        {frame.product_name ? (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 flex items-center gap-2 text-xs">
                            <ShoppingBag className="size-3.5 text-primary shrink-0" />
                            <span className="truncate text-foreground font-medium">
                              {frame.product_name}
                            </span>
                          </div>
                        ) : frame.link_url ? (
                          <div className="rounded-lg border border-border bg-secondary/30 p-2 flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                            <LinkIcon className="size-3 shrink-0" />
                            <span className="truncate">{frame.link_url}</span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/60 italic">
                            Chưa gắn sản phẩm liên kết
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Controls */}
                    <div className="p-3 pt-0 border-t border-border/50 mt-2 flex items-center justify-between gap-1">
                      {/* Arrow Reorder Buttons */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={idx === 0 || reordering}
                          onClick={() => handleMoveFrame(idx, idx - 1)}
                          className="size-7 p-0 cursor-pointer"
                          title="Di chuyển sang trái"
                        >
                          <ArrowLeft className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={idx === totalFrames - 1 || reordering}
                          onClick={() => handleMoveFrame(idx, idx + 1)}
                          className="size-7 p-0 cursor-pointer"
                          title="Di chuyển sang phải"
                        >
                          <ArrowRight className="size-3" />
                        </Button>
                      </div>

                      {/* Edit / Delete Buttons */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditFrame(frame)}
                          className="size-7 p-0 cursor-pointer"
                          title="Chỉnh sửa khung hình"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteFrame(frame)}
                          className="size-7 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Xóa khung hình"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DIALOG: CREATE / EDIT LOOKBOOK COLLECTION */}
      <Dialog open={lookbookDialogOpen} onOpenChange={setLookbookDialogOpen}>
        <DialogContent className="w-full sm:max-w-xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border/50 shrink-0">
            <DialogTitle className="text-base font-semibold break-words pr-6">
              {editingLookbook ? "Chỉnh sửa bộ Lookbook" : "Tạo bộ Lookbook mới"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground break-words pr-6 leading-relaxed">
              Thiết lập thông tin chủ đề, mùa thời trang và ảnh bìa cho bộ Lookbook.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 py-4 space-y-4 min-w-0">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Tiêu đề bộ Lookbook <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="VD: Thu Đông 2026, La Parisienne, The Office Edit..."
                value={lookbookForm.title}
                onChange={(e) => setLookbookForm({ ...lookbookForm, title: e.target.value })}
                className="text-xs w-full min-w-0"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <div className="min-w-0">
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Mùa / Phân loại (Season)
                </label>
                <Input
                  placeholder="VD: AW26, Editorial, Essentials..."
                  value={lookbookForm.season}
                  onChange={(e) => setLookbookForm({ ...lookbookForm, season: e.target.value })}
                  className="text-xs w-full min-w-0"
                />
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Đường dẫn (Slug)
                </label>
                <Input
                  placeholder="Tự tạo từ tiêu đề nếu để trống"
                  value={lookbookForm.slug}
                  onChange={(e) => setLookbookForm({ ...lookbookForm, slug: e.target.value })}
                  className="text-xs w-full min-w-0"
                />
              </div>
            </div>

            <div className="min-w-0">
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Phụ đề / Thông điệp (Subtitle)
              </label>
              <Input
                placeholder="VD: Timeless femininity, redefined."
                value={lookbookForm.subtitle}
                onChange={(e) => setLookbookForm({ ...lookbookForm, subtitle: e.target.value })}
                className="text-xs w-full min-w-0"
              />
            </div>

            <div className="min-w-0">
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Mô tả phong cách
              </label>
              <textarea
                rows={3}
                placeholder="Mô tả cảm hứng phối đồ, bảng màu và chất liệu..."
                value={lookbookForm.description}
                onChange={(e) => setLookbookForm({ ...lookbookForm, description: e.target.value })}
                className="w-full min-w-0 rounded-md border border-input bg-background p-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring break-words"
              />
            </div>

            {/* Cover Image Upload / URL */}
            <div className="min-w-0">
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Ảnh bìa bộ Lookbook <span className="text-destructive">*</span>
              </label>
              <Tabs defaultValue="upload" className="w-full min-w-0">
                <TabsList className="grid grid-cols-2 h-8 text-xs mb-2 w-full min-w-0">
                  <TabsTrigger value="upload" className="text-xs">Tải ảnh lên</TabsTrigger>
                  <TabsTrigger value="url" className="text-xs">Dán đường dẫn URL</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-2 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted transition shrink-0">
                      <Upload className="size-3.5" />
                      <span>Chọn file ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setCoverFile(file);
                            setCoverPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                    {coverFile && (
                      <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
                        {coverFile.name}
                      </span>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="url" className="min-w-0">
                  <Input
                    placeholder="https://example.com/cover.jpg"
                    value={lookbookForm.cover_image_url}
                    onChange={(e) => {
                      setLookbookForm({ ...lookbookForm, cover_image_url: e.target.value });
                      setCoverPreview(e.target.value);
                    }}
                    className="text-xs w-full min-w-0"
                  />
                </TabsContent>
              </Tabs>

              {coverPreview && (
                <div className="mt-3 relative aspect-[16/9] rounded-lg overflow-hidden border border-border bg-secondary max-w-full">
                  <img src={coverPreview} alt="Preview" className="h-full w-full object-cover max-w-full" />
                </div>
              )}
            </div>

            {/* Status Select */}
            <div className="min-w-0">
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Trạng thái hiển thị
              </label>
              <select
                value={lookbookForm.status}
                onChange={(e) => setLookbookForm({ ...lookbookForm, status: e.target.value })}
                className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="published">Đã xuất bản (Hiển thị công khai)</option>
                <option value="draft">Bản nháp (Tạm ẩn)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="p-3.5 px-5 border-t border-border/50 bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLookbookDialogOpen(false)}
              disabled={savingLookbook}
            >
              Hủy
            </Button>
            <Button size="sm" onClick={handleSaveLookbook} disabled={savingLookbook}>
              {savingLookbook ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
              {editingLookbook ? "Cập nhật" : "Tạo mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CREATE / EDIT FRAME ITEM */}
      <Dialog open={frameDialogOpen} onOpenChange={setFrameDialogOpen}>
        <DialogContent className="w-full sm:max-w-xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border/50 shrink-0">
            <DialogTitle className="text-base font-semibold break-words pr-6">
              {editingFrame ? "Chỉnh sửa khung hình" : "Thêm khung hình vào Lookbook"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground break-words pr-6 leading-relaxed">
              {selectedLookbook?.title} — Đăng tải hình ảnh thời trang và gắn sản phẩm để khách hàng mua sắm hoặc Thử đồ AI.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 py-4 space-y-4 min-w-0">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Tiêu đề khung hình
              </label>
              <Input
                placeholder="VD: Camel Hour, Parisienne Tweed, Silk Slip Dress..."
                value={frameForm.title}
                onChange={(e) => setFrameForm({ ...frameForm, title: e.target.value })}
                className="text-xs w-full min-w-0"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Chú thích phối đồ / Styling note
              </label>
              <textarea
                rows={2}
                placeholder="VD: Áo len Cashmere Soft · Quần linen ống rộng Dune..."
                value={frameForm.caption}
                onChange={(e) => setFrameForm({ ...frameForm, caption: e.target.value })}
                className="w-full min-w-0 rounded-md border border-input bg-background p-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring break-words"
              />
            </div>

            {/* Frame Image Upload / URL */}
            <div className="min-w-0">
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Hình ảnh khung hình <span className="text-destructive">*</span>
              </label>
              <Tabs defaultValue="upload" className="w-full min-w-0">
                <TabsList className="grid grid-cols-2 h-8 text-xs mb-2 w-full min-w-0">
                  <TabsTrigger value="upload" className="text-xs">Tải ảnh lên</TabsTrigger>
                  <TabsTrigger value="url" className="text-xs">Dán đường dẫn URL</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-2 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted transition shrink-0">
                      <Upload className="size-3.5" />
                      <span>Chọn file ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFrameFile(file);
                            setFramePreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                    {frameFile && (
                      <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
                        {frameFile.name}
                      </span>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="url" className="min-w-0">
                  <Input
                    placeholder="https://example.com/outfit.jpg"
                    value={frameForm.image_url}
                    onChange={(e) => {
                      setFrameForm({ ...frameForm, image_url: e.target.value });
                      setFramePreview(e.target.value);
                    }}
                    className="text-xs w-full min-w-0"
                  />
                </TabsContent>
              </Tabs>

              {framePreview && (
                <div className="mt-3 relative aspect-[3/4] max-h-48 w-fit max-w-full rounded-lg overflow-hidden border border-border bg-secondary mx-auto">
                  <img src={framePreview} alt="Preview" className="h-full object-cover max-w-full" />
                </div>
              )}
            </div>

            {/* Shoppable Product Combobox */}
            <div className="min-w-0">
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Gắn sản phẩm trong ảnh (Shop The Look & Thử đồ AI)
              </label>
              <ProductCombobox
                selectedId={frameForm.product_id}
                onSelect={(id, product) => {
                  setFrameForm((prev) => ({
                    ...prev,
                    product_id: id,
                    title: prev.title || (product ? product.name : prev.title),
                    link_url: prev.link_url || (product ? `/san-pham/${product.slug}` : prev.link_url),
                  }));
                }}
                initialProduct={
                  editingFrame?.product_id
                    ? {
                        id: editingFrame.product_id,
                        name: editingFrame.product_name || "Sản phẩm đã chọn",
                        slug: editingFrame.product_slug,
                      }
                    : undefined
                }
              />
              <p className="text-[11px] text-muted-foreground mt-1 break-words">
                Khi gắn sản phẩm, khách hàng có thể bấm "Shop the Look" và "Thử đồ ảo AI" ngay từ khung hình này.
              </p>
            </div>

            {/* Status Select */}
            <div className="min-w-0">
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Trạng thái hiển thị
              </label>
              <select
                value={frameForm.status}
                onChange={(e) => setFrameForm({ ...frameForm, status: e.target.value })}
                className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="published">Đang hiển thị (Xuất bản)</option>
                <option value="draft">Bản nháp (Tạm ẩn)</option>
              </select>
            </div>
          </div>

          <DialogFooter className="p-3.5 px-5 border-t border-border/50 bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFrameDialogOpen(false)}
              disabled={savingFrame}
            >
              Hủy
            </Button>
            <Button size="sm" onClick={handleSaveFrame} disabled={savingFrame}>
              {savingFrame ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
              {editingFrame ? "Cập nhật" : "Thêm vào Lookbook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
