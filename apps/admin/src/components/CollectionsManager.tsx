import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type UIEvent,
} from "react";
import {
  Archive,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  adminApi,
  API_URL,
  STOREFRONT_URL,
  type AdminCollection,
  type AdminProduct,
} from "@/lib/api";
import { adminErrorMessage } from "@/lib/admin-language";
import { resolveAdminPath } from "@/lib/routes";

type GalleryImage = { url: string; layout: "half" | "wide" };

type CollectionForm = {
  name: string;
  slug: string;
  tagline: string;
  category: string;
  description: string;
  cover_image_url: string;
  hero_image_url: string;
  gallery_images: GalleryImage[];
  sort_order: string;
  is_featured: boolean;
  status: "draft" | "published" | "archived";
};

const EMPTY_FORM: CollectionForm = {
  name: "",
  slug: "",
  tagline: "",
  category: "SPECIAL RUNWAY COLLECTION",
  description: "",
  cover_image_url: "",
  hero_image_url: "",
  gallery_images: [],
  sort_order: "0",
  is_featured: false,
  status: "draft",
};
const FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "published", label: "Đã xuất bản" },
  { id: "draft", label: "Bản nháp" },
  { id: "archived", label: "Đã lưu trữ" },
] as const;
const CATEGORIES = ["ÁO", "ĐẦM", "CHÂN VÁY", "QUẦN", "SPECIAL RUNWAY COLLECTION", "PHỤ KIỆN"];

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function statusLabel(status: string) {
  if (status === "published") return "Đã xuất bản";
  if (status === "archived") return "Đã lưu trữ";
  return "Bản nháp";
}

function imageSrc(url: string | null) {
  if (!url || !url.startsWith("/")) return url ?? "";
  return url.startsWith("/pantio-collections/") ? `${STOREFRONT_URL}${url}` : `${API_URL}${url}`;
}

