import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  Archive,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Layers3,
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
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
type ProductCategoryNode = {
  category: { id: string; name: string; parent_id: string | null };
  children: ProductCategoryNode[];
};

type CollectionForm = {
  name: string;
  slug: string;
  category: string;
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
  category: "SPECIAL RUNWAY COLLECTION",
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

const COLLECTION_STATUS_STYLES = {
  draft: {
    dot: "bg-amber-500",
    trigger: "border-slate-200 bg-white text-amber-800",
    option: "text-amber-800 hover:bg-slate-50",
    selected: "font-semibold",
  },
  published: {
    dot: "bg-emerald-500",
    trigger: "border-slate-200 bg-white text-emerald-800",
    option: "text-emerald-800 hover:bg-slate-50",
    selected: "font-semibold",
  },
  archived: {
    dot: "bg-sky-500",
    trigger: "border-slate-200 bg-white text-sky-800",
    option: "text-sky-800 hover:bg-slate-50",
    selected: "font-semibold",
  },
} as const;

const COLLECTION_STATUS_OPTIONS: Array<{ id: CollectionForm["status"]; label: string }> = [
  { id: "draft", label: "Bản nháp" },
  { id: "published", label: "Đã xuất bản" },
  { id: "archived", label: "Đã lưu trữ" },
];

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
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productCategoryPickerOpen, setProductCategoryPickerOpen] = useState(false);
  const [productCategories, setProductCategories] = useState<ProductCategoryNode["category"][]>([]);
  const [expandedProductCategoryIds, setExpandedProductCategoryIds] = useState<Set<string>>(
    new Set(),
  );
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
      setProductCategoryId("");
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
        category: item.category,
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
      setProductCategoryId("");
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

  useEffect(() => {
    if (!editorOpen) return;
    void adminApi
      .categoryOptions("active")
      .then((result) =>
        setProductCategories(
          result.items.map(({ id, name, parent_id }) => ({ id, name, parent_id })),
        ),
      )
      .catch(() => setProductCategories([]));
  }, [editorOpen]);

  const productCategoryTree = useMemo(() => {
    const nodes = new Map<string, ProductCategoryNode>();
    for (const category of productCategories) {
      nodes.set(category.id, { category, children: [] });
    }
    const roots: ProductCategoryNode[] = [];
    for (const category of productCategories) {
      const node = nodes.get(category.id)!;
      const parent = category.parent_id ? nodes.get(category.parent_id) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }, [productCategories]);

  useEffect(() => {
    setExpandedProductCategoryIds(new Set(productCategoryTree.map((node) => node.category.id)));
  }, [productCategoryTree]);

  const loadProductPage = useCallback(
    async (page: number, query: string, categoryId: string, append: boolean, requestId: number) => {
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
          ...(categoryId ? { category_id: categoryId } : {}),
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
    void loadProductPage(1, debouncedProductSearch, productCategoryId, false, requestId);
  }, [editorOpen, debouncedProductSearch, productCategoryId, loadProductPage]);

  const loadMoreProducts = useCallback(() => {
    if (
      !editorOpen ||
      productsLoading ||
      productsLoadingMoreRef.current ||
      productPage * 20 >= productTotal
    )
      return;
    void loadProductPage(
      productPage + 1,
      debouncedProductSearch,
      productCategoryId,
      true,
      productRequestId.current,
    );
  }, [
    editorOpen,
    productsLoading,
    productPage,
    productTotal,
    debouncedProductSearch,
    productCategoryId,
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
      if (query && !`${item.name} ${item.slug}`.toLocaleLowerCase("vi").includes(query))
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
        category: form.category,
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

  const renderProductCategoryTree = (nodes: ProductCategoryNode[]): ReactNode => (
    <ul className="space-y-1 text-sm">
      {nodes.map(({ category, children }) => {
        const expanded = expandedProductCategoryIds.has(category.id);
        const selected = productCategoryId === category.id;
        return (
          <li key={category.id}>
            <div className="flex items-center gap-1">
              {children.length ? (
                <button
                  type="button"
                  aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} ${category.name}`}
                  aria-expanded={expanded}
                  onClick={() => {
                    setExpandedProductCategoryIds((current) => {
                      const next = new Set(current);
                      if (next.has(category.id)) next.delete(category.id);
                      else next.add(category.id);
                      return next;
                    });
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-xs text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#243B53]/40"
                >
                  <ChevronRight
                    className={`size-4 transition-transform duration-300 ease-in-out ${expanded ? "rotate-90" : ""}`}
                  />
                </button>
              ) : (
                <span
                  className="flex size-8 shrink-0 items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="size-4" />
                </span>
              )}
              <button
                type="button"
                aria-pressed={selected}
                title={category.name}
                onClick={() => {
                  setProductCategoryId(category.id);
                  setProductCategoryPickerOpen(false);
                }}
                className={`h-8 min-w-0 flex-1 truncate rounded-xs px-2 text-left text-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#243B53]/40 ${selected ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700"}`}
              >
                {category.name}
              </button>
            </div>
            {children.length > 0 && (
              <div
                className={`grid transition-[grid-template-rows] duration-200 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="min-h-0 overflow-hidden" inert={!expanded}>
                  <div className="ml-4 border-l border-slate-200 pl-2 pt-1">
                    {renderProductCategoryTree(children)}
                  </div>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

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
            role="tablist"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            {[
              {
                label: "Tổng bộ sưu tập",
                filter: "all",
                value: counts.all,
                hint: "Trong thư viện",
                icon: Layers3,
                iconColor: "text-[#243B53]",
                dotColor: "bg-[#243B53]",
                valueColor: "text-[#243B53]",
                active: "border-[#243B53]/35 bg-[#243B53]/5 ring-1 ring-[#243B53]/10",
                hover: "hover:border-[#243B53]/30 hover:bg-slate-50/40",
              },
              {
                label: "Đang xuất bản",
                filter: "published",
                value: counts.published,
                hint: "Đang hiển thị storefront",
                icon: CheckCircle2,
                iconColor: "text-emerald-600",
                dotColor: "bg-emerald-500",
                valueColor: "text-emerald-700",
                active: "border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-100",
                hover: "hover:border-emerald-200 hover:bg-emerald-50/30",
              },
              {
                label: "Bản nháp",
                filter: "draft",
                value: counts.draft,
                hint: "Chưa xuất bản",
                icon: Pencil,
                iconColor: "text-amber-600",
                dotColor: "bg-amber-500",
                valueColor: "text-amber-700",
                active: "border-amber-300 bg-amber-50/60 ring-1 ring-amber-100",
                hover: "hover:border-amber-200 hover:bg-amber-50/30",
              },
              {
                label: "Đã lưu trữ",
                filter: "archived",
                value: counts.archived,
                hint: "Đang ẩn khỏi storefront",
                icon: Archive,
                iconColor: "text-sky-600",
                dotColor: "bg-sky-500",
                valueColor: "text-sky-700",
                active: "border-sky-300 bg-sky-50/60 ring-1 ring-sky-100",
                hover: "hover:border-sky-200 hover:bg-sky-50/30",
              },
            ].map(
              ({
                label,
                filter,
                value,
                hint,
                icon: Icon,
                iconColor,
                dotColor,
                valueColor,
                active,
                hover,
              }) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`collection-summary-card group w-full rounded-xs border px-4 py-4 text-left hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#243B53] focus-visible:ring-offset-2 ${statusFilter === filter ? active : `border-slate-200 bg-white ${hover}`}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-600">{label}</span>
                    <Icon className={`size-4 shrink-0 ${iconColor}`} aria-hidden="true" />
                  </span>
                  <span
                    className={`mt-3 block text-[26px] font-semibold leading-none tracking-tight tabular-nums ${valueColor}`}
                  >
                    {value}
                  </span>
                  <span className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span className={`size-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
                    <span>{hint}</span>
                  </span>
                </button>
              ),
            )}
          </section>

          <section className="overflow-hidden rounded-xs border border-border bg-card">
            <div className="flex flex-col gap-3  px-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="flex max-w-full gap-1 overflow-x-auto">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatusFilter(filter.id)}
                    className={`min-h-10 shrink-0 border-b-2 px-2.5 text-xs font-medium transition-colors sm:px-3 ${statusFilter === filter.id ? "border-[#243B53] text-[#243B53]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
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
                          className="absolute right-2 top-2 grid size-7 place-items-center rounded-xs border border-border/70 bg-white text-[#243B53]"
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
        <section className="space-y-4 pb-8">
          {route.action === "edit" && (loading || !editingRouteReady) ? (
            <div className="grid min-h-64 place-items-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Đang tải bộ sưu tập…
              </span>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-0.5 size-9 shrink-0 bg-white"
                    onClick={backToList}
                    aria-label="Quay lại danh sách bộ sưu tập"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <AdminPageHeader
                    title={editing ? "Chỉnh sửa bộ sưu tập" : "Tạo bộ sưu tập"}
                    description={
                      editing
                        ? "Cập nhật hình ảnh, sản phẩm và thông tin hiển thị trên storefront."
                        : "Tạo album thời trang, chọn sản phẩm và thiết lập hình ảnh storefront."
                    }
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 bg-white px-4"
                    onClick={backToList}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    form="collection-editor-form"
                    disabled={saving || uploading !== null}
                    className="h-9 bg-[#243B53] px-4 text-white hover:bg-[#1B2E42]"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 size-4" />
                    )}
                    {editing ? "Lưu thay đổi" : "Tạo bộ sưu tập"}
                  </Button>
                </div>
              </div>

              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.95fr)] 2xl:gap-5">
                <form id="collection-editor-form" onSubmit={save} className="min-w-0 space-y-4">
                  <section className="rounded-xs border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-slate-950 admin-section-title">Thông tin bộ sưu tập</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Thông tin hiển thị trên trang bộ sưu tập của storefront.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-xs border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
                        01 · Nội dung
                      </span>
                    </div>
                    <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
                      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                        Tên bộ sưu tập <span className="text-rose-600">*</span>
                        <Input
                          value={form.name}
                          onChange={(event) => {
                            setField("name", event.target.value);
                            if (!slugTouched) setField("slug", slugify(event.target.value));
                          }}
                          placeholder="Nhập tên bộ sưu tập..."
                          className="h-9 rounded-xs border-slate-200 px-3 text-sm font-normal placeholder:text-slate-400"
                        />
                      </label>
                      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                        Slug / Đường dẫn <span className="text-rose-600">*</span>
                        <Input
                          value={form.slug}
                          onChange={(event) => {
                            setSlugTouched(true);
                            setField("slug", slugify(event.target.value));
                          }}
                          placeholder="Tự động tạo từ tên..."
                          className="h-9 rounded-xs border-slate-200 px-3 text-sm font-normal placeholder:text-slate-400"
                        />
                      </label>
                      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                        Nhóm lọc
                        <select
                          value={form.category}
                          onChange={(event) => setField("category", event.target.value)}
                          className="h-9 w-full rounded-xs border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-[#243B53] focus:ring-1 focus:ring-[#243B53]"
                        >
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                        Thứ tự hiển thị
                        <Input
                          type="number"
                          min="0"
                          value={form.sort_order}
                          onChange={(event) => setField("sort_order", event.target.value)}
                          className="h-9 rounded-xs border-slate-200 px-3 text-sm font-normal"
                        />
                      </label>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">
                      Slug dùng cho đường dẫn bộ sưu tập. Nhóm lọc giúp phân loại trên storefront.
                    </p>
                  </section>

                  <section className="rounded-xs border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-slate-950 admin-section-title">
                          Sản phẩm trong bộ sưu tập{" "}
                          <span className="text-[#243B53]">({selectedProductIds.length})</span>
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Chỉ chọn sản phẩm đang xuất bản để hiển thị trong album.
                        </p>
                      </div>
                      <span className="shrink-0 pt-1 text-xs text-[#243B53]">
                        {products.length} / {productTotal}
                      </span>
                    </div>
                    <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_130px]">
                      <label className="relative min-w-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={productSearch}
                          onChange={(event) => setProductSearch(event.target.value)}
                          placeholder="Tìm theo tên sản phẩm, SKU..."
                          className="h-9 rounded-xs border-slate-200 pl-9 text-sm placeholder:text-slate-400"
                        />
                      </label>
                      <Popover
                        open={productCategoryPickerOpen}
                        onOpenChange={setProductCategoryPickerOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Lọc sản phẩm theo danh mục"
                            className={`h-9 min-w-0 justify-between gap-1.5 rounded-xs border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 ${productCategoryId ? "border-[#243B53] bg-[#EAF0F6] text-[#243B53]" : ""}`}
                          >
                            <span className="truncate">
                              {productCategoryId
                                ? (productCategories.find(
                                  (category) => category.id === productCategoryId,
                                )?.name ?? "Danh mục")
                                : "Danh mục"}
                            </span>
                            <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          className="w-80 max-w-[calc(100vw-1.5rem)] p-2"
                        >
                          <div className="mb-2 border-b border-slate-100 pb-2">
                            <p className="px-2 pb-1 text-xs font-medium text-slate-500">
                              Danh mục sản phẩm
                            </p>
                            <button
                              type="button"
                              aria-pressed={!productCategoryId}
                              onClick={() => {
                                setProductCategoryId("");
                                setProductCategoryPickerOpen(false);
                              }}
                              className={`flex h-8 w-full items-center gap-2 rounded-xs px-2 text-left text-sm transition-colors hover:bg-slate-100 ${!productCategoryId ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700"}`}
                            >
                              <Check
                                className={`size-3.5 ${!productCategoryId ? "opacity-100" : "opacity-0"}`}
                              />
                              Tất cả danh mục
                            </button>
                          </div>
                          <div className="admin-thin-scrollbar max-h-[min(24rem,60vh)] overflow-y-auto pr-1">
                            {productCategoryTree.length ? (
                              renderProductCategoryTree(productCategoryTree)
                            ) : (
                              <p className="px-2 py-3 text-sm text-slate-500">Chưa có danh mục.</p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <select
                        aria-label="Trạng thái sản phẩm"
                        value="published"
                        disabled
                        className="h-9 min-w-0 rounded-xs border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-600 disabled:cursor-default disabled:opacity-100"
                      >
                        <option value="published">Đã xuất bản</option>
                      </select>
                    </div>
                    <div
                      onScroll={onProductListScroll}
                      className="admin-thin-scrollbar max-h-[40rem] overflow-y-auto pr-1"
                    >
                      {productsLoading ? (
                        <p className="grid min-h-44 place-items-center rounded-xs border border-dashed border-slate-200 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" /> Đang tải sản phẩm…
                          </span>
                        </p>
                      ) : products.length ? (
                        <>
                          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-4">
                            {products.map((product) => {
                              const checked = selectedProductIds.includes(product.id);
                              const image =
                                product.media?.find((item) => item.is_cover)?.url ??
                                product.images[0];
                              return (
                                <label
                                  key={product.id}
                                  className={`group relative min-w-0 cursor-pointer overflow-hidden rounded-md border bg-white text-left transition-colors ${checked ? "border-[#243B53] ring-1 ring-[#243B53]" : "border-slate-200 hover:border-slate-300"}`}
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
                                        className="size-full object-cover"
                                      />
                                    ) : (
                                      <div className="grid size-full place-items-center text-xs text-slate-400">
                                        Chưa có ảnh
                                      </div>
                                    )}
                                    <span
                                      className={`absolute right-2 top-2 grid size-5 place-items-center rounded border transition-colors ${checked ? "border-[#243B53] bg-[#243B53] text-white" : "border-slate-300 bg-white/95 text-transparent"}`}
                                    >
                                      <Check className="size-3.5" strokeWidth={3} />
                                    </span>
                                  </div>
                                  <div className="min-w-0 px-2.5 py-2">
                                    <p className="line-clamp-1 text-xs font-semibold text-slate-800">
                                      {product.name}
                                    </p>
                                    <p className="mt-1 truncate text-xs text-slate-400">
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
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-slate-400">
                            <span>
                              {selectedProductIds.length
                                ? `Đã chọn ${selectedProductIds.length} sản phẩm`
                                : "Chưa chọn sản phẩm"}{" "}
                              · Danh sách tải theo từng 20 sản phẩm
                            </span>
                            <span>
                              {productsLoadingMore
                                ? "Đang tải thêm…"
                                : products.length < productTotal
                                  ? "Cuộn xuống để tải thêm"
                                  : "Đã hiển thị hết sản phẩm phù hợp"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="grid min-h-36 place-items-center rounded-xs border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
                          {productSearch.trim()
                            ? "Không tìm thấy sản phẩm phù hợp."
                            : "Chưa có sản phẩm đã xuất bản trong danh mục này."}
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-xs border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-slate-950 admin-section-title">
                          Ảnh album{" "}
                          <span className="text-slate-400">({form.gallery_images.length})</span>
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Sắp thứ tự ảnh và chọn ảnh nửa ngang hoặc tràn ngang trên storefront.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading === "gallery"}
                        onClick={() => galleryInputRef.current?.click()}
                        className="h-9 shrink-0 bg-white"
                      >
                        <ImagePlus className="mr-2 size-4" />
                        Thêm ảnh
                      </Button>
                    </div>
                    {form.gallery_images.length ? (
                      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                        {form.gallery_images.map((image, index) => (
                          <div
                            key={`${image.url}-${index}`}
                            className="overflow-hidden rounded-xs border border-slate-200 bg-white"
                          >
                            <img
                              src={imageSrc(image.url)}
                              alt={`Ảnh album ${index + 1}`}
                              className="aspect-[1.5/1] w-full bg-slate-100 object-cover"
                            />
                            <div className="flex items-center gap-2 p-2">
                              <span className="text-xs tabular-nums text-slate-500">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <select
                                aria-label={`Kiểu hiển thị ảnh ${index + 1}`}
                                value={image.layout}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    gallery_images: current.gallery_images.map(
                                      (entry, entryIndex) =>
                                        entryIndex === index
                                          ? {
                                            ...entry,
                                            layout: event.target.value as GalleryImage["layout"],
                                          }
                                          : entry,
                                    ),
                                  }))
                                }
                                className="h-8 min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 text-xs text-slate-600"
                              >
                                <option value="half">Nửa ngang</option>
                                <option value="wide">Tràn ngang</option>
                              </select>
                              <button
                                type="button"
                                aria-label={`Chuyển ảnh ${index + 1} lên trước`}
                                disabled={index === 0}
                                onClick={() => moveGalleryImage(index, -1)}
                                className="grid size-8 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                              >
                                <ArrowUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Chuyển ảnh ${index + 1} xuống sau`}
                                disabled={index === form.gallery_images.length - 1}
                                onClick={() => moveGalleryImage(index, 1)}
                                className="grid size-8 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
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
                                className="grid size-8 place-items-center rounded border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          ["Tải ảnh lên", "JPG · PNG · WEBP · GIF", "one"],
                          ["Thêm nhiều ảnh", "Chọn nhiều ảnh cùng lúc", "many"],
                        ].map(([title, note, key]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="grid min-h-32 place-items-center rounded-xs border border-dashed border-[#AFC2D4] bg-[#EAF0F6]/30 px-4 text-center transition-colors hover:border-[#243B53] hover:bg-[#EAF0F6]"
                          >
                            <span>
                              <ImagePlus className="mx-auto size-5 text-[#243B53]" />
                              <span className="mt-2 block text-xs font-semibold text-[#243B53]">
                                {title}
                              </span>
                              <span className="mt-1 block text-xs text-slate-400">{note}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-xs text-slate-400">
                      Kéo hoặc dùng nút lên/xuống để đổi thứ tự hiển thị trên storefront.
                    </p>
                  </section>

                  <section className="rounded-xs border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                    <div className="mb-5">
                      <h2 className="text-slate-950 admin-section-title">
                        Poster & Banner đầu trang
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Quản lý hình ảnh đại diện và banner nổi bật của bộ sưu tập.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[168px_minmax(0,1fr)]">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploading === "cover"}
                        className="relative aspect-[4/5] w-full overflow-hidden rounded-xs border border-dashed border-[#AFC2D4] bg-[#EAF0F6]/30 text-[#243B53] hover:border-[#243B53] sm:w-[168px]"
                      >
                        {form.cover_image_url ? (
                          <img
                            src={imageSrc(form.cover_image_url)}
                            alt="Ảnh poster"
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="absolute inset-0 grid place-items-center">
                            <span className="text-center">
                              <ImagePlus className="mx-auto size-6" />
                              <span className="mt-2 block text-xs font-semibold">
                                Chọn ảnh poster
                              </span>
                              <span className="mt-1 block text-xs">Tỷ lệ khuyến nghị 4:5</span>
                            </span>
                          </span>
                        )}
                        {uploading === "cover" && (
                          <span className="absolute inset-0 grid place-items-center bg-white/75">
                            <Loader2 className="size-5 animate-spin" />
                          </span>
                        )}
                      </button>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            Ảnh poster <span className="text-rose-600">*</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Ảnh bìa hiển thị trong danh sách bộ sưu tập. Bắt buộc để lưu bộ sưu tập.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploading === "cover"}
                          onClick={() => coverInputRef.current?.click()}
                          className="h-9 bg-white"
                        >
                          <Upload className="mr-2 size-3.5" />
                          {form.cover_image_url ? "Thay ảnh poster" : "Tải ảnh poster"}
                        </Button>
                        <p className="text-xs text-slate-400">
                          Hỗ trợ JPG, PNG, WEBP và GIF · tối đa 10MB
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            Dùng bộ sưu tập làm banner đầu trang
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Mỗi thời điểm chỉ có một bộ sưu tập được chọn làm banner.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={form.is_featured}
                          aria-label="Dùng bộ sưu tập làm banner đầu trang"
                          onClick={() => setField("is_featured", !form.is_featured)}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.is_featured ? "bg-[#243B53]" : "bg-slate-300"}`}
                        >
                          <span
                            className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${form.is_featured ? "translate-x-5" : ""}`}
                          />
                        </button>
                      </div>
                      {form.is_featured && (
                        <div className="mt-4 space-y-2">
                          <label className="text-sm font-semibold text-slate-700">
                            Ảnh banner ngang
                          </label>
                          <button
                            type="button"
                            onClick={() => heroInputRef.current?.click()}
                            disabled={uploading === "hero"}
                            className="relative block aspect-[2.8/1] w-full overflow-hidden rounded-xs border border-dashed border-[#AFC2D4] bg-[#EAF0F6]/30 text-[#243B53] hover:border-[#243B53]"
                          >
                            {form.hero_image_url || form.cover_image_url ? (
                              <img
                                src={imageSrc(form.hero_image_url || form.cover_image_url)}
                                alt="Xem trước banner bộ sưu tập"
                                className="size-full object-cover"
                              />
                            ) : (
                              <span className="absolute inset-0 grid place-items-center">
                                <span>
                                  <ImagePlus className="mx-auto size-5" />
                                  <span className="mt-1 block text-xs font-semibold">
                                    Chọn ảnh banner
                                  </span>
                                </span>
                              </span>
                            )}
                            {uploading === "hero" && (
                              <span className="absolute inset-0 grid place-items-center bg-white/75">
                                <Loader2 className="size-5 animate-spin" />
                              </span>
                            )}
                          </button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploading === "hero"}
                            onClick={() => heroInputRef.current?.click()}
                            className="h-9 bg-white"
                          >
                            <Upload className="mr-2 size-3.5" />
                            {form.hero_image_url ? "Thay ảnh banner" : "Tải ảnh banner"}
                          </Button>
                          <p className="text-xs text-slate-400">
                            Nếu không chọn ảnh riêng, hệ thống dùng ảnh poster.
                          </p>
                        </div>
                      )}
                    </div>
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
                  </section>

                  <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 xl:hidden">
                    <Button type="button" variant="outline" onClick={backToList}>
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving || uploading !== null}
                      className="bg-[#243B53] text-white hover:bg-[#1B2E42]"
                    >
                      {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo bộ sưu tập"}
                    </Button>
                  </div>
                </form>

                <aside className="space-y-4 xl:sticky xl:top-16">
                  <section className="rounded-xs border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                    <div>
                      <h2 className="text-slate-950 admin-section-title">Xuất bản & hiển thị</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Kiểm soát khả năng hiển thị trên storefront.
                      </p>
                    </div>
                    <label className="mt-4 block space-y-1.5 text-sm font-semibold text-slate-700">
                      Trạng thái
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            role="combobox"
                            aria-label="Trạng thái bộ sưu tập"
                            className={`mt-2 flex h-9 w-full items-center justify-between rounded-xs border px-3 text-sm font-normal outline-none transition-colors focus:ring-2 focus:ring-[#243B53]/15 ${COLLECTION_STATUS_STYLES[form.status].trigger}`}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`size-2 rounded-full ${COLLECTION_STATUS_STYLES[form.status].dot}`} />
                              {statusLabel(form.status)}
                            </span>
                            <ChevronDown className="size-4 text-slate-500" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1">
                          <div role="listbox" aria-label="Trạng thái bộ sưu tập">
                            {COLLECTION_STATUS_OPTIONS.map((option) => {
                              const styles = COLLECTION_STATUS_STYLES[option.id];
                              const selected = form.status === option.id;
                              return (
                                <PopoverClose key={option.id} asChild>
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => setField("status", option.id)}
                                    className={`flex h-9 w-full items-center justify-between rounded-xs px-2.5 text-left text-sm transition-colors ${styles.option} ${selected ? styles.selected : ""}`}
                                  >
                                    <span className="flex items-center gap-2">
                                      <span className={`size-2 rounded-full ${styles.dot}`} />
                                      {option.label}
                                    </span>
                                    {selected && <Check className="size-4" />}
                                  </button>
                                </PopoverClose>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </label>
                    <div className="my-4 border-t border-slate-100" />
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Bộ sưu tập nổi bật</p>
                        <p className="mt-1 text-[13px] text-slate-500">
                          Hiển thị làm banner đầu trang.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.is_featured}
                        aria-label="Bật bộ sưu tập nổi bật"
                        onClick={() => setField("is_featured", !form.is_featured)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.is_featured ? "bg-[#243B53]" : "bg-slate-300"}`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${form.is_featured ? "translate-x-5" : ""}`}
                        />
                      </button>
                    </div>
                    <div className="my-4 border-t border-slate-100" />
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-400">Thứ tự</p>
                        <p className="mt-1 font-semibold text-slate-800">
                          #{String((Number(form.sort_order) || 0) + 1).padStart(2, "0")}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Sản phẩm liên kết</p>
                        <p className="mt-1 font-semibold text-slate-800">
                          {selectedProductIds.length} sản phẩm
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 rounded-xs bg-[#EAF0F6] px-3 py-2.5 text-xs leading-relaxed text-[#243B53]">
                      {form.status === "published"
                        ? "Các thay đổi sẽ hiển thị trên storefront sau khi bạn lưu."
                        : "Bộ sưu tập sẽ được lưu ở trạng thái bản nháp cho đến khi bạn chọn Xuất bản."}
                    </p>
                  </section>

                  <section className="rounded-xs border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-slate-950 admin-section-title">Xem trước storefront</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Mô phỏng cách bộ sưu tập xuất hiện.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-xs border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
                        Desktop
                      </span>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-md bg-slate-100">
                      {form.hero_image_url || form.cover_image_url ? (
                        <img
                          src={imageSrc(form.hero_image_url || form.cover_image_url)}
                          alt="Xem trước bộ sưu tập"
                          className="aspect-[1.72/1] w-full object-cover"
                        />
                      ) : (
                        <div className="grid aspect-[1.72/1] place-items-center border border-dashed border-slate-300 text-xs text-slate-400">
                          <ImagePlus className="mr-2 inline size-4" />
                          Ảnh xem trước sẽ xuất hiện ở đây
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#243B53]">
                        É L A N E&nbsp; / &nbsp;C O L L E C T I O N
                      </p>
                      <h3 className="mt-1 font-sans text-lg font-semibold leading-snug text-slate-900">
                        {form.name || "Tên bộ sưu tập"}
                      </h3>
                    </div>
                    {form.gallery_images.length > 0 && (
                      <div className="mt-3 flex gap-2">
                        {form.gallery_images.slice(0, 3).map((image, index) => (
                          <img
                            key={`${image.url}-${index}`}
                            src={imageSrc(image.url)}
                            alt={`Ảnh album xem trước ${index + 1}`}
                            className="size-14 rounded object-cover"
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                      <div className="rounded-xs bg-slate-50 p-2">
                        <p className="text-xs uppercase text-slate-400">Sản phẩm</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {String(selectedProductIds.length).padStart(2, "0")}
                        </p>
                      </div>
                      <div className="rounded-xs bg-slate-50 p-2">
                        <p className="text-xs uppercase text-slate-400">Ảnh album</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {String(form.gallery_images.length).padStart(2, "0")}
                        </p>
                      </div>
                      <div className="rounded-xs bg-slate-50 p-2">
                        <p className="text-xs uppercase text-slate-400">Trạng thái</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                          {statusLabel(form.status)}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xs border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                    <div>
                      <h2 className="text-slate-950 admin-section-title">Kiểm tra trước khi lưu</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Các yêu cầu để hoàn tất bộ sưu tập.
                      </p>
                    </div>
                    <ul className="mt-4 space-y-3 text-xs">
                      {[
                        [Boolean(form.name.trim()), "Tên bộ sưu tập"],
                        [Boolean(form.cover_image_url), "Ảnh poster (bắt buộc)"],
                        [true, "Sản phẩm album (không bắt buộc)"],
                        [true, "Ảnh album (không bắt buộc)"],
                      ].map(([complete, label]) => (
                        <li
                          key={String(label)}
                          className="flex items-center gap-2.5 text-slate-500"
                        >
                          {complete ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                          ) : (
                            <Circle className="size-4 shrink-0 text-slate-300" />
                          )}
                          <span>{label}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </aside>
              </div>
            </>
          )}
        </section>
      )}{" "}
      {confirmDialog}
    </div>
  );
}
