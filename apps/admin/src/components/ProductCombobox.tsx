import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { adminApi, type AdminProduct } from "@/lib/api";

export interface ProductComboboxProps {
  selectedId: string;
  onSelect: (productId: string, product?: AdminProduct) => void;
  placeholder?: string;
  className?: string;
  initialProduct?: {
    id: string;
    name: string;
    slug?: string | null;
    images?: string[];
    category?: { name: string } | null;
  } | null;
}

export function ProductCombobox({
  selectedId,
  onSelect,
  placeholder = "Tìm kiếm và chọn sản phẩm...",
  className = "",
  initialProduct,
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync initialProduct or fetch selected product detail if not in list
  useEffect(() => {
    if (!selectedId) {
      setSelectedProduct(null);
      return;
    }

    // If currently selected product matches, avoid redundant work
    if (selectedProduct && selectedProduct.id === selectedId) {
      return;
    }

    // 1. If currently in products list
    const foundInList = products.find((p) => p.id === selectedId);
    if (foundInList) {
      setSelectedProduct(foundInList);
      return;
    }

    // 2. If initialProduct is provided and matches selectedId
    if (initialProduct && initialProduct.id === selectedId) {
      setSelectedProduct({
        id: initialProduct.id,
        name: initialProduct.name,
        slug: initialProduct.slug || "",
        description: "",
        material: null,
        status: "published",
        category: initialProduct.category ? { slug: "", name: initialProduct.category.name } : null,
        occasion: null,
        size_chart: null,
        is_new: false,
        best_seller: false,
        price_vnd: 0,
        sale_compare_vnd: null,
        images: initialProduct.images || [],
        variants: [],
      });

      // If initialProduct doesn't have images, fetch full details asynchronously
      if (!initialProduct.images?.length) {
        let active = true;
        adminApi
          .product(selectedId)
          .then((p) => {
            if (active && p) {
              setSelectedProduct(p);
            }
          })
          .catch(() => {});
        return () => {
          active = false;
        };
      }
      return;
    }

    // 3. Otherwise fetch from API by ID
    let active = true;
    adminApi
      .product(selectedId)
      .then((p) => {
        if (active && p) {
          setSelectedProduct(p);
        }
      })
      .catch(() => {
        // Product might be deleted or unavailable
      });

    return () => {
      active = false;
    };
  }, [selectedId, initialProduct?.id, initialProduct?.name, initialProduct?.slug]);

  // Load initial 20 products when opening for the first time
  useEffect(() => {
    if (open && products.length === 0 && !search.trim()) {
      setLoading(true);
      adminApi
        .products({ limit: 20 })
        .then((res) => {
          setProducts(Array.isArray(res?.items) ? res.items : []);
        })
        .catch(() => {})
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, products.length, search]);

  // Debounced search query
  const handleSearchChange = (value: string) => {
    setSearch(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const q = value.trim();
    if (!q) {
      setIsTyping(false);
      setLoading(true);
      adminApi
        .products({ limit: 20 })
        .then((res) => {
          setProducts(Array.isArray(res?.items) ? res.items : []);
        })
        .catch(() => {})
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    setIsTyping(true);

    debounceTimerRef.current = setTimeout(async () => {
      setIsTyping(false);
      setLoading(true);
      try {
        const res = await adminApi.products({
          q,
          limit: 30,
        });
        setProducts(Array.isArray(res?.items) ? res.items : []);
      } catch (err) {
        console.error("Lỗi tìm kiếm sản phẩm:", err);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Smooth mouse wheel scrolling inside Radix Dialog
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
  }, [open, products]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          className={`flex h-10 w-full min-w-0 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring gap-2 overflow-hidden ${className}`}
        >
          {selectedProduct ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
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
              <span className="truncate font-medium flex-1 min-w-0">{selectedProduct.name}</span>
              {selectedProduct.category?.name && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 shrink-0 font-normal truncate max-w-[110px]"
                >
                  {selectedProduct.category.name}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1.5 truncate flex-1 min-w-0">
              <Search className="size-3.5 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </span>
          )}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {selectedProduct && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProduct(null);
                  onSelect("");
                }}
                className="size-5 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                title="Bỏ chọn sản phẩm"
              >
                <X className="size-3" />
              </button>
            )}
            <ChevronDown className="size-3.5 opacity-50 shrink-0" />
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent
        portal={false}
        align="start"
        className="w-[360px] p-0 shadow-xl border-border z-50 overflow-hidden"
      >
        <div className="p-2 border-b border-border bg-card space-y-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Gõ tên sản phẩm, mã SKU, danh mục... (đợi 1s để tìm)"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 pr-7 h-8 text-xs bg-background"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground min-h-[16px]">
            {loading ? (
              <span className="text-primary flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                Đang tìm kiếm trên hệ thống...
              </span>
            ) : search.trim() ? (
              <span>Kết quả tìm kiếm: {products.length} sản phẩm</span>
            ) : (
              <span>Sản phẩm gần đây ({products.length})</span>
            )}

            {search.trim() && !loading && !isTyping && (
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                Từ khóa: "{search.trim()}"
              </span>
            )}
          </div>
        </div>

        <div
          ref={listRef}
          className="max-h-60 overflow-y-auto p-1 divide-y divide-border/30 overscroll-contain"
        >
          {/* Option to clear selection */}
          <button
            type="button"
            onClick={() => {
              setSelectedProduct(null);
              onSelect("");
              setOpen(false);
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 text-xs rounded hover:bg-muted text-left transition cursor-pointer text-muted-foreground"
          >
            <span>-- Không gắn sản phẩm --</span>
            {!selectedId && <Check className="size-3.5 text-primary" />}
          </button>

          {products.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {loading ? (
                <div className="flex items-center justify-center gap-1.5">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>Đang tải danh sách sản phẩm...</span>
                </div>
              ) : isTyping ? (
                <span>Đang chờ bạn gõ xong (1s)...</span>
              ) : search.trim() ? (
                <span>Không tìm thấy sản phẩm nào khớp với "{search}"</span>
              ) : (
                <span>Chưa có sản phẩm nào</span>
              )}
            </div>
          ) : (
            products.map((p) => {
              const isSelected = p.id === selectedId;
              const sku = p.variants?.[0]?.sku;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProduct(p);
                    onSelect(p.id, p);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded hover:bg-muted text-left transition cursor-pointer ${
                    isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                  }`}
                >
                  {p.images?.[0] ? (
                    <img
                      src={p.images[0]}
                      alt=""
                      className="size-8 rounded object-cover border border-border shrink-0 bg-secondary"
                    />
                  ) : (
                    <div className="size-8 rounded bg-secondary flex items-center justify-center text-[10px] text-muted-foreground shrink-0 font-medium">
                      SP
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                      {p.category?.name && (
                        <span className="truncate max-w-[120px]">{p.category.name}</span>
                      )}
                      {p.category?.name && sku && <span>•</span>}
                      {sku && <span className="font-mono text-[10px]">{sku}</span>}
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
