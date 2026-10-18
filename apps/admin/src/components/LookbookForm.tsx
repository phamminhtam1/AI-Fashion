import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlignLeft,
  ArrowLeft,
  BarChart3,
  Bold,
  CalendarDays,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  Underline,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { adminErrorMessage } from "@/lib/admin-language";
import { adminApi, type AdminLookbookItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { ProductCombobox } from "@/components/ProductCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  SEASONS,
  buildSeason,
  parseSeason,
  seasonYears,
  slugify,
  toDateInputs,
  type LookbookExt,
} from "./lookbook-shared";

type Mode = "create" | "edit";

type FormState = {
  title: string;
  slug: string;
  season: string;
  year: string;
  description: string;
  subtitle: string;
  intro_content: string;
  sort_order: string;
  status: "draft" | "published" | "scheduled";
  publish_date: string;
  publish_time: string;
  unpublish_enabled: boolean;
  unpublish_date: string;
  unpublish_time: string;
  show_on_home: boolean;
  allow_products: boolean;
};

type ProductLite = {
  id: string;
  name: string;
  slug?: string | null;
  sku?: string | null;
  image_url?: string | null;
};

type PendingFrame = { key: string; file: File; preview: string };

const MAX_IMAGE_MB = 10;
const MAX_CREATE_FRAMES = 30;

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  season: "Xuân",
  year: String(new Date().getFullYear()),
  description: "",
  subtitle: "",
  intro_content: "",
  sort_order: "",
  status: "published",
  publish_date: "",
  publish_time: "",
  unpublish_enabled: false,
  unpublish_date: "",
  unpublish_time: "",
  show_on_home: true,
  allow_products: true,
};

const selectClass =
  "h-9 w-full rounded-xs border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "w-full rounded-xs border border-input bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function validImage(file: File) {
  if (!file.type.startsWith("image/")) {
    toast.error(`"${file.name}" không phải file ảnh`);
    return false;
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    toast.error(`"${file.name}" vượt quá ${MAX_IMAGE_MB}MB`);
    return false;
  }
  return true;
}

