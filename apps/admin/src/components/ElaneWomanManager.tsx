import { adminErrorMessage } from "@/lib/admin-language";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { resolveAdminPath } from "@/lib/routes";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  Underline,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { adminApi, type AdminProduct, type ElaneWomanPost } from "@/lib/api";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { ProductCombobox } from "@/components/ProductCombobox";

// ─── Types & helpers ──────────────────────────────────────────────────────────
//
// Các field chưa có trong API (chủ đề, tóm tắt, nội dung, nhiều media, nhiều sản phẩm,
// lượt xem/thích/bình luận, lên lịch…) được đọc theo kiểu tuỳ chọn và có chỗ
// `TODO(api)` để bạn nối sau.

type PostExtra = ElaneWomanPost & {
  topic?: string | null;
  summary?: string | null;
  content?: string | null;
  products?: AttachedProduct[];
  media?: Array<{ url: string; type?: "image" | "video" }>;
  published_at?: string | null;
  created_at?: string | null;
  scheduled_at?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
};

type AttachedProduct = {
  id: string;
  name: string;
  sku?: string | null;
  image_url?: string | null;
  slug?: string | null;
};

type MediaItem = { id: string; url: string; type: "image" | "video"; file?: File };

type StatusUi = "published" | "draft" | "scheduled" | "hidden";

export type ElaneWomanExtra = {
  topic: string;
  summary: string;
  content_html: string;
  media: MediaItem[];
  products: AttachedProduct[];
  status_ui: StatusUi;
  scheduled_at: string | null;
};

type PostValues = {
  title: string;
  uploadFile: File | null;
  imageUrl: string;
  linkUrl: string;
  productId: string;
  instagramUrl: string;
  sortOrder: number;
  status: "published" | "draft";
};

const TOPICS = ["Phong cách", "Xu hướng", "Cảm hứng", "Câu chuyện", "Gợi ý phối đồ"];

const TOPIC_TINTS = [
  "bg-blue-500/10 text-blue-700",
  "bg-red-500/10 text-red-700",
  "bg-orange-500/10 text-orange-700",
  "bg-cyan-500/10 text-cyan-700",
  "bg-pink-500/10 text-pink-700",
];