export function CollectionsManager({ permissions = [] }: { permissions?: string[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const route = resolveAdminPath(location.pathname);
  const editorOpen =
    route.tabId === "collections" && (route.action === "create" || route.action === "edit");
  const canWrite =
    permissions.includes("*") ||
    permissions.includes("content.write") ||
    permissions.includes("product.write");
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<AdminCollection[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "hero" | "gallery" | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [editing, setEditing] = useState<AdminCollection | null>(null);
  const [form, setForm] = useState<CollectionForm>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [productPage, setProductPage] = useState(0);
  const [productTotal, setProductTotal] = useState(0);
  const productRequestId = useRef(0);
  const productsLoadingMoreRef = useRef(false);
  const initializedEditorPathRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await adminApi.collections();
      setItems(result.items);
      setCategories(result.categories.length ? result.categories : CATEGORIES);
    } catch (error) {
      toast.error(error instanceof Error ? adminErrorMessage(error) : "Không tải được bộ sưu tập");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editorOpen) {
      initializedEditorPathRef.current = null;
      return;
    }
    if (!canWrite) {
      navigate({ to: "/bosuutap" as unknown as "/" });
      return;
    }
    if (initializedEditorPathRef.current === location.pathname) return;
    if (route.action === "create") {
      initializedEditorPathRef.current = location.pathname;
      setEditing(null);
      setForm({ ...EMPTY_FORM, sort_order: String(items.length) });
      setSlugTouched(false);
      setSelectedProductIds([]);
      setProductSearch("");
      setDebouncedProductSearch("");
      return;
    }
    if (route.action === "edit" && !loading) {
      const item = items.find(
        (entry) => entry.id === route.detailId || entry.slug === route.detailId,
      );
      if (!item) {
        toast.error("Không tìm thấy bộ sưu tập cần chỉnh sửa");
        navigate({ to: "/bosuutap" as unknown as "/" });
        return;
      }
      setEditing(item);
      initializedEditorPathRef.current = location.pathname;
      setForm({
        name: item.name,
        slug: item.slug,
        tagline: item.tagline ?? "",
        category: item.category,
        description: item.description ?? "",
        cover_image_url: item.cover_image_url ?? "",
        hero_image_url: item.hero_image_url ?? "",
        gallery_images: item.gallery_images ?? [],
        sort_order: String(item.sort_order),
        is_featured: item.is_featured,
        status: item.status === "published" || item.status === "archived" ? item.status : "draft",
      });
      setSlugTouched(true);
      setSelectedProductIds(item.product_ids ?? []);
      setProductSearch("");
      setDebouncedProductSearch("");
    }
  }, [
    editorOpen,
    canWrite,
    route.action,
    route.detailId,
    loading,
    items,
    location.pathname,
    navigate,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const loadProductPage = useCallback(
    async (page: number, query: string, append: boolean, requestId: number) => {
      if (append) {
        productsLoadingMoreRef.current = true;
        setProductsLoadingMore(true);
      } else {
        setProductsLoading(true);
      }
      try {
        const result = await adminApi.products({
          status: "published",
          ...(query ? { q: query } : {}),
          page,
          limit: 20,
        });
        if (requestId !== productRequestId.current) return;
        setProducts((current) => {
          const next = result.items.filter((product) => product.status === "published");
          return append ? [...current, ...next] : next;
        });
        setProductPage(result.page);
        setProductTotal(result.total);
      } catch (error) {
        if (requestId === productRequestId.current)
          toast.error(
            error instanceof Error ? adminErrorMessage(error) : "Không tải được sản phẩm",
          );
      } finally {
        if (requestId === productRequestId.current) {
          setProductsLoading(false);
          setProductsLoadingMore(false);
          productsLoadingMoreRef.current = false;
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!editorOpen) return;
    const requestId = ++productRequestId.current;
    productsLoadingMoreRef.current = false;
    setProductsLoadingMore(false);
    setProductsLoading(true);
    setProducts([]);
    setProductPage(0);
    setProductTotal(0);
    void loadProductPage(1, debouncedProductSearch, false, requestId);
  }, [editorOpen, debouncedProductSearch, loadProductPage]);

  const loadMoreProducts = useCallback(() => {
    if (
      !editorOpen ||
      productsLoading ||
      productsLoadingMoreRef.current ||
      productPage * 20 >= productTotal
    )
      return;
    void loadProductPage(productPage + 1, debouncedProductSearch, true, productRequestId.current);
  }, [
    editorOpen,
    productsLoading,
    productPage,
    productTotal,
    debouncedProductSearch,
    loadProductPage,
  ]);

  const onProductListScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 72) loadMoreProducts();
  };

  const counts = useMemo(
    () => ({
      all: items.length,
      published: items.filter((item) => item.status === "published").length,
      draft: items.filter((item) => item.status === "draft").length,
      archived: items.filter((item) => item.status === "archived").length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (
        query &&
        !`${item.name} ${item.slug} ${item.tagline ?? ""}`.toLocaleLowerCase("vi").includes(query)
      )
        return false;
      return true;
    });
  }, [items, search, categoryFilter, statusFilter]);
  const editingRouteReady =
    Boolean(editing) && (editing?.id === route.detailId || editing?.slug === route.detailId);

  const openCreate = () => {
    navigate({ to: "/bosuutap/them" as unknown as "/" });
  };

  const openEdit = (item: AdminCollection) => {
    navigate({ to: `/bosuutap/sua/${item.id}` as unknown as "/" });
  };

  const backToList = () => navigate({ to: "/bosuutap" as unknown as "/" });

  const setField = <K extends keyof CollectionForm>(key: K, value: CollectionForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const uploadImage = async (kind: "cover" | "hero", file?: File) => {
    if (!file) return;
    try {
      setUploading(kind);
      const result = await adminApi.uploadCollectionImage(file);
      setField(kind === "cover" ? "cover_image_url" : "hero_image_url", result.url);
      toast.success("Đã tải ảnh lên");
    } catch (error) {
      toast.error(error instanceof Error ? adminErrorMessage(error) : "Tải ảnh lên thất bại");
    } finally {
      setUploading(null);
    }
  };

  const uploadGalleryImages = async (files?: FileList | null) => {
    if (!files?.length) return;
    try {
      setUploading("gallery");
      const uploaded = await Promise.all(
        Array.from(files).map((file) => adminApi.uploadCollectionImage(file)),
      );
      setForm((current) => ({
        ...current,
        gallery_images: [
          ...current.gallery_images,
          ...uploaded.map((image) => ({ url: image.url, layout: "half" as const })),
        ],
      }));
      toast.success(`Đã thêm ${uploaded.length} ảnh vào album`);
    } catch (error) {
      toast.error(error instanceof Error ? adminErrorMessage(error) : "Tải ảnh album thất bại");
    } finally {
      setUploading(null);
    }
  };

  const moveGalleryImage = (index: number, direction: -1 | 1) => {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.gallery_images.length) return current;
      const gallery_images = [...current.gallery_images];
      [gallery_images[index], gallery_images[target]] = [
        gallery_images[target]!,
        gallery_images[index]!,
      ];
      return { ...current, gallery_images };
    });
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.cover_image_url) {
      toast.error("Vui lòng nhập tên và chọn ảnh poster");
      return;
    }
    try {
      setSaving(true);
      const body = {
        name: form.name.trim(),
        slug: slugify(form.slug || form.name),
        tagline: form.tagline.trim() || null,
        category: form.category,
        description: form.description.trim() || null,
        cover_image_url: form.cover_image_url,
        hero_image_url: form.is_featured ? form.hero_image_url || form.cover_image_url : null,
        gallery_images: form.gallery_images,
        sort_order: Number(form.sort_order) || 0,
        is_featured: form.is_featured,
        status: form.status,
      };
      if (editing)
        await adminApi.updateCollection(editing.id, { ...body, product_ids: selectedProductIds });
      else {
        const created = await adminApi.createCollection(body);
        if (selectedProductIds.length)
          await adminApi.updateCollection(created.id, { product_ids: selectedProductIds });
      }
      toast.success(editing ? "Đã cập nhật bộ sưu tập" : "Đã tạo bộ sưu tập");
      backToList();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? adminErrorMessage(error) : "Không lưu được bộ sưu tập");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (item: AdminCollection) => {
    try {
      await adminApi.updateCollection(item.id, {
        status: item.status === "published" ? "draft" : "published",
      });
      toast.success(
        item.status === "published" ? "Đã chuyển thành bản nháp" : "Đã xuất bản bộ sưu tập",
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? adminErrorMessage(error) : "Không cập nhật được trạng thái",
      );
    }
  };

  const archive = async (item: AdminCollection) => {
    const ok = await confirm({
      title: `Lưu trữ “${item.name}”?`,
      description: "Mục sẽ ẩn khỏi storefront. Bạn có thể chỉnh sửa và xuất bản lại sau.",
      confirmLabel: "Lưu trữ",
    });
    if (!ok) return;
    try {
      await adminApi.archiveCollection(item.id);
      toast.success("Đã lưu trữ bộ sưu tập");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? adminErrorMessage(error) : "Không lưu trữ được bộ sưu tập",
      );
    }
  };

  const move = async (item: AdminCollection, direction: -1 | 1) => {
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = ordered.findIndex((entry) => entry.id === item.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
    try {
      await adminApi.reorderCollections(
        ordered.map((entry, sort_order) => ({ id: entry.id, sort_order })),
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? adminErrorMessage(error) : "Không đổi được thứ tự");
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {!editorOpen && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <AdminPageHeader
              title="Bộ sưu tập"
              description="Sắp xếp ảnh album, sản phẩm và trạng thái hiển thị trên storefront."
            />
            {canWrite && (
              <Button className="h-9 self-start px-3.5 sm:self-auto" onClick={openCreate}>
                <Plus className="size-4" />
                Tạo bộ sưu tập
              </Button>
            )}
          </div>

          <section
            aria-label="Tổng quan bộ sưu tập"
            className="grid grid-cols-2 overflow-hidden rounded-xs border border-border bg-card sm:grid-cols-4"
          >
            {[
              ["Tổng bộ sưu tập", counts.all],
              ["Đang xuất bản", counts.published],
              ["Bản nháp", counts.draft],
              ["Đã lưu trữ", counts.archived],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-b border-border px-4 py-3.5 [&:nth-child(odd)]:border-r sm:border-b-0 sm:border-r sm:[&:nth-child(2)]:border-r sm:[&:nth-child(4)]:border-r-0"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">{value}</p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-xs border border-border bg-card">
            <div className="flex flex-col gap-3  px-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="flex max-w-full gap-1 overflow-x-auto">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatusFilter(filter.id)}
                    className={`min-h-10 shrink-0 border-b-2 px-2.5 text-xs font-medium transition-colors sm:px-3 ${statusFilter === filter.id ? "border-[#6941c6] text-[#6941c6]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {filter.label}
                    <span className="ml-1.5 tabular-nums text-muted-foreground">
                      {counts[filter.id]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex w-full flex-col gap-2 pb-3 sm:w-auto sm:flex-row sm:pb-0">
                <label className="relative flex-1 sm:min-w-[230px]">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm theo tên hoặc slug"
                    className="h-9 rounded-xs pl-9"
                  />
                </label>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-9 rounded-xs border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">Tất cả nhóm</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:gap-4 sm:p-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-3">
                    <div className="aspect-[4/5] animate-pulse bg-slate-100" />
                    <div className="h-4 w-2/3 animate-pulse bg-slate-100" />
                    <div className="h-3 w-1/2 animate-pulse bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : filtered.length ? (
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:gap-4 sm:p-4 xl:grid-cols-4">
                {filtered.map((item) => (
                  <article
                    key={item.id}
                    className="group min-w-0 overflow-hidden rounded-xs border border-border bg-background"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-secondary/50">
                      {item.cover_image_url ? (
                        <img
                          src={imageSrc(item.cover_image_url)}
                          alt={item.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-muted-foreground">
                          <ImagePlus className="size-7" />
                        </div>
                      )}
                      <Badge
                        className={`absolute left-2 top-2 h-6 rounded-xs border-0 px-2 text-[11px] font-medium shadow-none ${item.status === "published" ? "bg-emerald-50 text-emerald-800" : item.status === "archived" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-800"}`}
                      >
                        {statusLabel(item.status)}
                      </Badge>
                      {item.is_featured && (
                        <span
                          className="absolute right-2 top-2 grid size-7 place-items-center rounded-xs border border-border/70 bg-white text-[#6941c6]"
                          title="Banner chính"
                        >
                          <Star className="size-3.5 fill-current" />
                        </span>
                      )}
                    </div>
                    <div className="space-y-2.5 p-3">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-semibold text-foreground">
                            {item.name}
                          </h2>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {item.category} <span aria-hidden="true">·</span> /{item.slug}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          #{item.sort_order + 1}
                        </span>
                      </div>
                      {item.tagline && (
                        <p className="line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
                          {item.tagline}
                        </p>
                      )}
                      <div className="flex items-center gap-3 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                        <span>{item.product_count} sản phẩm</span>
                        <span>{item.gallery_images?.length ?? 0} ảnh album</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="size-3.5" />
                            Sửa
                          </Button>
                        )}
                        {canWrite && item.status !== "archived" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => void togglePublish(item)}
                          >
                            {item.status === "published" ? "Ẩn" : "Xuất bản"}
                          </Button>
                        )}
                        {canWrite && item.status !== "archived" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="ml-auto size-8 text-muted-foreground hover:text-destructive"
                            aria-label="Lưu trữ"
                            onClick={() => void archive(item)}
                          >
                            <Archive className="size-4" />
                          </Button>
                        )}
                        <div className="ml-auto flex gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="Đưa lên"
                            onClick={() => void move(item, -1)}
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="Đưa xuống"
                            onClick={() => void move(item, 1)}
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="m-4 border border-dashed border-border px-4 py-14 text-center">
                <ImagePlus className="mx-auto size-7 text-muted-foreground/60" />
                <p className="mt-3 font-medium text-foreground">
                  {items.length ? "Không có kết quả phù hợp" : "Chưa có bộ sưu tập"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {items.length
                    ? "Thử từ khóa hoặc nhóm khác."
                    : "Tạo mục đầu tiên để hiển thị trên storefront."}
                </p>
                {!items.length && canWrite && (
                  <Button className="mt-4" onClick={openCreate}>
                    <Plus className="mr-2 size-4" />
                    Tạo bộ sưu tập
                  </Button>
                )}
              </div>
            )}
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              Đang hiển thị {filtered.length} trên {items.length} bộ sưu tập
            </p>
          </section>
        </>
      )}

      {editorOpen && (
        <section className="space-y-5">
          {route.action === "edit" && (loading || !editingRouteReady) ? (
            <div className="grid min-h-64 place-items-center rounded-xs border border-border bg-card text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Đang tải bộ sưu tập…
              </span>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-0.5 size-9 shrink-0"
                    onClick={backToList}
                    aria-label="Quay lại danh sách bộ sưu tập"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <AdminPageHeader
                    title={editing ? "Chỉnh sửa bộ sưu tập" : "Tạo bộ sưu tập"}
                    description="Quản lý thông tin, sản phẩm, ảnh album và banner hiển thị trên storefront."
                  />
                </div>
                <Button
                  type="submit"
                  form="collection-editor-form"
                  disabled={saving || uploading !== null}
                  className="h-9 self-start px-4 sm:self-auto"
                >
                  {saving ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 size-4" />
                  )}
                  {editing ? "Lưu thay đổi" : "Tạo bộ sưu tập"}
                </Button>
              </div>
              <form
                id="collection-editor-form"
                onSubmit={save}
                className="space-y-5 rounded-xs border border-border bg-card p-4 sm:p-6"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium">
                    Tên bộ sưu tập
                    <Input
                      value={form.name}
                      onChange={(event) => {
                        setField("name", event.target.value);
                        if (!slugTouched) setField("slug", slugify(event.target.value));
                      }}
                      placeholder="Noir de Vin"
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    Slug
                    <Input
                      value={form.slug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        setField("slug", slugify(event.target.value));
                      }}
                      placeholder="noir-de-vin"
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    Nhóm lọc
                    <select
                      value={form.category}
                      onChange={(event) => setField("category", event.target.value)}
                      className="h-9 w-full border border-input bg-white px-3 text-sm font-normal outline-none focus:ring-1 focus:ring-ring"
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">
                    Thứ tự hiển thị
                    <Input
                      type="number"
                      min="0"
                      value={form.sort_order}
                      onChange={(event) => setField("sort_order", event.target.value)}
                    />
                  </label>
                </div>
                <label className="block space-y-1.5 text-sm font-medium">
                  Mô tả ngắn
                  <Input
                    value={form.tagline}
                    onChange={(event) => setField("tagline", event.target.value)}
                    placeholder="Tinh thần của bộ sưu tập"
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-medium">
                  Mô tả chiến dịch
                  <textarea
                    value={form.description}
                    onChange={(event) => setField("description", event.target.value)}
                    rows={3}
                    className="w-full resize-y border border-input bg-white px-3 py-2 text-sm font-normal outline-none focus:ring-1 focus:ring-ring"
                  />
                </label>

                <section className="space-y-3 border-y border-slate-200 py-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Sản phẩm có trong album</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Chọn sản phẩm để hiển thị trong album trên storefront.
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      Đã chọn {selectedProductIds.length}
                    </span>
                  </div>
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Tìm sản phẩm theo tên"
                  />
                  <div
                    onScroll={onProductListScroll}
                    className="max-h-[30rem] overflow-y-auto pr-1"
                  >
                    {productsLoading ? (
                      <p className="grid min-h-40 place-items-center border border-dashed border-slate-200 text-sm text-slate-500">
                        Đang tải danh sách sản phẩm…
                      </p>
                    ) : products.length ? (
                      <>
                        <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3">
                          {products.map((product) => {
                            const checked = selectedProductIds.includes(product.id);
                            const image =
                              product.media?.find((item) => item.is_cover)?.url ??
                              product.images[0];
                            return (
                              <label
                                key={product.id}
                                className={`group relative min-w-0 cursor-pointer overflow-hidden rounded-lg border bg-white text-left transition-all ${checked ? "border-primary ring-1 ring-primary" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  aria-label={`Chọn ${product.name}`}
                                  onChange={(event) =>
                                    setSelectedProductIds((current) =>
                                      event.target.checked
                                        ? [...current, product.id]
                                        : current.filter((id) => id !== product.id),
                                    )
                                  }
                                  className="peer sr-only"
                                />
                                <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
                                  {image ? (
                                    <img
                                      src={imageSrc(image)}
                                      alt={product.name}
                                      loading="lazy"
                                      className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                                    />
                                  ) : (
                                    <div className="grid size-full place-items-center text-xs text-slate-400">
                                      Chưa có ảnh
                                    </div>
                                  )}
                                  <span
                                    className={`absolute right-2 top-2 grid size-6 place-items-center rounded-md border-2 shadow-sm transition-colors ${checked ? "border-primary bg-primary text-white" : "border-slate-300 bg-white/90 text-transparent"}`}
                                  >
                                    <Check className="size-4" strokeWidth={3} />
                                  </span>
                                  {product.category && (
                                    <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                      {product.category.name}
                                    </span>
                                  )}
                                </div>
                                <div className="p-2.5">
                                  <p className="line-clamp-2 min-h-9 text-xs font-medium text-slate-800">
                                    {product.name}
                                  </p>
                                  <p className="mt-1 truncate text-[10px] text-slate-500">
                                    {product.variants[0]?.sku ?? product.slug}
                                  </p>
                                  <p className="mt-1 text-xs font-semibold tabular-nums text-slate-900">
                                    {product.price_vnd.toLocaleString("vi-VN")}₫
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <p className="p-2.5 text-center text-[11px] text-slate-500">
                          {productsLoadingMore
                            ? "Đang tải thêm 20 sản phẩm…"
                            : products.length < productTotal
                              ? `Đã tải ${products.length}/${productTotal}. Cuộn xuống để xem tiếp.`
                              : `Đã hiển thị tất cả ${products.length} sản phẩm phù hợp.`}
                        </p>
                      </>
                    ) : (
                      <p className="grid min-h-40 place-items-center border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
                        {productSearch.trim()
                          ? "Không tìm thấy sản phẩm phù hợp."
                          : "Chưa có sản phẩm đã xuất bản."}
                      </p>
                    )}
                  </div>
                </section>

                <section className="space-y-3 border-b border-slate-200 pb-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Ảnh trong album</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Sắp thứ tự ảnh và chọn ảnh nửa ngang hoặc tràn toàn chiều ngang trên
                        storefront.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {form.gallery_images.length} ảnh
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading === "gallery"}
                        onClick={() => galleryInputRef.current?.click()}
                      >
                        {uploading === "gallery" ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <ImagePlus className="mr-2 size-4" />
                        )}
                        Thêm ảnh
                      </Button>
                    </div>
                  </div>
                  {form.gallery_images.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {form.gallery_images.map((image, index) => (
                        <div
                          key={`${image.url}-${index}`}
                          className="overflow-hidden border border-slate-200"
                        >
                          <img
                            src={imageSrc(image.url)}
                            alt={`Ảnh album ${index + 1}`}
                            className="aspect-[1.5/1] w-full bg-slate-100 object-cover"
                          />
                          <div className="flex items-center gap-2 p-2">
                            <span className="text-xs tabular-nums text-slate-500">{index + 1}</span>
                            <select
                              aria-label={`Kiểu hiển thị ảnh ${index + 1}`}
                              value={image.layout}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  gallery_images: current.gallery_images.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? {
                                          ...entry,
                                          layout: event.target.value as GalleryImage["layout"],
                                        }
                                      : entry,
                                  ),
                                }))
                              }
                              className="h-8 min-w-0 flex-1 border border-input bg-white px-2 text-xs"
                            >
                              <option value="half">Nửa chiều ngang</option>
                              <option value="wide">Tràn toàn chiều ngang</option>
                            </select>
                            <button
                              type="button"
                              aria-label={`Chuyển ảnh ${index + 1} lên trước`}
                              disabled={index === 0}
                              onClick={() => moveGalleryImage(index, -1)}
                              className="grid size-8 place-items-center border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                              <ArrowUp className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Chuyển ảnh ${index + 1} xuống sau`}
                              disabled={index === form.gallery_images.length - 1}
                              onClick={() => moveGalleryImage(index, 1)}
                              className="grid size-8 place-items-center border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                              <ArrowDown className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Gỡ ảnh ${index + 1} khỏi album`}
                              onClick={() =>
                                setField(
                                  "gallery_images",
                                  form.gallery_images.filter(
                                    (_, entryIndex) => entryIndex !== index,
                                  ),
                                )
                              }
                              className="grid size-8 place-items-center border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="grid min-h-24 w-full place-items-center border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 hover:border-slate-500"
                    >
                      Chưa có ảnh album · Chọn ảnh để bắt đầu
                    </button>
                  )}
                </section>

                <div className="grid gap-4 sm:grid-cols-2">
                  <ImageField
                    title="Ảnh poster"
                    required
                    value={form.cover_image_url}
                    onChoose={() => coverInputRef.current?.click()}
                    uploading={uploading === "cover"}
                  />
                </div>
                <section className="space-y-4 border-y border-slate-200 py-4">
                  <div>
                    <h3 className="text-sm font-semibold">Banner đầu trang bộ sưu tập</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Banner hiển thị tràn hết chiều ngang storefront. Nếu chưa chọn ảnh riêng,
                      banner dùng ảnh poster.
                    </p>
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_featured}
                      onChange={(event) => setField("is_featured", event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-medium">
                        Dùng bộ sưu tập này làm banner đầu trang
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        Mỗi lần chỉ có một bộ sưu tập được chọn làm banner.
                      </span>
                    </span>
                  </label>
                  {form.is_featured && (
                    <ImageField
                      title="Ảnh banner ngang"
                      value={form.hero_image_url || form.cover_image_url}
                      onChoose={() => heroInputRef.current?.click()}
                      uploading={uploading === "hero"}
                      wide
                    />
                  )}
                </section>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => void uploadImage("cover", event.target.files?.[0])}
                />
                <input
                  ref={heroInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => void uploadImage("hero", event.target.files?.[0])}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void uploadGalleryImages(event.currentTarget.files);
                    event.currentTarget.value = "";
                  }}
                />

                <div className="flex flex-wrap items-center justify-end gap-4 border-t border-slate-200 pt-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    Trạng thái
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setField("status", event.target.value as CollectionForm["status"])
                      }
                      className="h-9 border border-input bg-white px-3 font-normal outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="draft">Bản nháp</option>
                      <option value="published">Xuất bản</option>
                      <option value="archived">Đã lưu trữ</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                  <Button type="button" variant="outline" onClick={backToList}>
                    Hủy
                  </Button>
                  <Button type="submit" disabled={saving || uploading !== null}>
                    {saving ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 size-4" />
                    )}
                    {editing ? "Lưu thay đổi" : "Tạo bộ sưu tập"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>
      )}
      {confirmDialog}
    </div>
  );
}

function ImageField({
  title,
  required,
  value,
  onChoose,
  uploading,
  wide,
}: {
  title: string;
  required?: boolean;
  value: string;
  onChoose: () => void;
  uploading: boolean;
  wide?: boolean;
}) {
  return (
    <div className="space-y-1.5 text-sm font-medium">
      <span>
        {title}
        {required ? " *" : ""}
      </span>
      <button
        type="button"
        onClick={onChoose}
        disabled={uploading}
        className={`relative grid ${wide ? "aspect-[2.05/1]" : "aspect-[1.5/1]"} w-full place-items-center overflow-hidden border border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-slate-500`}
      >
        {value ? (
          <img src={imageSrc(value)} alt="Xem trước" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-xs">
            <ImagePlus className="size-6" />
            Chọn ảnh từ máy tính
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-white/80">
            <Loader2 className="size-5 animate-spin" />
          </span>
        )}
        {value && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-white/95 px-2 py-1 text-[10px] text-slate-700">
            <ArrowUpRight className="size-3" />
            Đổi ảnh
          </span>
        )}
      </button>
      <p className="text-[11px] font-normal text-slate-500">
        JPEG, PNG, WebP hoặc GIF · tối đa 10MB
      </p>
    </div>
  );
}