function moveInArray<T>(arr: T[], from: number, to: number) {
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function SectionCard({
  icon: Icon,
  title,
  description,
  action,
  plain,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  plain?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-xs border border-border bg-card p-5", className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center",
              plain ? "text-foreground" : "rounded-xs bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-4" />
          </span>
          <div>
            <h2 className="admin-subsection-title">{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  counter,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  counter?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {(counter || hint) && (
        <div className="mt-1 flex items-start justify-between gap-3 text-xs text-muted-foreground">
          <span>{hint}</span>
          {counter && <span className="shrink-0">{counter}</span>}
        </div>
      )}
    </div>
  );
}

export function LookbookForm({ mode, lookbookKey }: { mode: Mode; lookbookKey?: string }) {
  const navigate = useNavigate();
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [lookbook, setLookbook] = useState<LookbookExt | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const [items, setItems] = useState<AdminLookbookItem[]>([]);
  const [pending, setPending] = useState<PendingFrame[]>([]);
  const [uploadingFrames, setUploadingFrames] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const [products, setProducts] = useState<ProductLite[]>([]);

  const [frameDialogOpen, setFrameDialogOpen] = useState(false);
  const [editingFrame, setEditingFrame] = useState<AdminLookbookItem | null>(null);
  const [frameForm, setFrameForm] = useState({ title: "", caption: "", product_id: "", link_url: "", status: "published" });
  const [savingFrame, setSavingFrame] = useState(false);

  const hydrate = (lb: LookbookExt) => {
    const { season, year } = parseSeason(lb);
    const pub = toDateInputs(lb.published_at);
    const unpub = toDateInputs(lb.unpublish_at);
    setLookbook(lb);
    setForm({
      ...EMPTY_FORM,
      title: lb.title || "",
      slug: lb.slug || "",
      season: season || "Xuân",
      year: String(lb.year ?? year),
      description: lb.description || "",
      subtitle: lb.subtitle || "",
      intro_content: lb.intro_content || "",
      sort_order: String(lb.sort_order ?? ""),
      status: (lb.status as FormState["status"]) || "published",
      publish_date: pub.date,
      publish_time: pub.time,
      unpublish_enabled: Boolean(lb.unpublish_enabled || lb.unpublish_at),
      unpublish_date: unpub.date,
      unpublish_time: unpub.time,
      show_on_home: lb.show_on_home ?? true,
      allow_products: lb.allow_products ?? true,
    });
    setCoverUrl(lb.cover_image_url || "");
    setCoverPreview(lb.cover_image_url || "");
    setItems(lb.items || []);

    if (lb.attached_products && lb.attached_products.length > 0) {
      setProducts(lb.attached_products);
    } else {
      const map = new Map<string, ProductLite>();
      (lb.items || []).forEach((it) => {
        if (it.product_id && !map.has(it.product_id)) {
          map.set(it.product_id, { id: it.product_id, name: it.product_name || "Sản phẩm", slug: it.product_slug });
        }
      });
      setProducts(Array.from(map.values()));
    }
  };

  const reload = async () => {
    if (!lookbook) return;
    const fresh = (await adminApi.lookbook(lookbook.id)) as LookbookExt;
    hydrate(fresh);
  };

  useEffect(() => {
    if (isEdit && lookbookKey) {
      adminApi
        .lookbook(lookbookKey)
        .then((lb) => hydrate(lb as LookbookExt))
        .catch((err) => {
          toast.error(err instanceof Error ? adminErrorMessage(err) : "Không tìm thấy lookbook");
          navigate({ to: "/lookbook" });
        })
        .finally(() => setLoading(false));
    } else {
      adminApi
        .lookbooks()
        .then((res) => patch({ sort_order: String((res.items?.length || 0) + 1) }))
        .catch(() => patch({ sort_order: "1" }));
    }
  }, [mode, lookbookKey]);

  const pickCover = (file?: File | null) => {
    if (!file || !validImage(file)) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };
  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview("");
    setCoverUrl("");
  };

  const tiles = isEdit
    ? items.map((i) => ({ key: i.id, src: i.image_url }))
    : pending.map((p) => ({ key: p.key, src: p.preview }));

  const handleAddFrames = async (files: FileList | null) => {
    if (!files?.length) return;
    const valid = Array.from(files).filter(validImage);
    if (!valid.length) return;

    if (!isEdit) {
      const room = MAX_CREATE_FRAMES - pending.length;
      if (valid.length > room) toast.error(`Tối đa ${MAX_CREATE_FRAMES} hình ảnh`);
      setPending((prev) => [
        ...prev,
        ...valid.slice(0, Math.max(room, 0)).map((file) => ({
          key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          preview: URL.createObjectURL(file),
        })),
      ]);
      return;
    }

    if (!lookbook) return;
    try {
      setUploadingFrames(true);
      for (let i = 0; i < valid.length; i++) {
        const up = await adminApi.uploadLookbookImage(valid[i]);
        await adminApi.addLookbookItem(lookbook.id, {
          title: null,
          caption: null,
          image_url: up.url,
          product_id: null,
          link_url: null,
          status: "published",
          sort_order: items.length + i + 1,
        });
      }
      toast.success(`Đã thêm ${valid.length} hình ảnh`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Tải ảnh thất bại");
    } finally {
      setUploadingFrames(false);
    }
  };

  const handleMoveFrame = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= tiles.length) return;
    if (!isEdit) {
      setPending((p) => moveInArray(p, from, to));
      return;
    }
    if (!lookbook) return;
    const next = moveInArray(items, from, to).map((it, idx) => ({ ...it, sort_order: idx + 1 }));
    try {
      setReordering(true);
      setItems(next);
      await adminApi.reorderLookbookItems(
        lookbook.id,
        next.map((it) => ({ id: it.id, sort_order: it.sort_order })),
      );
      toast.success(`Đã đổi vị trí hình #${from + 1} sang #${to + 1}`);
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Đổi thứ tự thất bại");
      await reload();
    } finally {
      setReordering(false);
    }
  };

  const handleRemoveTile = async (idx: number) => {
    if (!isEdit) {
      setPending((p) => p.filter((_, i) => i !== idx));
      return;
    }
    const frame = items[idx];
    const ok = await confirm({
      title: `Xóa hình #${idx + 1}?`,
      description: "Bạn có chắc chắn muốn xóa hình ảnh này khỏi lookbook?",
      confirmLabel: "Xóa hình ảnh",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteLookbookItem(frame.id);
      toast.success("Đã xóa hình ảnh");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Xóa hình ảnh thất bại");
    }
  };

  const openFrameDialog = (frame: AdminLookbookItem) => {
    setEditingFrame(frame);
    setFrameForm({
      title: frame.title || "",
      caption: frame.caption || "",
      product_id: frame.product_id || "",
      link_url: frame.link_url || "",
      status: frame.status || "published",
    });
    setFrameDialogOpen(true);
  };

  const handleSaveFrame = async () => {
    if (!editingFrame) return;
    try {
      setSavingFrame(true);
      await adminApi.updateLookbookItem(editingFrame.id, {
        title: frameForm.title.trim() || null,
        caption: frameForm.caption.trim() || null,
        image_url: editingFrame.image_url,
        product_id: frameForm.product_id || null,
        link_url: frameForm.link_url.trim() || null,
        status: frameForm.status,
      });
      toast.success("Đã cập nhật hình ảnh");
      setFrameDialogOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Lưu thất bại");
    } finally {
      setSavingFrame(false);
    }
  };

  const addProduct = (id: string, product?: unknown) => {
    if (!id) return;
    const p = product as ProductLite | undefined;
    setProducts((prev) =>
      prev.some((x) => x.id === id)
        ? prev
        : [...prev, { id, name: p?.name ?? "Sản phẩm", slug: p?.slug, sku: p?.sku, image_url: p?.image_url }],
    );
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Vui lòng nhập tên bộ sưu tập");
    if (!form.description.trim()) return toast.error("Vui lòng nhập mô tả");
    if (!coverFile && !coverUrl) return toast.error("Vui lòng tải lên hình ảnh bìa");

    try {
      setSaving(true);
      let cover = coverUrl;
      if (coverFile) cover = (await adminApi.uploadLookbookImage(coverFile)).url;

      let publishedAtIso: string | null = null;
      if (form.publish_date) {
        publishedAtIso = new Date(`${form.publish_date}T${form.publish_time || "00:00"}:00`).toISOString();
      } else if (form.status === "published") {
        publishedAtIso = new Date().toISOString();
      }

      let unpublishAtIso: string | null = null;
      if (form.unpublish_enabled && form.unpublish_date) {
        unpublishAtIso = new Date(`${form.unpublish_date}T${form.unpublish_time || "00:00"}:00`).toISOString();
      }

      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || slugify(form.title),
        subtitle: form.subtitle.trim() || null,
        season: buildSeason(form.season, form.year) || null,
        year: form.year ? Number(form.year) : null,
        description: form.description.trim() || null,
        cover_image_url: cover,
        status: form.status,
        sort_order: Number(form.sort_order) || 0,
        intro_content: form.intro_content.trim() || null,
        published_at: publishedAtIso,
        unpublish_at: unpublishAtIso,
        unpublish_enabled: form.unpublish_enabled,
        show_on_home: form.show_on_home,
        allow_products: form.allow_products,
        attached_products: products,
      };

      if (isEdit && lookbook) {
        const updated = await adminApi.updateLookbook(lookbook.id, payload);
        toast.success(`Đã cập nhật lookbook "${updated.title}"`);
        setCoverFile(null);
        await reload();
        return;
      }

      const created = await adminApi.createLookbook(payload);
      for (let i = 0; i < pending.length; i++) {
        const up = await adminApi.uploadLookbookImage(pending[i].file);
        await adminApi.addLookbookItem(created.id, {
          title: null,
          caption: null,
          image_url: up.url,
          product_id: null,
          link_url: null,
          status: "published",
          sort_order: i + 1,
        });
      }
      toast.success(`Đã tạo lookbook "${created.title}"`);
      navigate({ to: "/lookbook" });
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Lưu lookbook thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lookbook) return;
    const ok = await confirm({
      title: `Xóa lookbook "${lookbook.title}"?`,
      description: "Thao tác này sẽ xóa lookbook cùng toàn bộ hình ảnh bên trong khỏi hệ thống. Bạn có chắc chắn muốn xóa?",
      confirmLabel: "Xóa vĩnh viễn",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteLookbook(lookbook.id);
      toast.success(`Đã xóa lookbook "${lookbook.title}"`);
      navigate({ to: "/lookbook" });
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Xóa thất bại");
    }
  };

  const goBack = () => navigate({ to: "/lookbook" });
  const websiteUrl = `/lookbook/${form.slug}`;
  const copySlugUrl = () => {
    navigator.clipboard?.writeText(`${window.location.origin}${websiteUrl}`);
    toast.success("Đã sao chép đường dẫn");
  };

  const years = useMemo(() => {
    const list = seasonYears();
    return list.includes(form.year) ? list : [...list, form.year].sort();
  }, [form.year]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ConfirmDialogElement}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" className="mt-1 size-8 p-0" onClick={goBack} title="Quay lại">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="admin-section-title">{isEdit ? "Chỉnh sửa lookbook" : "Thêm lookbook mới"}</h1>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? "Cập nhật thông tin, hình ảnh và sản phẩm cho bộ sưu tập."
                : "Tạo bộ sưu tập lookbook mới, thể hiện câu chuyện và phong cách thời trang của ÉLANE."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <Button variant="outline" size="sm" asChild>
              <a href={websiteUrl} target="_blank" rel="noreferrer">
                <Eye className="mr-1.5 size-3.5" />
                Xem trên website
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={goBack} disabled={saving}>
            Hủy
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}
            {isEdit ? "Lưu thay đổi" : "Lưu lookbook"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* LEFT */}
        <div className="min-w-0 space-y-5">
          <SectionCard icon={FileText} title="Thông tin cơ bản" plain={isEdit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên bộ sưu tập" required>
                <Input
                  value={form.title}
                  maxLength={100}
                  placeholder="VD: Spring Collection 2026"
                  className="text-sm"
                  onChange={(e) => {
                    const title = e.target.value;
                    patch({ title, ...(slugTouched ? {} : { slug: slugify(title) }) });
                  }}
                />
              </Field>
              <Field
                label="Slug"
                required
                hint={
                  <span className="inline-flex items-center gap-1.5">
                    elane.com/lookbook/{form.slug || "..."}
                    <button type="button" onClick={copySlugUrl} title="Sao chép" className="hover:text-foreground">
                      <Copy className="size-3" />
                    </button>
                  </span>
                }
              >
                <Input
                  value={form.slug}
                  maxLength={100}
                  placeholder="spring-collection-2026"
                  className="text-sm"
                  onChange={(e) => {
                    setSlugTouched(true);
                    patch({ slug: slugify(e.target.value) });
                  }}
                />
              </Field>
              <Field label="Mùa" required>
                <select value={form.season} onChange={(e) => patch({ season: e.target.value })} className={selectClass}>
                  {SEASONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Năm" required>
                <select value={form.year} onChange={(e) => patch({ year: e.target.value })} className={selectClass}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Mô tả" required className="mt-4" counter={`${form.description.length}/500 ký tự`}>
              <textarea
                rows={3}
                maxLength={500}
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Mô tả cảm hứng phối đồ, bảng màu và chất liệu..."
                className={textareaClass}
              />
            </Field>
          </SectionCard>

          <SectionCard icon={ImageIcon} title="Hình ảnh bìa" plain={isEdit}>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                pickCover(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {isEdit ? (
              <div className="flex flex-wrap items-center gap-5">
                <div className="aspect-[16/10] w-full max-w-[280px] overflow-hidden rounded-xs bg-secondary">
                  {coverPreview && <img src={coverPreview} alt="Hình ảnh bìa" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium">Thay đổi hình ảnh bìa</p>
                  <p className="text-sm text-muted-foreground">Ảnh hiển thị ở trang chủ và danh sách lookbook.</p>
                  <Button variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
                    <UploadCloud className="mr-1.5 size-3.5" />
                    Thay đổi hình ảnh
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP. Tối thiểu 1200 x 630px. Tối đa {MAX_IMAGE_MB}MB.</p>
                </div>
              </div>
            ) : (
              <div className={cn("grid gap-3", coverPreview && "sm:grid-cols-2")}>
                {coverPreview && (
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xs bg-secondary">
                    <img src={coverPreview} alt="Hình ảnh bìa" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={clearCover}
                      title="Xóa ảnh bìa"
                      className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickCover(e.dataTransfer.files?.[0]);
                  }}
                  className="flex min-h-[150px] flex-col items-center justify-center gap-1.5 rounded-xs border border-dashed border-border p-4 text-center"
                >
                  <UploadCloud className="size-6 text-muted-foreground" />
                  <p className="text-sm">
                    <button type="button" className="font-medium text-primary" onClick={() => coverInputRef.current?.click()}>
                      Nhấn để tải lên
                    </button>{" "}
                    hoặc kéo thả
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP. Tối đa {MAX_IMAGE_MB}MB</p>
                  <Button variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
                    Chọn ảnh
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={ImageIcon}
            title={`Thư viện hình ảnh (${tiles.length})`}
            plain={isEdit}
            action={
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleAddFrames(e.target.files);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xs border border-primary/40 px-3 text-sm font-medium text-primary hover:bg-primary/5">
                  {uploadingFrames ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Thêm hình ảnh
                </span>
              </label>
            }
          >
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {tiles.map((t, idx) => {
                const isDragging = dragIndex === idx;
                const isOver = dragOverIndex === idx && dragIndex !== idx;
                return (
                  <div
                    key={t.key}
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
                    onDragLeave={() => dragOverIndex === idx && setDragOverIndex(null)}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData("text/plain"));
                      setDragIndex(null);
                      setDragOverIndex(null);
                      if (!isNaN(from)) handleMoveFrame(from, idx);
                    }}
                    className={cn(
                      "group relative aspect-[3/4] overflow-hidden rounded-xs bg-secondary transition-all",
                      isDragging && "scale-95 opacity-40",
                      isOver && "ring-2 ring-primary",
                    )}
                  >
                    <img
                      src={t.src}
                      alt={`Hình #${idx + 1}`}
                      onClick={() => isEdit && openFrameDialog(items[idx])}
                      title={isEdit ? "Bấm để sửa chú thích & sản phẩm gắn kèm" : undefined}
                      className={cn("h-full w-full object-cover", isEdit && "cursor-pointer")}
                    />
                    <span className="absolute left-1.5 top-1.5 flex size-6 cursor-grab items-center justify-center rounded-xs bg-white/90 text-foreground shadow-sm">
                      <GripVertical className="size-3.5" />
                    </span>
                    {isEdit && items[idx]?.status !== "published" && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Ẩn
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveTile(idx)}
                      title="Xóa hình ảnh"
                      className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}

              <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 rounded-xs border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleAddFrames(e.target.files);
                    e.target.value = "";
                  }}
                />
                {uploadingFrames ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                <span className="text-xs">Thêm hình ảnh</span>
              </label>
            </div>
          </SectionCard>

          <SectionCard icon={ShoppingCart} title={`Sản phẩm gắn kèm (${products.length})`} plain={isEdit}>
            <div className="max-w-md">
              <ProductCombobox selectedId="" onSelect={addProduct} />
            </div>
            {products.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-xs border border-border p-2">
                    <div className="size-9 shrink-0 overflow-hidden rounded-xs bg-secondary">
                      {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{p.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">#{p.sku || p.id.slice(0, 6)}</p>
                    </div>
                    <button
                      type="button"
                      title="Bỏ sản phẩm"
                      onClick={() => setProducts((prev) => prev.filter((x) => x.id !== p.id))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Chưa có sản phẩm nào được gắn.</p>
            )}
          </SectionCard>

          <SectionCard icon={AlignLeft} title="Nội dung hiển thị" plain={isEdit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tiêu đề giới thiệu (Phụ đề)">
                <Input value={form.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} className="text-sm" />
              </Field>
              <Field label="Thứ tự hiển thị">
                <Input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => patch({ sort_order: e.target.value })}
                  className="text-sm"
                />
              </Field>
            </div>
            <Field label="Nội dung giới thiệu chi tiết" className="mt-4" counter={`${form.intro_content.length}/1000 ký tự`}>
              <textarea
                rows={3}
                maxLength={1000}
                value={form.intro_content}
                onChange={(e) => patch({ intro_content: e.target.value })}
                placeholder="Câu chuyện sáng tạo, chất liệu hoặc concept thiết kế..."
                className={textareaClass}
              />
            </Field>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={form.show_on_home}
                  onChange={(e) => patch({ show_on_home: e.target.checked })}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">Hiển thị trong trang chủ</span>
                  <span className="block text-xs text-muted-foreground">Hiển thị bộ sưu tập này ở section lookbook nổi bật.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={form.allow_products}
                  onChange={(e) => patch({ allow_products: e.target.checked })}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">Cho phép hiển thị sản phẩm gắn kèm</span>
                  <span className="block text-xs text-muted-foreground">Các sản phẩm gắn kèm sẽ hiển thị trong trang chi tiết lookbook.</span>
                </span>
              </label>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT */}
        <div className="min-w-0 space-y-5">
          <SectionCard icon={Info} title="Trạng thái" plain={isEdit}>
            <select
              value={form.status}
              onChange={(e) => patch({ status: e.target.value as FormState["status"] })}
              className={selectClass}
            >
              <option value="published">Đã xuất bản</option>
              <option value="draft">Bản nháp</option>
              <option value="scheduled">Lên lịch xuất bản</option>
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              {form.status === "published"
                ? "Lookbook đang hiển thị trên website và khách hàng có thể xem."
                : form.status === "scheduled"
                  ? "Lookbook sẽ tự động hiển thị khi đến thời gian đã hẹn."
                  : "Lookbook đang ẩn, chưa hiển thị với khách hàng."}
            </p>
          </SectionCard>

          <SectionCard icon={CalendarDays} title="Lịch xuất bản" plain={isEdit}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ngày xuất bản">
                <Input type="date" value={form.publish_date} onChange={(e) => patch({ publish_date: e.target.value })} className="text-sm" />
              </Field>
              <Field label="Giờ xuất bản">
                <Input type="time" value={form.publish_time} onChange={(e) => patch({ publish_time: e.target.value })} className="text-sm" />
              </Field>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.unpublish_enabled}
                onChange={(e) => patch({ unpublish_enabled: e.target.checked })}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">Đặt lịch gỡ bỏ</span>
                <span className="block text-xs text-muted-foreground">Tự động ẩn lookbook khi hết chiến dịch.</span>
              </span>
            </label>
            {form.unpublish_enabled && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Ngày gỡ bỏ">
                  <Input type="date" value={form.unpublish_date} onChange={(e) => patch({ unpublish_date: e.target.value })} className="text-sm" />
                </Field>
                <Field label="Giờ gỡ bỏ">
                  <Input type="time" value={form.unpublish_time} onChange={(e) => patch({ unpublish_time: e.target.value })} className="text-sm" />
                </Field>
              </div>
            )}
          </SectionCard>

          {isEdit && (
            <SectionCard icon={BarChart3} title="Chỉ số hiệu quả" plain>
              <div className="grid grid-cols-3 divide-x divide-border text-center">
                <div className="px-1">
                  <p className="text-xs text-muted-foreground">Số ảnh</p>
                  <p className="mt-1 text-lg font-semibold">{items.length}</p>
                </div>
                <div className="px-1">
                  <p className="text-xs text-muted-foreground">Lượt xem</p>
                  <p className="mt-1 text-lg font-semibold">{(lookbook?.view_count ?? 0).toLocaleString("vi-VN")}</p>
                </div>
                <div className="px-1">
                  <p className="text-xs text-muted-foreground">Sản phẩm</p>
                  <p className="mt-1 text-lg font-semibold">{products.length}</p>
                </div>
              </div>
            </SectionCard>
          )}

          {isEdit && (
            <section className="rounded-xs border border-destructive/30 bg-card p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-destructive">
                <Trash2 className="size-4" />
                Xóa Lookbook
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Hành động này sẽ xóa toàn bộ hình ảnh trong lookbook.
              </p>
              <Button
                variant="outline"
                className="mt-4 w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Xóa vĩnh viễn
              </Button>
            </section>
          )}
        </div>
      </div>

      <Dialog open={frameDialogOpen} onOpenChange={setFrameDialogOpen}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-border/50 p-5 pb-3">
            <DialogTitle className="admin-section-title pr-6">Chỉnh sửa hình ảnh</DialogTitle>
            <DialogDescription className="pr-6 text-sm text-muted-foreground">
              Thêm chú thích phối đồ và gắn sản phẩm để khách mua sắm.
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-5">
            {editingFrame && (
              <img src={editingFrame.image_url} alt="" className="mx-auto max-h-48 rounded-xs object-cover" />
            )}
            <Field label="Tiêu đề">
              <Input value={frameForm.title} onChange={(e) => setFrameForm({ ...frameForm, title: e.target.value })} className="text-sm" />
            </Field>
            <Field label="Chú thích phối đồ">
              <textarea rows={2} value={frameForm.caption} onChange={(e) => setFrameForm({ ...frameForm, caption: e.target.value })} className={textareaClass} />
            </Field>
            <Field label="Gắn sản phẩm">
              <ProductCombobox
                selectedId={frameForm.product_id}
                onSelect={(id, product) => {
                  const p = product as ProductLite | undefined;
                  setFrameForm((prev) => ({
                    ...prev,
                    product_id: id,
                    title: prev.title || p?.name || prev.title,
                    link_url: prev.link_url || (p?.slug ? `/san-pham/${p.slug}` : prev.link_url),
                  }));
                  addProduct(id, product);
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
            </Field>
            <Field label="Liên kết">
              <Input value={frameForm.link_url} onChange={(e) => setFrameForm({ ...frameForm, link_url: e.target.value })} placeholder="/san-pham/..." className="text-sm" />
            </Field>
            <Field label="Trạng thái">
              <select value={frameForm.status} onChange={(e) => setFrameForm({ ...frameForm, status: e.target.value })} className={selectClass}>
                <option value="published">Đang hiển thị</option>
                <option value="draft">Bản nháp (tạm ẩn)</option>
              </select>
            </Field>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/50 bg-muted/20 px-5 py-3.5">
            <Button variant="outline" size="sm" onClick={() => setFrameDialogOpen(false)} disabled={savingFrame}>
              Hủy
            </Button>
            <Button size="sm" onClick={handleSaveFrame} disabled={savingFrame}>
              {savingFrame && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Cập nhật
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