const STATUS_UI: Record<StatusUi, { label: string; pill: string; dot: string }> = {
  published: { label: "Đã xuất bản", pill: "bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" },
  draft: { label: "Bản nháp", pill: "bg-violet-500/10 text-violet-700", dot: "bg-violet-500" },
  scheduled: { label: "Lên lịch", pill: "bg-orange-500/10 text-orange-700", dot: "bg-orange-500" },
  hidden: { label: "Đã ẩn", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

const TITLE_MAX = 200;
const SUMMARY_MAX = 300;
const CONTENT_MAX = 5000;
const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

function statusOf(p: ElaneWomanPost): StatusUi {
  const s = String(p.status);
  return s === "published" || s === "scheduled" || s === "hidden" ? s : "draft";
}

function stripHtml(html?: string | null) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function postDate(p: PostExtra) {
  return p.published_at ?? p.created_at ?? null;
}

function fmtDateParts(iso?: string | null) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
}

function topicTint(topic?: string | null) {
  return TOPIC_TINTS[(topic?.charCodeAt(0) ?? 0) % TOPIC_TINTS.length];
}

function productSku(p: AdminProduct) {
  const x = p as AdminProduct & { sku?: string };
  return x.sku ?? p.variants?.[0]?.sku ?? null;
}

function productImage(p: AdminProduct) {
  return p.images?.[0] ?? p.media?.[0]?.url ?? null;
}

function pageItems(cur: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (cur >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", cur - 1, cur, cur + 1, "…", total];
}

function SelectBox({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-xs border border-slate-200 bg-white pl-3 pr-9 text-sm outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function Pager({
  page,
  totalPages,
  total,
  pageSize,
  shown,
  onPage,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  shown: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + shown;
  const btn =
    "grid size-9 place-items-center rounded-xs border border-slate-200 bg-white text-sm transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3.5">
      <span className="text-sm text-muted-foreground">
        Hiển thị {from} - {to} của {total.toLocaleString("vi-VN")} bài đăng
      </span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          <ChevronLeft className="size-4" />
        </button>
        {pageItems(page, totalPages).map((it, i) =>
          it === "…" ? (
            <span key={`e${i}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={it}
              type="button"
              onClick={() => onPage(it)}
              className={cn(btn, it === page && "border-primary bg-primary text-primary-foreground hover:bg-primary")}
            >
              {it}
            </button>
          ),
        )}
        <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <ChevronRight className="size-4" />
        </button>
        <SelectBox
          label="Số dòng mỗi trang"
          value={String(pageSize)}
          onChange={(v) => onPageSize(Number(v))}
          className="ml-2 w-32 [&_select]:h-9"
          options={[5, 10, 20, 50].map((n) => ({ value: String(n), label: `${n} / trang` }))}
        />
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
        destructive && "text-destructive hover:bg-destructive/10",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xs border border-slate-200 bg-white p-4 shadow-xs", className)}>
      <h2 className="admin-section-title text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      <div className="mt-2">{children}</div>
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

// ─── Rich text editor (khung — dùng contentEditable) ─────────────────────────
// TODO(api): thay bằng trình soạn thảo bạn dùng (TipTap, Quill…) và sanitize HTML ở server.

function RichEditor({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (html: string) => void;
  max: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value;
    // chỉ nạp giá trị ban đầu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML ?? "");
  }

  const tool =
    "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";
  const length = stripHtml(value).length;

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-white focus-within:ring-1 focus-within:ring-ring">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-secondary/30 px-2 py-1.5">
        <select
          aria-label="Kiểu đoạn"
          className="h-8 rounded-md border-0 bg-transparent px-2 text-sm outline-none hover:bg-secondary"
          defaultValue="p"
          onChange={(e) => exec("formatBlock", `<${e.target.value}>`)}
        >
          <option value="p">Đoạn văn</option>
          <option value="h2">Tiêu đề 2</option>
          <option value="h3">Tiêu đề 3</option>
        </select>
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" className={tool} title="In đậm" onClick={() => exec("bold")}>
          <Bold className="size-4" />
        </button>
        <button type="button" className={tool} title="In nghiêng" onClick={() => exec("italic")}>
          <Italic className="size-4" />
        </button>
        <button type="button" className={tool} title="Gạch chân" onClick={() => exec("underline")}>
          <Underline className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" className={tool} title="Danh sách chấm" onClick={() => exec("insertUnorderedList")}>
          <List className="size-4" />
        </button>
        <button type="button" className={tool} title="Danh sách số" onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          className={tool}
          title="Chèn liên kết"
          onClick={() => {
            const url = window.prompt("Nhập đường dẫn liên kết");
            if (url) exec("createLink", url);
          }}
        >
          <LinkIcon className="size-4" />
        </button>
        <button
          type="button"
          className={tool}
          title="Chèn ảnh từ URL"
          onClick={() => {
            const url = window.prompt("Nhập URL hình ảnh");
            if (url) exec("insertImage", url);
          }}
        >
          <ImageIcon className="size-4" />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder="Nhập nội dung bài đăng…"
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        className="min-h-48 max-h-[520px] overflow-y-auto p-3.5 text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:max-w-full [&_img]:rounded-lg [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      />
      <p className={cn("px-3.5 pb-2 text-right text-xs", length > max ? "text-destructive" : "text-muted-foreground")}>
        {length}/{max}
      </p>
    </div>
  );
}

// ─── Form (Thêm / Chỉnh sửa bài đăng) ────────────────────────────────────────

function ElaneWomanForm({
  editing,
  nextSortOrder,
  saving,
  onCancel,
  onSubmit,
}: {
  editing: ElaneWomanPost | null;
  nextSortOrder: number;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: PostValues, extra: ElaneWomanExtra) => Promise<void>;
}) {
  const d = editing as PostExtra | null;
  const inputCls = "h-9 rounded-xs border-slate-200 bg-white px-3 text-sm";

  const [title, setTitle] = useState(editing?.title ?? "");
  const [topic, setTopic] = useState(d?.topic ?? "");
  const [summary, setSummary] = useState(d?.summary ?? "");
  const [contentHtml, setContentHtml] = useState(d?.content ?? "");
  const [media, setMedia] = useState<MediaItem[]>(() => {
    if (d?.media?.length) {
      return d.media.map((m, i) => ({ id: `m${i}`, url: m.url, type: m.type ?? "image" }));
    }
    return editing?.image_url ? [{ id: "cover", url: editing.image_url, type: "image" as const }] : [];
  });
  const [urlInput, setUrlInput] = useState("");
  const [instagramUrl, setInstagramUrl] = useState(editing?.instagram_url ?? "");
  const [attached, setAttached] = useState<AttachedProduct[]>(() => {
    if (d?.products?.length) return d.products;
    return editing?.product_id
      ? [
        {
          id: editing.product_id,
          name: editing.product_name || "Sản phẩm đã gắn",
          slug: editing.product_slug ?? null,
        },
      ]
      : [];
  });
  const [linkUrl, setLinkUrl] = useState(editing?.link_url ?? "");
  const [sortOrder, setSortOrder] = useState(editing?.sort_order ?? nextSortOrder);
  const [statusUi, setStatusUi] = useState<StatusUi>(editing ? statusOf(editing) : "published");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[] | null | undefined, replaceCover = false) {
    if (!files) return;
    const added: MediaItem[] = [];
    for (const file of Array.from(files)) {
      const isImg = /^image\/(png|jpe?g|webp|gif)$/.test(file.type);
      const isVideo = file.type === "video/mp4";
      if (!isImg && !isVideo) {
        toast.error(`${file.name}: chỉ hỗ trợ JPG, PNG, WebP, GIF hoặc MP4`);
        continue;
      }
      if (file.size > MEDIA_MAX_BYTES) {
        toast.error(`${file.name}: tối đa 10MB`);
        continue;
      }
      added.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: URL.createObjectURL(file),
        type: isVideo ? "video" : "image",
        file,
      });
    }
    if (!added.length) return;
    // TODO(api): upload từng media lên server (cover dùng luồng FormData hiện có).
    setMedia((m) => (replaceCover ? [added[0]!, ...m.slice(1), ...added.slice(1)] : [...m, ...added]));
  }

  function applyUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setMedia((m) => [{ id: `url-${Date.now()}`, url, type: "image" }, ...m.slice(m.length ? 1 : 0)]);
    setUrlInput("");
  }

  function addProduct(id: string, p?: AdminProduct) {
    if (!id || !p) return;
    setAttached((list) =>
      list.some((x) => x.id === id)
        ? list
        : [
          ...list,
          { id, name: p.name, sku: productSku(p), image_url: productImage(p), slug: p.slug ?? null },
        ],
    );
    if (!linkUrl && p.slug) setLinkUrl(`/san-pham/${p.slug}`);
  }

  async function submit() {
    if (!editing && !title.trim()) {
      toast.error("Nhập tiêu đề bài đăng");
      return;
    }
    const cover = media[0];
    if (!cover) {
      toast.error("Vui lòng thêm ít nhất một hình ảnh");
      return;
    }
    if (cover.type === "video") {
      toast.error("Ảnh bìa (ảnh đầu tiên) phải là hình ảnh");
      return;
    }
    const status: PostValues["status"] = statusUi === "published" ? "published" : "draft";
    await onSubmit(
      {
        title: title.trim(),
        uploadFile: cover.file ?? null,
        imageUrl: cover.file ? "" : cover.url,
        linkUrl: linkUrl.trim(),
        productId: attached[0]?.id ?? "",
        instagramUrl: instagramUrl.trim(),
        sortOrder,
        // TODO(api): "scheduled" / "hidden" hiện được lưu như "draft".
        status,
      },
      {
        topic,
        summary: summary.trim(),
        content_html: contentHtml,
        media,
        products: attached,
        status_ui: statusUi,
        scheduled_at: scheduledLocal ? new Date(scheduledLocal).toISOString() : null,
      },
    );
  }

  return (
    <div className="space-y-5 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            className="mt-0.5 size-9 shrink-0 rounded-xs border-slate-200 bg-white"
            onClick={onCancel}
            aria-label="Quay lại"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="admin-page-title text-slate-900">
              {editing ? "Chỉnh sửa bài đăng" : "Thêm bài đăng ÉLANEwoman"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {editing
                ? "Cập nhật thông tin bài đăng ÉLANEwoman."
                : "Tạo bài đăng mới về phong cách, cảm hứng và câu chuyện phụ nữ ÉLANE."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-medium" onClick={onCancel}>
            Hủy
          </Button>
          {editing && (
            <Button variant="outline" className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-medium" disabled={!linkUrl} asChild={!!linkUrl}>
              {linkUrl ? (
                <a href={linkUrl} target="_blank" rel="noreferrer">
                  <Eye className="size-4" />
                  Xem trên website
                </a>
              ) : (
                <span>
                  <Eye className="size-4" />
                  Xem trên website
                </span>
              )}
            </Button>
          )}
          <Button className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white hover:bg-[#53389e]" disabled={saving} onClick={() => void submit()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : editing ? <Save className="size-4" /> : <Plus className="size-4" />}
            {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Lưu bài đăng"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
        {/* LEFT */}
        <div className="space-y-5">
          <PCard title="Thông tin cơ bản">
            <div className="space-y-5">
              <PField label="Tiêu đề" required>
                <Input
                  className={inputCls}
                  placeholder="Nhập tiêu đề bài đăng…"
                  maxLength={TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <span className="mt-1 block text-right text-xs text-muted-foreground">
                  {title.length}/{TITLE_MAX}
                </span>
              </PField>

              <PField label="Chủ đề">
                {/* TODO(api): danh sách chủ đề lấy từ backend */}
                <SelectBox
                  label="Chủ đề"
                  value={topic}
                  onChange={setTopic}
                  className="[&_select]:h-9 [&_select]:rounded-xs"
                  options={[{ value: "", label: "Chọn chủ đề" }, ...TOPICS.map((t) => ({ value: t, label: t }))]}
                />
              </PField>

              <PField label="Tóm tắt">
                <textarea
                  className="min-h-24 w-full resize-y rounded-lg border border-input bg-white p-3.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                  placeholder="Nhập tóm tắt bài đăng…"
                  maxLength={SUMMARY_MAX}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
                <span className="mt-1 block text-right text-xs text-muted-foreground">
                  {summary.length}/{SUMMARY_MAX}
                </span>
              </PField>

              <div>
                <span className="text-sm font-medium">Nội dung</span>
                <div className="mt-2">
                  <RichEditor value={contentHtml} onChange={setContentHtml} max={CONTENT_MAX} />
                </div>
              </div>
            </div>
          </PCard>
        </div>

        {/* RIGHT */}
        <div className="space-y-5">
          <PCard title="Hình ảnh & Media">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={replaceRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files, true);
                e.target.value = "";
              }}
            />

            {editing ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2 border-0 bg-primary/10 text-primary hover:bg-primary/15"
                onClick={() => replaceRef.current?.click()}
              >
                <Plus className="size-4" />
                Thay đổi ảnh
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
                  dragOver ? "border-primary bg-accent/30" : "border-border bg-secondary/30 hover:bg-secondary/50",
                )}
              >
                <ImageIcon className="size-7 text-muted-foreground" />
                <span className="text-sm">Kéo thả hình ảnh, video hoặc chọn file</span>
                <span className="text-xs text-muted-foreground">JPG, PNG, MP4. Tối đa 10MB.</span>
              </button>
            )}

            <div className="mt-3 grid grid-cols-4 gap-2.5">
              {media.map((m, i) => (
                <div key={m.id} className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-secondary">
                  {m.type === "video" ? (
                    <>
                      <video src={m.url} muted className="size-full object-cover" />
                      <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                        <Play className="size-6 fill-current" />
                      </span>
                    </>
                  ) : (
                    <img src={m.url} alt={`Media ${i + 1}`} className="size-full object-cover" />
                  )}
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
                      Ảnh bìa
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Xóa media"
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                    onClick={() => setMedia((list) => list.filter((x) => x.id !== m.id))}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg bg-primary/10 text-xs text-primary transition-colors hover:bg-primary/15"
              >
                <Plus className="size-5" />
                Thêm ảnh
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <Input
                className="h-10 rounded-lg bg-white"
                placeholder="Hoặc dán URL ảnh bìa (https://…)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyUrl();
                  }
                }}
              />
              <Button type="button" variant="outline" className="h-10 shrink-0 bg-white" onClick={applyUrl}>
                Dùng URL
              </Button>
            </div>
          </PCard>

          <PCard title="Liên kết Instagram (tùy chọn)">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-white">
                <LinkIcon className="size-3.5" />
              </span>
              <Input
                className="h-11 rounded-lg bg-white pl-11"
                placeholder="https://www.instagram.com/p/…"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
              />
            </div>
          </PCard>

          <PCard title={`Sản phẩm gắn kèm${attached.length ? ` (${attached.length})` : " (tùy chọn)"}`}>
            {/* Chọn sản phẩm: dùng ProductCombobox như cũ; có thể gắn nhiều sản phẩm trên giao diện.
                TODO(api): hiện chỉ sản phẩm đầu tiên được gửi qua product_id. */}
            <ProductCombobox selectedId="" onSelect={addProduct} initialProduct={null} />

            {attached.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                Chưa gắn sản phẩm nào.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {attached.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 p-2.5">
                    <span className="grid size-5 shrink-0 place-items-center text-primary">
                      <Tag className="size-4" />
                    </span>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="size-11 rounded-md border border-border object-cover" />
                    ) : (
                      <span className="grid size-11 place-items-center rounded-md border border-border bg-secondary text-muted-foreground">
                        <ImageIcon className="size-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      {p.sku && <p className="text-xs text-muted-foreground">{p.sku}</p>}
                    </div>
                    <button
                      type="button"
                      aria-label={`Bỏ ${p.name}`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setAttached((list) => list.filter((x) => x.id !== p.id))}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PCard>

          <PCard title="Cài đặt hiển thị">
            <div className="space-y-5">
              <div>
                <span className="text-sm font-medium">Trạng thái</span>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      ["published", "Xuất bản", "Hiển thị trên trang chủ"],
                      ["draft", "Bản nháp", "Lưu để chỉnh sửa sau"],
                      ["scheduled", "Lên lịch", "Tự xuất bản theo thời gian"],
                      ["hidden", "Ẩn", "Tạm ẩn khỏi website"],
                    ] as const
                  ).map(([id, label, desc]) => (
                    <label key={id} className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="radio"
                        name="post_status"
                        className="mt-1 size-4 accent-primary"
                        checked={statusUi === id}
                        onChange={() => setStatusUi(id)}
                      />
                      <span>
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="block text-xs text-muted-foreground">{desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {statusUi === "scheduled" && (
                  <div className="mt-3">
                    {/* TODO(api): lưu thời gian lên lịch */}
                    <Input
                      className="h-10 rounded-lg bg-white"
                      type="datetime-local"
                      value={scheduledLocal}
                      onChange={(e) => setScheduledLocal(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <PField label="Đường dẫn khi click vào ảnh" hint="Ví dụ: /san-pham/dam-lua-noir hoặc một URL đầy đủ">
                <Input
                  className="h-10 rounded-lg bg-white"
                  placeholder="/san-pham/…"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </PField>
              <PField label="Thứ tự hiển thị">
                <Input
                  className="h-10 rounded-lg bg-white"
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                />
              </PField>
            </div>
          </PCard>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type PostTab = "all" | StatusUi;

export function ElaneWomanManager({ permissions = [] }: { permissions?: string[] }) {
  const canWrite = permissions.includes("*") || permissions.includes("product.write");
  const [posts, setPosts] = useState<ElaneWomanPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);

  const [tab, setTab] = useState<PostTab>("all");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"order" | "newest" | "views">("order");
  const [draftSort, setDraftSort] = useState<"order" | "newest" | "views">("order");
  const [onlyWithProducts, setOnlyWithProducts] = useState(false);
  const [draftOnlyProducts, setDraftOnlyProducts] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ElaneWomanPost | null>(null);
  const [saving, setSaving] = useState(false);

  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const location = useLocation();
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const resPosts = await adminApi.elaneWomanPosts();
      setPosts(Array.isArray(resPosts?.items) ? resPosts.items : []);
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Không tải được danh sách bài đăng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tab, query, topicFilter, dateFrom, dateTo, sortBy, onlyWithProducts, pageSize]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const topics = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts as PostExtra[]) if (p.topic) set.add(p.topic);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [posts]);

  const base = useMemo(() => {
    let list = posts as PostExtra[];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        `${p.title ?? ""} ${p.summary ?? ""} ${stripHtml(p.content)} ${p.product_name ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (topicFilter !== "all") list = list.filter((p) => p.topic === topicFilter);
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`).getTime();
      list = list.filter((p) => {
        const dt = postDate(p);
        return dt ? new Date(dt).getTime() >= from : false;
      });
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999`).getTime();
      list = list.filter((p) => {
        const dt = postDate(p);
        return dt ? new Date(dt).getTime() <= to : false;
      });
    }
    if (onlyWithProducts) list = list.filter((p) => (p.products?.length ?? 0) > 0 || !!p.product_id);
    const sorted = [...list];
    if (sortBy === "newest") {
      sorted.sort((a, b) => new Date(postDate(b) ?? 0).getTime() - new Date(postDate(a) ?? 0).getTime());
    } else if (sortBy === "views") {
      sorted.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    } else {
      sorted.sort((a, b) => a.sort_order - b.sort_order);
    }
    return sorted;
  }, [posts, query, topicFilter, dateFrom, dateTo, onlyWithProducts, sortBy]);

  const counts = useMemo(() => {
    const n: Record<PostTab, number> = { all: base.length, published: 0, draft: 0, scheduled: 0, hidden: 0 };
    for (const p of base) n[statusOf(p)] += 1;
    return n;
  }, [base]);

  const visible = useMemo(
    () => (tab === "all" ? base : base.filter((p) => statusOf(p) === tab)),
    [base, tab],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const paged = useMemo(() => visible.slice((page - 1) * pageSize, page * pageSize), [visible, page, pageSize]);

  const allPageSelected = paged.length > 0 && paged.every((p) => selected.has(p.id));
  const somePageSelected = paged.some((p) => selected.has(p.id));

  const previewPost = (visible.find((p) => p.id === selectedId) ?? visible[0] ?? null) as PostExtra | null;
  const previewImages = previewPost
    ? previewPost.media?.length
      ? previewPost.media.filter((m) => m.type !== "video").map((m) => m.url)
      : [previewPost.image_url]
    : [];

  useEffect(() => {
    setPreviewIdx(0);
  }, [previewPost?.id]);

  const advancedCount = (sortBy !== "order" ? 1 : 0) + (onlyWithProducts ? 1 : 0);

  // ── Routing ────────────────────────────────────────────────────────────────

  const openCreateInternal = useCallback(() => {
    setEditingPost(null);
    setFormOpen(true);
  }, []);

  const openEditInternal = useCallback((post: ElaneWomanPost) => {
    setEditingPost(post);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    navigate({ to: "/elanewoman" });
  }, [navigate]);

  useEffect(() => {
    const route = resolveAdminPath(location.pathname);
    if (route.tabId !== "elanewoman") return;

    if (route.action === "create") {
      openCreateInternal();
    } else if (route.action === "edit" && route.subParam) {
      const found = posts.find((p) => p.id === route.subParam);
      if (found) openEditInternal(found);
    } else {
      setFormOpen(false);
    }
  }, [location.pathname, posts, openCreateInternal, openEditInternal]);

  const openCreate = () => navigate({ to: "/elanewoman/them" });
  const openEdit = (post: ElaneWomanPost) => navigate({ to: `/elanewoman/sua/${post.id}` });

  // ── Actions ────────────────────────────────────────────────────────────────

  async function save(values: PostValues, _extra: ElaneWomanExtra) {
    // TODO(api): gửi thêm `_extra` (chủ đề, tóm tắt, nội dung, nhiều media, nhiều sản phẩm,
    // lịch xuất bản…) khi backend hỗ trợ.
    try {
      setSaving(true);
      const { title, uploadFile, imageUrl, linkUrl, productId, instagramUrl, sortOrder, status } = values;

      const buildFormData = () => {
        const fd = new FormData();
        fd.append("file", uploadFile as File);
        if (title) fd.append("title", title);
        if (linkUrl) fd.append("link_url", linkUrl);
        if (productId) fd.append("product_id", productId);
        if (instagramUrl) fd.append("instagram_url", instagramUrl);
        fd.append("sort_order", String(sortOrder));
        fd.append("status", status);
        return fd;
      };

      if (editingPost) {
        if (uploadFile) {
          await adminApi.patchElaneWomanPost(editingPost.id, buildFormData());
        } else {
          await adminApi.patchElaneWomanPost(editingPost.id, {
            title: title || null,
            image_url: imageUrl || "",
            link_url: linkUrl || null,
            product_id: productId || null,
            instagram_url: instagramUrl || null,
            sort_order: sortOrder,
            status,
          });
        }
        toast.success("Cập nhật bài đăng thành công");
      } else {
        if (uploadFile) {
          await adminApi.createElaneWomanPost(buildFormData());
        } else {
          await adminApi.createElaneWomanPost({
            title: title || null,
            image_url: imageUrl,
            link_url: linkUrl || null,
            product_id: productId || null,
            instagram_url: instagramUrl || null,
            sort_order: sortOrder,
            status,
          });
        }
        toast.success("Thêm bài đăng mới thành công");
      }

      closeForm();
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Có lỗi xảy ra khi lưu bài đăng");
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = (post: ElaneWomanPost) => {
    confirm({
      title: "Xóa bài đăng ÉLANEwoman?",
      description: `Bạn có chắc chắn muốn xóa bài đăng "${post.title || "này"}"?`,
      confirmLabel: "Xóa bài đăng",
      onConfirm: async () => {
        try {
          await adminApi.deleteElaneWomanPost(post.id);
          toast.success("Đã xóa bài đăng");
          await loadData();
        } catch (err) {
          toast.error(err instanceof Error ? adminErrorMessage(err) : "Xóa bài đăng thất bại");
        }
      },
    });
  };

  const handleToggleStatus = async (post: ElaneWomanPost) => {
    const nextStatus = post.status === "published" ? "draft" : "published";
    try {
      await adminApi.patchElaneWomanPost(post.id, { status: nextStatus });
      toast.success(nextStatus === "published" ? "Đã công khai trên trang chủ" : "Đã chuyển về bản nháp");
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: nextStatus } : p)));
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Thao tác thất bại");
    }
  };

  const publishedPosts = useMemo(() => posts.filter((p) => p.status === "published"), [posts]);

  const movePost = async (post: ElaneWomanPost, dir: -1 | 1) => {
    const fromIdx = publishedPosts.findIndex((p) => p.id === post.id);
    const toIdx = fromIdx + dir;
    if (fromIdx < 0 || toIdx < 0 || toIdx >= publishedPosts.length) return;

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
      await adminApi.reorderElaneWomanPosts(updatedPublished.map((p) => ({ id: p.id, sort_order: p.sort_order })));
      toast.success(`Đã đổi vị trí #${fromIdx + 1} sang #${toIdx + 1}`);
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Cập nhật thứ tự thất bại");
      await loadData();
    } finally {
      setReordering(false);
    }
  };

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of paged) {
        if (allPageSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  function resetFilters() {
    setTab("all");
    setQueryInput("");
    setQuery("");
    setTopicFilter("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("order");
    setOnlyWithProducts(false);
  }

  // ── Form view ──────────────────────────────────────────────────────────────

  if (formOpen) {
    const nextOrder = posts.length > 0 ? Math.max(0, ...posts.map((p) => p.sort_order || 0)) + 1 : 1;
    return (
      <>
        <ElaneWomanForm
          key={editingPost?.id ?? "new"}
          editing={editingPost}
          nextSortOrder={nextOrder}
          saving={saving}
          onCancel={closeForm}
          onSubmit={save}
        />
        {ConfirmDialogElement}
      </>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────

  const pv = previewPost;
  const pvDate = pv ? fmtDateParts(postDate(pv)) : null;

  return (
    <div className="space-y-5 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div>
            <h1 className="admin-page-title text-slate-900">ÉLANEwoman</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quản lý các bài đăng về phong cách, cảm hứng và câu chuyện phụ nữ ÉLANE.
            </p>
          </div>
        </div>
        {canWrite && <Button asChild className="h-9 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white hover:bg-[#53389e]">
          <a
            href="/elanewoman/them"
            onClick={(e) => {
              e.preventDefault();
              openCreate();
            }}
          >
            <Plus className="mr-2 size-4" /> Thêm bài đăng
          </a>
        </Button>}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          {/* Tabs */}
          <div className="flex flex-wrap gap-6 border-b border-border px-5 pt-3">
            {(
              [
                ["all", "Tất cả"],
                ["published", "Đã xuất bản"],
                ["draft", "Bản nháp"],
                ["scheduled", "Lên lịch"],
                ["hidden", "Đã ẩn"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label} ({counts[id]})
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 rounded-lg border-border/70 bg-white pl-9 pr-9"
                  placeholder="Tìm kiếm theo tiêu đề, nội dung…"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                />
                {queryInput && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setQueryInput("")}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <SelectBox
                label="Chủ đề"
                value={topicFilter}
                onChange={setTopicFilter}
                className="w-44"
                options={[{ value: "all", label: "Tất cả chủ đề" }, ...topics.map((t) => ({ value: t, label: t }))]}
              />
              <SelectBox
                label="Trạng thái"
                value={tab}
                onChange={(v) => setTab(v as PostTab)}
                className="w-48"
                options={[
                  { value: "all", label: "Tất cả trạng thái" },
                  { value: "published", label: "Đã xuất bản" },
                  { value: "draft", label: "Bản nháp" },
                  { value: "scheduled", label: "Lên lịch" },
                  { value: "hidden", label: "Đã ẩn" },
                ]}
              />

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 gap-2 rounded-lg border-border/70 bg-white font-normal",
                      (dateFrom || dateTo) && "border-primary/40 bg-accent/40",
                    )}
                  >
                    <Calendar className="size-4" />
                    {dateFrom || dateTo
                      ? `${dateFrom ? new Date(dateFrom).toLocaleDateString("vi-VN") : "…"} – ${dateTo ? new Date(dateTo).toLocaleDateString("vi-VN") : "…"}`
                      : "Chọn khoảng thời gian"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-3 p-4">
                  <label className="block text-xs font-medium">
                    Từ ngày
                    <Input type="date" className="mt-1.5 h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </label>
                  <label className="block text-xs font-medium">
                    Đến ngày
                    <Input type="date" className="mt-1.5 h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    Xóa khoảng thời gian
                  </Button>
                </PopoverContent>
              </Popover>

              <Popover
                onOpenChange={(o) => {
                  if (o) {
                    setDraftSort(sortBy);
                    setDraftOnlyProducts(onlyWithProducts);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 gap-2 rounded-lg border-border/70 bg-white",
                      advancedCount > 0 && "border-primary/40 bg-accent/40",
                    )}
                  >
                    <SlidersHorizontal className="size-4" />
                    Lọc
                    {advancedCount > 0 && (
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {advancedCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[300px] p-0 shadow-xl">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold">Bộ lọc nâng cao</p>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium">Sắp xếp</span>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none"
                        value={draftSort}
                        onChange={(e) => setDraftSort(e.target.value as typeof draftSort)}
                      >
                        <option value="order">Thứ tự hiển thị</option>
                        <option value="newest">Mới đăng nhất</option>
                        <option value="views">Nhiều lượt xem nhất</option>
                      </select>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded-xs"
                        checked={draftOnlyProducts}
                        onChange={(e) => setDraftOnlyProducts(e.target.checked)}
                      />
                      Chỉ bài có sản phẩm gắn kèm
                    </label>
                  </div>
                  <div className="flex justify-between border-t border-border px-4 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSortBy("order");
                        setOnlyWithProducts(false);
                        setDraftSort("order");
                        setDraftOnlyProducts(false);
                      }}
                    >
                      Xóa lọc
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSortBy(draftSort);
                        setOnlyWithProducts(draftOnlyProducts);
                      }}
                    >
                      Áp dụng
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
              <thead className="bg-slate-50/80">
                <tr className="border-b border-slate-200 text-sm font-semibold tracking-tight text-slate-700">
                  <th className="w-12 px-4 py-3.5">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      className="size-4 rounded-xs"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected && !allPageSelected;
                      }}
                      onChange={togglePage}
                    />
                  </th>
                  <th className="w-10 px-3 py-3.5">#</th>
                  <th className="w-24 px-4 py-3.5">Hình ảnh</th>
                  <th className="px-4 py-3.5">Tiêu đề</th>
                  <th className="w-32 px-4 py-3.5">Chủ đề</th>
                  <th className="w-44 px-4 py-3.5">Sản phẩm gắn kèm</th>
                  <th className="w-36 px-4 py-3.5">Ngày đăng</th>
                  <th className="w-36 px-4 py-3.5">Trạng thái</th>
                  <th className="w-28 px-4 py-3.5">Lượt xem</th>
                  <th className="w-24 whitespace-nowrap px-3 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-sm text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-5 animate-spin text-primary" />
                        <span>Đang tải bài đăng…</span>
                      </div>
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="grid place-items-center gap-2">
                        <Camera className="size-8 text-muted-foreground/40" />
                        <p className="text-sm font-medium">Không có bài đăng nào</p>
                        <p className="text-sm text-muted-foreground">Thử đổi bộ lọc hoặc thêm bài đăng mới.</p>
                        <Button variant="outline" size="sm" className="mt-1 bg-white" onClick={resetFilters}>
                          Xóa bộ lọc
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paged.map((p, idx) => {
                    const x = p as PostExtra;
                    const st = statusOf(p);
                    const ui = STATUS_UI[st];
                    const dp = fmtDateParts(postDate(x));
                    const checked = selected.has(p.id);
                    const active = pv?.id === p.id;
                    const prods = x.products ?? [];
                    const publishedIdx = publishedPosts.findIndex((q) => q.id === p.id);
                    const text = x.summary || stripHtml(x.content);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={cn(
                          "cursor-pointer border-b border-border/70 transition-colors last:border-b-0",
                          checked || active ? "bg-accent/30" : "hover:bg-secondary/30",
                        )}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${p.title ?? "bài đăng"}`}
                            className="size-4 rounded-xs"
                            checked={checked}
                            onChange={() => toggleOne(p.id)}
                          />
                        </td>
                        <td className="px-3 py-4 text-muted-foreground">{(page - 1) * pageSize + idx + 1}</td>
                        <td className="px-4 py-4">
                          <img
                            src={p.image_url}
                            alt={p.title ?? "ÉLANEwoman"}
                            className="h-11 w-16 rounded-xs border border-slate-200 object-cover"
                          />
                        </td>
                        <td className="min-w-0 px-4 py-4">
                          <a
                            href={`/elanewoman/sua/${p.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEdit(p);
                            }}
                            className="block max-w-[260px] truncate text-[14px] font-semibold hover:underline"
                          >
                            {p.title || <span className="font-normal italic text-muted-foreground">Không có tiêu đề</span>}
                          </a>
                          <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                            {text || (p.product_name ? `Sản phẩm: ${p.product_name}` : "—")}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {x.topic ? (
                            <span className={cn("inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium", topicTint(x.topic))}>
                              {x.topic}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {prods.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              {prods.slice(0, 3).map((pr) =>
                                pr.image_url ? (
                                  <img
                                    key={pr.id}
                                    src={pr.image_url}
                                    alt={pr.name}
                                    title={pr.name}
                                    className="size-10 rounded-md border border-border object-cover"
                                  />
                                ) : (
                                  <span
                                    key={pr.id}
                                    title={pr.name}
                                    className="grid size-10 place-items-center rounded-md border border-border bg-secondary text-muted-foreground"
                                  >
                                    <Tag className="size-4" />
                                  </span>
                                ),
                              )}
                              {prods.length > 3 && (
                                <span className="text-xs text-muted-foreground">+{prods.length - 3}</span>
                              )}
                            </div>
                          ) : p.product_name ? (
                            <span
                              className="inline-flex max-w-[160px] items-center gap-1.5 truncate rounded-md bg-secondary/60 px-2 py-1 text-xs"
                              title={p.product_name}
                            >
                              <Tag className="size-3 shrink-0" />
                              <span className="truncate">{p.product_name}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 tabular-nums">
                          <p>{dp.date}</p>
                          <p className="text-xs text-muted-foreground">{dp.time}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium",
                              ui.pill,
                            )}
                          >
                            <span className={cn("size-1.5 rounded-full", ui.dot)} />
                            {ui.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 tabular-nums">
                          {x.views != null ? x.views.toLocaleString("vi-VN") : "—"}
                        </td>
                        <td className="px-3 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          {canWrite && <Popover open={menuId === p.id} onOpenChange={(o) => setMenuId(o ? p.id : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8" aria-label="Thao tác">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-52 p-1">
                              <MenuItem
                                icon={<Pencil className="size-3.5" />}
                                label="Chỉnh sửa"
                                onClick={() => {
                                  setMenuId(null);
                                  openEdit(p);
                                }}
                              />
                              {p.link_url && (
                                <MenuItem
                                  icon={<ExternalLink className="size-3.5" />}
                                  label="Mở liên kết"
                                  onClick={() => {
                                    setMenuId(null);
                                    window.open(p.link_url!, "_blank", "noreferrer");
                                  }}
                                />
                              )}
                              <MenuItem
                                icon={p.status === "published" ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                label={p.status === "published" ? "Tạm ẩn (về bản nháp)" : "Xuất bản"}
                                onClick={() => {
                                  setMenuId(null);
                                  void handleToggleStatus(p);
                                }}
                              />
                              {p.status === "published" && publishedIdx > 0 && (
                                <MenuItem
                                  icon={<ArrowUp className="size-3.5" />}
                                  label="Chuyển lên trên"
                                  onClick={() => {
                                    setMenuId(null);
                                    void movePost(p, -1);
                                  }}
                                />
                              )}
                              {p.status === "published" && publishedIdx >= 0 && publishedIdx < publishedPosts.length - 1 && (
                                <MenuItem
                                  icon={<ArrowDown className="size-3.5" />}
                                  label="Chuyển xuống dưới"
                                  onClick={() => {
                                    setMenuId(null);
                                    void movePost(p, 1);
                                  }}
                                />
                              )}
                              <MenuItem
                                icon={<Trash2 className="size-3.5" />}
                                label="Xóa bài đăng"
                                destructive
                                onClick={() => {
                                  setMenuId(null);
                                  handleDelete(p);
                                }}
                              />
                            </PopoverContent>
                          </Popover>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pager
            page={page}
            totalPages={totalPages}
            total={visible.length}
            pageSize={pageSize}
            shown={paged.length}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
          {reordering && (
            <p className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Đang cập nhật thứ tự…
            </p>
          )}
        </section>

        {/* Preview panel */}
        <aside className="rounded-xl border border-border bg-card p-5 xl:sticky xl:top-4">
          <h2 className="text-base font-semibold">Xem trước bài đăng</h2>
          {!pv ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Chọn một bài đăng để xem trước.</p>
          ) : (
            <div className="mt-4">
              <div className="aspect-[4/3] overflow-hidden rounded-xl border border-border bg-secondary">
                <img
                  src={previewImages[previewIdx] ?? pv.image_url}
                  alt={pv.title ?? "ÉLANEwoman"}
                  className="size-full object-cover"
                />
              </div>
              {previewImages.length > 1 && (
                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                  {previewImages.slice(0, 3).map((u, i) => (
                    <button
                      key={`${u}-${i}`}
                      type="button"
                      onClick={() => setPreviewIdx(i)}
                      className={cn(
                        "aspect-[4/3] overflow-hidden rounded-lg border-2 transition-colors",
                        previewIdx === i ? "border-primary" : "border-transparent",
                      )}
                    >
                      <img src={u} alt={`Ảnh ${i + 1}`} className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <h3 className="mt-4 text-lg font-semibold leading-snug">
                {pv.title || <span className="font-normal italic text-muted-foreground">Không có tiêu đề</span>}
              </h3>
              {(pv.summary || pv.content) && (
                <p className="mt-2 line-clamp-6 text-sm leading-relaxed text-foreground/80">
                  {pv.summary || stripHtml(pv.content)}
                </p>
              )}
              {pv.topic && (
                <span className={cn("mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-medium", topicTint(pv.topic))}>
                  {pv.topic}
                </span>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  {pvDate?.date}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-3.5" />
                  {pv.views != null ? `${pv.views.toLocaleString("vi-VN")} lượt xem` : "— lượt xem"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-rose-600">
                  <Heart className="size-3.5" />
                  {pv.likes ?? "—"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="size-3.5" />
                  {pv.comments ?? "—"}
                </span>
              </div>
              {canWrite && <Button variant="outline" className="mt-4 h-10 w-full gap-2 bg-white" onClick={() => openEdit(pv)}>
                <Pencil className="size-4" />
                Chỉnh sửa bài đăng
              </Button>}
            </div>
          )}
        </aside>
      </div>

      {ConfirmDialogElement}
    </div>
  );
}
