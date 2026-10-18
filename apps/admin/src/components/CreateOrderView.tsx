import { adminErrorMessage, adminLabel } from "@/lib/admin-language";
import { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Check,
  ChevronDown,
  CreditCard,
  Edit2,
  Loader2,
  Minus,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { EnhancedOrder } from "./OrdersManager";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrderItemDraft = {
  id: string;
  productId?: string | undefined;
  variantId?: string | undefined;
  name: string;
  category: string;
  variant: string;
  sku: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
};

export type CustomerDraft = {
  id: string;
  name: string;
  email: string;
  phone: string;
  ordersCount: number;
  joinedDate: string;
};

export type AddProductCatalogRow = {
  id: string;
  productId?: string | undefined;
  variantId?: string | undefined;
  name: string;
  category: string;
  variant: string;
  sku: string;
  imageUrl: string;
  stock: number;
  price: number;
  status: "active" | "draft" | "archived";
};

const formatVnd = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

const defaultDeliveryRange = () => {
  const start = new Date();
  const end = new Date();
  start.setDate(start.getDate() + 3);
  end.setDate(end.getDate() + 5);
  return `${start.toLocaleDateString("vi-VN")} – ${end.toLocaleDateString("vi-VN")}`;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function CreateOrderView({
  onBack,
  onOrderCreated,
  onSaveDraft,
}: {
  onBack: () => void;
  onOrderCreated: (newOrder: EnhancedOrder) => void;
  onSaveDraft?: (newOrder: EnhancedOrder) => void;
}) {
  // ── Customer State ──
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDraft | null>(null);
  const [availableCustomers, setAvailableCustomers] = useState<CustomerDraft[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Order Items State (empty by default, populated from real catalog) ──
  const [orderItems, setOrderItems] = useState<OrderItemDraft[]>([]);

  // ── Real Categories & Real Products Drawer State ──
  const [realCategories, setRealCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [drawerProducts, setDrawerProducts] = useState<AddProductCatalogRow[]>([]);
  const [drawerPage, setDrawerPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);

  // Filters State
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");
  const [drawerCategoryFilter, setDrawerCategoryFilter] = useState("all");
  const [drawerStatusFilter, setDrawerStatusFilter] = useState("all");
  const [drawerStockFilter, setDrawerStockFilter] = useState("all");

  // Per-item quantity steppers in catalog table and selected list
  const [catalogRowQuantities, setCatalogRowQuantities] = useState<Record<string, number>>({});
  const [drawerSelectedItems, setDrawerSelectedItems] = useState<
    Array<{ item: AddProductCatalogRow; quantity: number }>
  >([]);

  // Load Real Categories on Mount
  useEffect(() => {
    adminApi
      .categories("active")
      .then((res) => {
        if (res && res.items) {
          setRealCategories(
            res.items.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
          );
        }
      })
      .catch(() => { });
  }, []);

  // Hydrate real customers from API
  useEffect(() => {
    adminApi
      .customers({ limit: 100 })
      .then((res) => {
        if (res && res.items && res.items.length > 0) {
          const mapped: CustomerDraft[] = res.items.map((c) => ({
            id: c.id,
            name: c.full_name,
            email: c.email || "—",
            phone: c.phone || "—",
            ordersCount: c.analytics?.total_orders ?? c.orders?.length ?? 0,
            joinedDate: c.created_at
              ? new Date(c.created_at).toLocaleDateString("vi-VN", { month: "short", year: "numeric" })
              : "Tháng 01/2024",
          }));
          setAvailableCustomers(mapped);
          if (mapped[0]) setSelectedCustomer(mapped[0]);
        }
      })
      .catch(() => { });
  }, []);

  // Helper to map AdminProduct to AddProductCatalogRow
  const mapProductToCatalogRows = (p: any): AddProductCatalogRow[] => {
    const coverImg =
      p.images?.[0] ||
      p.media?.find((m: any) => m.is_cover)?.url ||
      "";
    const categoryName = p.category?.name || "Sản phẩm";

    if (p.variants && p.variants.length > 0) {
      return p.variants.map((v: any) => {
        const colorName = v.color?.name || v.color_name || "";
        const sizeLabel = v.size?.label || v.size_label || "";
        const variantText = [colorName, sizeLabel].filter(Boolean).join(" / ") || "Chuẩn";
        const stockQty = Number(v.available ?? v.on_hand ?? 0);
        const price = Number(v.price_vnd ?? p.price_vnd ?? 0);

        return {
          id: v.sku || v.id,
          productId: p.id,
          variantId: v.id,
          name: p.name,
          category: categoryName,
          variant: variantText,
          sku: v.sku,
          imageUrl: v.image_url || coverImg,
          stock: stockQty,
          price: price,
          status: (p.status === "published" ? "active" : p.status === "draft" ? "draft" : "archived") as any,
        };
      });
    }

    return [
      {
        id: p.slug || p.id,
        productId: p.id,
        name: p.name,
        category: categoryName,
        variant: "Tiêu chuẩn",
        sku: p.slug,
        imageUrl: coverImg,
        stock: Number(p.stock_total ?? 0),
        price: Number(p.price_vnd ?? 0),
        status: (p.status === "published" ? "active" : p.status === "draft" ? "draft" : "archived") as any,
      },
    ];
  };

  // Fetch real products by page (limit 10) with search and filters
  const fetchDrawerProducts = async (pageToFetch: number, isReset: boolean) => {
    if (isReset) {
      setIsLoadingInitial(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const queryParams: Parameters<typeof adminApi.products>[0] = {
        page: pageToFetch,
        limit: 10,
      };
      if (drawerSearchQuery.trim()) queryParams.q = drawerSearchQuery.trim();
      if (drawerCategoryFilter !== "all") queryParams.category_id = drawerCategoryFilter;
      if (drawerStatusFilter !== "all") queryParams.status = drawerStatusFilter;
      if (drawerStockFilter === "in_stock") queryParams.stock = "in";
      else if (drawerStockFilter === "out_of_stock") queryParams.stock = "out";

      const res = await adminApi.products(queryParams);

      const rows: AddProductCatalogRow[] = [];
      if (res && res.items) {
        res.items.forEach((p) => {
          rows.push(...mapProductToCatalogRows(p));
        });
      }

      if (isReset) {
        setDrawerProducts(rows);
      } else {
        setDrawerProducts((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const uniqueRows = rows.filter((r) => !existingIds.has(r.id));
          return [...prev, ...uniqueRows];
        });
      }

      setDrawerPage(pageToFetch);
      setTotalProducts(res.total ?? 0);
      setHasMore(pageToFetch * 10 < (res.total ?? 0));
    } catch (err) {
      console.warn("Failed to query products:", err);
    } finally {
      setIsLoadingInitial(false);
      setIsLoadingMore(false);
    }
  };

  // Trigger query with 300ms debounce on search / filter change
  useEffect(() => {
    if (!isAddProductOpen) return;
    const timer = setTimeout(() => {
      fetchDrawerProducts(1, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [
    isAddProductOpen,
    drawerSearchQuery,
    drawerCategoryFilter,
    drawerStatusFilter,
    drawerStockFilter,
  ]);

  // Infinite Scroll Handler (load 10 more on reaching bottom)
  const handleDrawerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < 60 && hasMore && !isLoadingMore && !isLoadingInitial) {
      fetchDrawerProducts(drawerPage + 1, false);
    }
  };

  // ── Payment & Fulfillment State ──
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid" | "failed" | "refunded">("pending");
  const [fulfillmentStatus, setFulfillmentStatus] = useState<"unfulfilled" | "processing" | "shipping" | "delivered">("unfulfilled");
  const [paymentMethod, setPaymentMethod] = useState<string>("Credit Card");
  const [fulfillmentLocation, setFulfillmentLocation] = useState<string>("Main Warehouse");

  // ── Shipping Method & Estimated Delivery ──
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express" | "free" | "pickup">("standard");
  const [estimatedDelivery, setEstimatedDelivery] = useState(defaultDeliveryRange);

  // ── Shipping Address State ──
  const [shippingAddress, setShippingAddress] = useState({
    firstName: "",
    lastName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "Vietnam",
  });

  // ── Billing Address State ──
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [billingAddress, setBillingAddress] = useState({
    firstName: "",
    lastName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "Vietnam",
  });

  // ── Internal Notes State ──
  const [notes, setNotes] = useState("");

  // ── Discount Dialog State ──
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountCode, setDiscountCode] = useState("");

  // Keep billing in sync when sameAsShipping is true
  useEffect(() => {
    if (sameAsShipping) {
      setBillingAddress(shippingAddress);
    }
  }, [sameAsShipping, shippingAddress]);

  // ── Filtered Customers for Search ──
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return availableCustomers;
    const q = customerSearchQuery.toLowerCase();
    return availableCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q),
    );
  }, [customerSearchQuery, availableCustomers]);

  // ── Item Calculations ──
  const subtotal = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
  }, [orderItems]);

  const shippingCost = useMemo(() => {
    if (shippingMethod === "standard") return 30_000;
    if (shippingMethod === "express") return 50_000;
    return 0;
  }, [shippingMethod]);

  const total = useMemo(() => {
    return Math.max(0, subtotal + shippingCost - discountAmount);
  }, [subtotal, shippingCost, discountAmount]);

  // Stepper handlers
  const handleQuantityChange = (itemId: string, delta: number) => {
    setOrderItems((prev) =>
      prev
        .map((it) => {
          if (it.id === itemId) {
            const newQty = it.quantity + delta;
            return newQty > 0 ? { ...it, quantity: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as OrderItemDraft[],
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setOrderItems((prev) => prev.filter((it) => it.id !== itemId));
    toast.success("Đã xóa sản phẩm khỏi đơn hàng");
  };

  // ── Drawer Actions ──
  const allFilteredSelected =
    drawerProducts.length > 0 &&
    drawerProducts.every((it) => drawerSelectedItems.some((s) => s.item.sku === it.sku));

  const handleToggleSelect = (item: AddProductCatalogRow) => {
    setDrawerSelectedItems((prev) => {
      const idx = prev.findIndex((s) => s.item.sku === item.sku);
      if (idx >= 0) {
        return prev.filter((s) => s.item.sku !== item.sku);
      } else {
        const q = catalogRowQuantities[item.sku] || 1;
        return [...prev, { item, quantity: q }];
      }
    });
  };

  const handleCatalogQtyChange = (sku: string, delta: number) => {
    const current = catalogRowQuantities[sku] || 1;
    const next = Math.max(1, current + delta);
    setCatalogRowQuantities((prev) => ({ ...prev, [sku]: next }));

    // Sync with selected items if present
    setDrawerSelectedItems((prev) =>
      prev.map((s) => (s.item.sku === sku ? { ...s, quantity: next } : s)),
    );
  };

  const handleSelectedQtyChange = (sku: string, delta: number) => {
    setDrawerSelectedItems((prev) =>
      prev.map((s) =>
        s.item.sku === sku ? { ...s, quantity: Math.max(1, s.quantity + delta) } : s,
      ),
    );
    setCatalogRowQuantities((prev) => ({
      ...prev,
      [sku]: Math.max(1, (prev[sku] || 1) + delta),
    }));
  };

  const handleRemoveSelected = (sku: string) => {
    setDrawerSelectedItems((prev) => prev.filter((s) => s.item.sku !== sku));
  };

  const handleClearAllSelected = () => {
    setDrawerSelectedItems([]);
  };

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      const currentSkus = new Set(drawerProducts.map((f) => f.sku));
      setDrawerSelectedItems((prev) => prev.filter((s) => !currentSkus.has(s.item.sku)));
    } else {
      const map = new Map(drawerSelectedItems.map((s) => [s.item.sku, s]));
      drawerProducts.forEach((item) => {
        if (!map.has(item.sku)) {
          map.set(item.sku, { item, quantity: catalogRowQuantities[item.sku] || 1 });
        }
      });
      setDrawerSelectedItems(Array.from(map.values()));
    }
  };

  const handleAddSelectedToOrder = () => {
    if (drawerSelectedItems.length === 0) {
      toast.error("Vui lòng chọn ít nhất một sản phẩm");
      return;
    }
    setOrderItems((prev) => {
      const next = [...prev];
      drawerSelectedItems.forEach(({ item, quantity }) => {
        const existingIdx = next.findIndex((x) => x.sku === item.sku);
        if (existingIdx >= 0) {
          const cur = next[existingIdx]!;
          next[existingIdx] = {
            ...cur,
            quantity: cur.quantity + quantity,
          };
        } else {
          next.push({
            id: `item-${Date.now()}-${item.sku}`,
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            category: item.category,
            variant: item.variant,
            sku: item.sku,
            imageUrl: item.imageUrl,
            quantity: quantity,
            unitPrice: item.price,
          });
        }
      });
      return next;
    });
    setIsAddProductOpen(false);
    toast.success(`Đã thêm ${drawerSelectedItems.length} sản phẩm vào đơn hàng`);
  };

  const selectedDrawerTotal = useMemo(() => {
    return drawerSelectedItems.reduce((acc, s) => acc + s.item.price * s.quantity, 0);
  }, [drawerSelectedItems]);

  // ── Completion Checklist Flags ──
  const isCustomerSelected = selectedCustomer !== null;
  const hasProducts = orderItems.length > 0;
  const isPaymentMethodSet = Boolean(paymentMethod);
  const isShippingAddressSet = Boolean(
    shippingAddress.addressLine1.trim() && shippingAddress.city.trim(),
  );
  const canCreate = isCustomerSelected && hasProducts && isPaymentMethodSet && isShippingAddressSet;

  // ── Submit Handlers ──
  const handleCreateOrder = async () => {
    if (!isCustomerSelected) {
      toast.error("Vui lòng chọn khách hàng cho đơn hàng");
      return;
    }
    if (!hasProducts) {
      toast.error("Vui lòng thêm ít nhất một sản phẩm");
      return;
    }
    if (!isShippingAddressSet) {
      toast.error("Vui lòng điền địa chỉ giao hàng");
      return;
    }

    setIsSubmitting(true);
    try {
      const isRealUuid =
        selectedCustomer &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedCustomer.id);

      const res = await adminApi.createOrder({
        customer_id: isRealUuid ? selectedCustomer.id : undefined,
        customer_name: selectedCustomer.name,
        customer_email: selectedCustomer.email || null,
        customer_phone: selectedCustomer.phone || null,
        shipping: {
          full_name: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
          phone: selectedCustomer.phone || null,
          address_line: [shippingAddress.addressLine1, shippingAddress.addressLine2].filter(Boolean).join(", "),
          city: shippingAddress.city,
          state: shippingAddress.state || null,
          postal_code: shippingAddress.zipCode || null,
          country: shippingAddress.country || "Vietnam",
          note: notes || null,
        },
        billing: sameAsShipping
          ? undefined
          : {
            full_name: `${billingAddress.firstName} ${billingAddress.lastName}`.trim(),
            address_line: [billingAddress.addressLine1, billingAddress.addressLine2].filter(Boolean).join(", "),
            city: billingAddress.city,
            country: billingAddress.country,
          },
        items: orderItems.map((it) => ({
          sku: it.sku,
          product_name: it.name,
          unit_price_vnd: Math.round(it.unitPrice),
          qty: it.quantity,
          size_label: it.variant.includes("/") ? (it.variant.split("/")[1]?.trim() ?? null) : (it.variant ?? null),
          color_label: it.variant.includes("/") ? (it.variant.split("/")[0]?.trim() ?? null) : null,
          image_url: it.imageUrl,
        })),
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        fulfillment_status: fulfillmentStatus,
        fulfillment_location: fulfillmentLocation,
        shipping_method: shippingMethod,
        shipping_vnd: Math.round(shippingCost),
        discount_vnd: Math.round(discountAmount),
        discount_code: discountCode || null,
        status: "confirmed",
        notes: notes || null,
      });

      const newOrd: EnhancedOrder = {
        id: res.id,
        order_number: res.order_number,
        customer_name: res.customer_name,
        customer_location: res.customer_location || shippingAddress.city,
        items_count: res.items_count || orderItems.reduce((acc, it) => acc + it.quantity, 0),
        item_images: orderItems.map((it) => it.imageUrl),
        extra_items: Math.max(0, orderItems.length - 3),
        grand_total_vnd: res.grand_total_vnd || Math.round(total),
        payment_method: res.payment_method || paymentMethod,
        payment_status: res.payment_status || paymentStatus,
        fulfillment_status: res.fulfillment_status === "unfulfilled" ? "processing" : res.fulfillment_status,
        placed_at: res.placed_at || new Date().toISOString(),
        status: res.status || "confirmed",
      };

      onOrderCreated(newOrd);
      toast.success(`Đã tạo đơn hàng thực #${res.order_number} thành công!`);
      onBack();
    } catch (err: unknown) {
      console.error("API createOrder failed:", err);
      toast.error(
        err instanceof Error
          ? adminErrorMessage(err)
          : "Không thể tạo đơn hàng trên hệ thống. Vui lòng kiểm tra lại!",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraftOrder = async () => {
    setIsSubmitting(true);
    try {
      const isRealUuid =
        selectedCustomer &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedCustomer.id);

      const res = await adminApi.createOrder({
        customer_id: isRealUuid ? selectedCustomer.id : undefined,
        customer_name: selectedCustomer?.name || "Khách bản nháp",
        customer_email: selectedCustomer?.email || null,
        customer_phone: selectedCustomer?.phone || null,
        shipping: {
          full_name: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() || "Khách bản nháp",
          address_line: shippingAddress.addressLine1 || "Chưa xác định",
          city: shippingAddress.city || "Hà Nội",
          state: shippingAddress.state || null,
          postal_code: shippingAddress.zipCode || null,
          country: shippingAddress.country || "Vietnam",
          note: notes || null,
        },
        items: orderItems.map((it) => ({
          sku: it.sku,
          product_name: it.name,
          unit_price_vnd: Math.round(it.unitPrice),
          qty: it.quantity,
          size_label: it.variant.includes("/") ? (it.variant.split("/")[1]?.trim() ?? null) : (it.variant ?? null),
          color_label: it.variant.includes("/") ? (it.variant.split("/")[0]?.trim() ?? null) : null,
          image_url: it.imageUrl,
        })),
        payment_method: paymentMethod || "card",
        payment_status: "pending",
        fulfillment_status: "unfulfilled",
        status: "pending",
        notes: notes || null,
      });

      const draftOrd: EnhancedOrder = {
        id: res.id,
        order_number: res.order_number,
        customer_name: res.customer_name,
        customer_location: res.customer_location || shippingAddress.city,
        items_count: res.items_count || orderItems.reduce((acc, it) => acc + it.quantity, 0),
        item_images: orderItems.map((it) => it.imageUrl),
        extra_items: Math.max(0, orderItems.length - 3),
        grand_total_vnd: res.grand_total_vnd || Math.round(total),
        payment_method: res.payment_method || "Chưa chọn",
        payment_status: "pending",
        fulfillment_status: "processing",
        placed_at: res.placed_at || new Date().toISOString(),
        status: "pending",
      };

      if (onSaveDraft) onSaveDraft(draftOrd);
      else onOrderCreated(draftOrd);
      toast.success(`Đã lưu bản nháp #${res.order_number}!`);
      onBack();
    } catch (err: unknown) {
      console.error("API createOrder draft failed:", err);
      toast.error(
        err instanceof Error
          ? adminErrorMessage(err)
          : "Không thể lưu đơn hàng nháp trên hệ thống. Vui lòng thử lại!",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-16">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            className="size-8.5 rounded-xs border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            title="Quay lại danh sách đơn hàng"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-slate-900 admin-page-title">
              Tạo đơn hàng
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Tạo đơn hàng thủ công cho khách hàng.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <Button
            variant="outline"
            disabled={isSubmitting}
            onClick={handleSaveDraftOrder}
            className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            <Bookmark className="size-3.5 text-slate-500" />
            <span>Lưu bản nháp</span>
          </Button>

          <Button
            disabled={isSubmitting}
            onClick={handleCreateOrder}
            className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4.5 text-sm font-medium text-white shadow-xs hover:bg-[#53389e] transition-colors disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            <span>{isSubmitting ? "Đang tạo..." : "Tạo đơn hàng"}</span>
          </Button>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* ═════════ LEFT COLUMN: MAIN FORM CONTENT ═════════ */}
        <div className="space-y-6">
          {/* Card 1: Customer */}
          <div className="rounded-xs border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="mb-4">
              <h2 className="text-slate-900 admin-section-title">Khách hàng</h2>
              <p className="text-sm text-slate-500">
                Tìm kiếm và chọn khách hàng đã có hoặc tạo mới.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Search Customer Input with Dropdown Popover */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setIsCustomerSearchOpen(true);
                  }}
                  onFocus={() => setIsCustomerSearchOpen(true)}
                  placeholder="Tìm theo tên, email hoặc số điện thoại..."
                  className="h-10 rounded-xs border-slate-200 pl-9 pr-8 text-sm placeholder:text-slate-400 focus-visible:ring-[#6941c6]"
                />
                {customerSearchQuery && (
                  <button
                    onClick={() => {
                      setCustomerSearchQuery("");
                      setIsCustomerSearchOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="size-3.5" />
                  </button>
                )}

                {/* Auto-suggest dropdown */}
                {isCustomerSearchOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xs border border-slate-200 bg-white p-1.5 shadow-lg">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-3 text-center text-sm text-slate-400">
                        Không tìm thấy khách hàng
                      </div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setShippingAddress((prev) => ({
                              ...prev,
                              firstName: c.name.split(" ")[0] || "Khách",
                              lastName: c.name.split(" ").slice(1).join(" ") || "Hàng",
                            }));
                            setIsCustomerSearchOpen(false);
                            setCustomerSearchQuery("");
                          }}
                          className="flex w-full items-center gap-3 rounded-xs p-2 text-left hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex size-7 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-[#6941c6]">
                            {c.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1 text-sm">
                            <p className="font-semibold text-slate-800">{c.name}</p>
                            <p className="truncate text-xs text-slate-400">
                              {c.email} · {c.phone}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Customer Card Preview */}
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-xs border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f4f3ff] text-sm font-semibold text-[#6941c6] shadow-2xs">
                      {selectedCustomer.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{selectedCustomer.name}</p>
                      <p className="truncate text-xs text-slate-500">{selectedCustomer.email}</p>
                      <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {selectedCustomer.ordersCount} đơn hàng · Khách hàng từ {selectedCustomer.joinedDate}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setIsCustomerSearchOpen(true);
                    }}
                    className="h-7.5 gap-1 rounded-xs border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    <Edit2 className="size-3 text-slate-400" />
                    <span>Thay đổi</span>
                  </Button>
                </div>
              ) : (
                <div className="flex h-16 items-center justify-center rounded-xs border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                  Chưa chọn khách hàng
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Order Items */}
          <div className="rounded-xs border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-slate-900 admin-section-title">Sản phẩm trong đơn</h2>
                <p className="text-sm text-slate-500">Thêm sản phẩm vào đơn hàng này.</p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddProductOpen(true)}
                className="h-8 gap-1.5 rounded-xs border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                <Plus className="size-3.5 text-slate-500" />
                <span>Thêm sản phẩm</span>
              </Button>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto rounded-xs border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="py-2.5 pl-4 pr-3">Sản phẩm</th>
                    <th className="px-3 py-2.5">Biến thể</th>
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5 text-center">Số lượng</th>
                    <th className="px-3 py-2.5 text-right">Đơn giá</th>
                    <th className="px-3 py-2.5 text-right">Thành tiền</th>
                    <th className="py-2.5 pl-2 pr-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                        Chưa có sản phẩm nào. Nhấn "+ Thêm sản phẩm" để chọn.
                      </td>
                    </tr>
                  ) : (
                    orderItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Product Thumbnail + Name */}
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="size-11 rounded-xs object-cover border border-slate-200/80 bg-slate-100 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate max-w-[170px] sm:max-w-xs">
                                {item.name}
                              </p>
                              <p className="text-xs text-slate-400">{item.category}</p>
                            </div>
                          </div>
                        </td>

                        {/* Variant */}
                        <td className="px-3 py-3 text-slate-600 font-medium">
                          {item.variant}
                        </td>

                        {/* SKU */}
                        <td className="px-3 py-3 tabular-nums text-xs text-slate-500">
                          {item.sku}
                        </td>

                        {/* Quantity Stepper */}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center">
                            <div className="inline-flex items-center rounded-xs border border-slate-200 bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.id, -1)}
                                className="flex size-7 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors rounded-l-xs"
                              >
                                <Minus className="size-3" />
                              </button>
                              <span className="w-8 text-center text-sm font-semibold text-slate-900 select-none">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.id, 1)}
                                className="flex size-7 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors rounded-r-xs"
                              >
                                <Plus className="size-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Unit Price */}
                        <td className="px-3 py-3 text-right font-medium text-slate-700">
                          {formatVnd(item.unitPrice)}
                        </td>

                        {/* Line Subtotal */}
                        <td className="px-3 py-3 text-right font-semibold text-slate-900">
                          {formatVnd(item.quantity * item.unitPrice)}
                        </td>

                        {/* Row Actions */}
                        <td className="py-3 pl-2 pr-3 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-xs text-slate-400 hover:text-slate-600"
                              >
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36 rounded-xs">
                              <DropdownMenuItem
                                onClick={() => {
                                  const promptQty = window.prompt("Nhập số lượng:", String(item.quantity));
                                  if (promptQty && !isNaN(Number(promptQty))) {
                                    const q = Math.max(1, parseInt(promptQty, 10));
                                    setOrderItems((prev) =>
                                      prev.map((it) => (it.id === item.id ? { ...it, quantity: q } : it)),
                                    );
                                  }
                                }}
                                className="text-sm"
                              >
                                Chỉnh sửa số lượng
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-sm text-rose-600 focus:text-rose-600"
                              >
                                <Trash2 className="mr-1.5 size-3" />
                                Xóa sản phẩm
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Payment & Fulfillment + Shipping Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment & Fulfillment */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="mb-4">
                <h2 className="text-slate-900 admin-section-title">Thanh toán và xử lý đơn</h2>
                <p className="text-sm text-slate-500">
                  Thiết lập trạng thái thanh toán và xử lý cho đơn hàng này.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Payment status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Trạng thái thanh toán
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as any)}
                      className="w-full h-9 rounded-xs border border-slate-200 bg-white px-2.5 text-sm text-slate-800 font-medium focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6] outline-none"
                    >
                      <option value="pending">● Chờ thanh toán</option>
                      <option value="paid">● Đã thanh toán</option>
                      <option value="failed">● Thanh toán thất bại</option>
                      <option value="refunded">● Đã hoàn tiền</option>
                    </select>
                  </div>

                  {/* Fulfillment status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Trạng thái xử lý đơn
                    </label>
                    <select
                      value={fulfillmentStatus}
                      onChange={(e) => setFulfillmentStatus(e.target.value as any)}
                      className="w-full h-9 rounded-xs border border-slate-200 bg-white px-2.5 text-sm text-slate-800 font-medium focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6] outline-none"
                    >
                      <option value="unfulfilled">● Chưa xử lý</option>
                      <option value="processing">● Đang xử lý</option>
                      <option value="shipping">● Đang giao</option>
                      <option value="delivered">● Đã giao</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Payment method */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Phương thức thanh toán
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full h-9 rounded-xs border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6] outline-none"
                    >
                      <option value="Credit Card">Thẻ tín dụng</option>
                      <option value="Bank Transfer">Chuyển khoản ngân hàng (VietQR)</option>
                      <option value="Cash on Delivery">Thanh toán khi nhận hàng (COD)</option>
                      <option value="PayPal">PayPal</option>
                    </select>
                  </div>

                  {/* Fulfillment location */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Địa điểm xử lý đơn
                    </label>
                    <select
                      value={fulfillmentLocation}
                      onChange={(e) => setFulfillmentLocation(e.target.value)}
                      className="w-full h-9 rounded-xs border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6] outline-none"
                    >
                      <option value="Main Warehouse">Kho chính</option>
                      <option value="Atelier Hanoi">Cửa hàng Hà Nội</option>
                      <option value="HCM Hub">Trung tâm TP. Hồ Chí Minh</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping Card */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="mb-4">
                <h2 className="text-slate-900 admin-section-title">Vận chuyển</h2>
                <p className="text-sm text-slate-500">
                  Chọn phương thức vận chuyển và thời gian giao dự kiến.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Phương thức vận chuyển
                  </label>
                  <select
                    value={shippingMethod}
                    onChange={(e) => setShippingMethod(e.target.value as any)}
                    className="w-full h-9 rounded-xs border border-slate-200 bg-white px-2.5 text-sm text-slate-800 font-medium focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6] outline-none"
                  >
                    <option value="standard">Giao hàng tiêu chuẩn (30.000 ₫)</option>
                    <option value="express">Giao hàng nhanh (50.000 ₫)</option>
                    <option value="free">Miễn phí vận chuyển</option>
                    <option value="pickup">Nhận tại cửa hàng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Giao hàng dự kiến
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={estimatedDelivery}
                      onChange={(e) => setEstimatedDelivery(e.target.value)}
                      placeholder="VD: 18/01 – 22/01/2024"
                      className="h-9 rounded-xs border-slate-200 pl-9 text-sm text-slate-800 focus-visible:ring-[#6941c6]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Shipping Address & Billing Address Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shipping Address */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-5 shadow-2xs">
              <h2 className="text-slate-900 mb-3 admin-section-title">Địa chỉ giao hàng</h2>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Tên
                    </label>
                    <Input
                      value={shippingAddress.firstName}
                      onChange={(e) =>
                        setShippingAddress((p) => ({ ...p, firstName: e.target.value }))
                      }
                      className="h-8.5 rounded-xs border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Họ
                    </label>
                    <Input
                      value={shippingAddress.lastName}
                      onChange={(e) =>
                        setShippingAddress((p) => ({ ...p, lastName: e.target.value }))
                      }
                      className="h-8.5 rounded-xs border-slate-200 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Địa chỉ
                  </label>
                  <Input
                    value={shippingAddress.addressLine1}
                    onChange={(e) =>
                      setShippingAddress((p) => ({ ...p, addressLine1: e.target.value }))
                    }
                    className="h-8.5 rounded-xs border-slate-200 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Địa chỉ bổ sung (không bắt buộc)
                  </label>
                  <Input
                    value={shippingAddress.addressLine2}
                    onChange={(e) =>
                      setShippingAddress((p) => ({ ...p, addressLine2: e.target.value }))
                    }
                    placeholder="Căn hộ, tầng, số phòng..."
                    className="h-8.5 rounded-xs border-slate-200 text-sm placeholder:text-slate-400"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Thành phố</label>
                    <Input
                      value={shippingAddress.city}
                      onChange={(e) =>
                        setShippingAddress((p) => ({ ...p, city: e.target.value }))
                      }
                      className="h-8.5 rounded-xs border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tỉnh / Thành</label>
                    <Input
                      value={shippingAddress.state}
                      onChange={(e) =>
                        setShippingAddress((p) => ({ ...p, state: e.target.value }))
                      }
                      className="h-8.5 rounded-xs border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mã bưu chính</label>
                    <Input
                      value={shippingAddress.zipCode}
                      onChange={(e) =>
                        setShippingAddress((p) => ({ ...p, zipCode: e.target.value }))
                      }
                      className="h-8.5 rounded-xs border-slate-200 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Quốc gia</label>
                  <select
                    value={shippingAddress.country}
                    onChange={(e) =>
                      setShippingAddress((p) => ({ ...p, country: e.target.value }))
                    }
                    className="w-full h-8.5 rounded-xs border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none"
                  >
                    <option value="United States">Hoa Kỳ</option>
                    <option value="Vietnam">Việt Nam</option>
                    <option value="France">Pháp</option>
                    <option value="United Kingdom">Vương quốc Anh</option>
                    <option value="Japan">Nhật Bản</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Billing Address */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-5 shadow-2xs">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-slate-900 admin-section-title">Địa chỉ thanh toán</h2>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-sm text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={sameAsShipping}
                    onChange={(e) => setSameAsShipping(e.target.checked)}
                    className="rounded-2xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                  />
                  <span>Giống địa chỉ giao hàng</span>
                </label>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Tên
                    </label>
                    <Input
                      disabled={sameAsShipping}
                      value={billingAddress.firstName}
                      onChange={(e) =>
                        setBillingAddress((p) => ({ ...p, firstName: e.target.value }))
                      }
                      className="h-8.5 rounded-xs border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Họ
                    </label>
                    <Input
                      disabled={sameAsShipping}
                      value={billingAddress.lastName}
                      onChange={(e) =>
                        setBillingAddress((p) => ({ ...p, lastName: e.target.value }))
                      }
                      className="h-8.5 rounded-xs border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Địa chỉ
                  </label>
                  <Input
                    disabled={sameAsShipping}
                    value={billingAddress.addressLine1}
                    onChange={(e) =>
                      setBillingAddress((p) => ({ ...p, addressLine1: e.target.value }))
                    }
                    className="h-8.5 rounded-xs border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Thành phố</label>
                    <Input
                      disabled={sameAsShipping}
                      value={billingAddress.city}
                      onChange={(e) =>
                        setBillingAddress((p) => ({ ...p, city: e.target.value }))
                      }
                      className="h-8.5 rounded-xs border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tỉnh / Thành</label>
                    <Input
                      disabled={sameAsShipping}
                      value={billingAddress.state}
                      onChange={(e) =>
                        setBillingAddress((p) => ({ ...p, state: e.target.value }))
                      }
                      className="h-8.5 rounded-xs border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mã bưu chính</label>
                    <Input
                      disabled={sameAsShipping}
                      value={billingAddress.zipCode}
                      onChange={(e) =>
                        setBillingAddress((p) => ({ ...p, zipCode: e.target.value }))
                      }
                      className="h-8.5 rounded-xs border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Quốc gia</label>
                  <select
                    disabled={sameAsShipping}
                    value={billingAddress.country}
                    onChange={(e) =>
                      setBillingAddress((p) => ({ ...p, country: e.target.value }))
                    }
                    className="w-full h-8.5 rounded-xs border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="United States">Hoa Kỳ</option>
                    <option value="Vietnam">Việt Nam</option>
                    <option value="France">Pháp</option>
                    <option value="United Kingdom">Vương quốc Anh</option>
                    <option value="Japan">Nhật Bản</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Internal Notes */}
          <div className="rounded-xs border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="shrink-0 sm:w-48">
                <span className="text-sm font-semibold text-slate-900 block">Ghi chú</span>
                <span className="text-sm text-slate-500 block">
                  Thêm ghi chú nội bộ cho đơn hàng (khách hàng không nhìn thấy).
                </span>
              </div>
              <div className="flex-1">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Khách yêu cầu gói quà hoặc có hướng dẫn đặc biệt..."
                  className="h-9.5 rounded-xs border-slate-200 text-sm placeholder:text-slate-400 focus-visible:ring-[#6941c6]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ═════════ RIGHT COLUMN: STICKY SIDEBAR ═════════ */}
        <div className="space-y-5 lg:sticky lg:top-20">
          {/* 1. Order Summary Card */}
          <div className="rounded-xs border border-slate-200/90 bg-white p-5 shadow-2xs">
            <h2 className="text-slate-900 mb-4 admin-section-title">Tóm tắt đơn hàng</h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Tạm tính ({orderItems.reduce((acc, it) => acc + it.quantity, 0)} sản phẩm)</span>
                <span className="font-medium text-slate-900">{formatVnd(subtotal)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Vận chuyển</span>
                <span className="font-medium text-slate-900">{formatVnd(shippingCost)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Giảm giá</span>
                <div className="flex items-center gap-1.5">
                  {discountAmount > 0 ? (
                    <span className="font-semibold text-emerald-600">
                      -{formatVnd(discountAmount)}
                    </span>
                  ) : (
                    <>
                      <span>—</span>
                      <button
                        type="button"
                        onClick={() => setIsDiscountOpen(true)}
                        className="text-xs font-semibold text-[#6941c6] hover:underline"
                      >
                        Thêm giảm giá
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Thuế</span>
                <span className="font-medium text-slate-900">Đã gồm trong giá</span>
              </div>

              <div className="my-2 border-t border-slate-200 pt-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-900">Tổng cộng</span>
                <span className="admin-metric font-semibold tracking-tight text-slate-900">
                  {formatVnd(total)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Status Card */}
          <div className="rounded-xs border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-slate-900 admin-section-title">Trạng thái</h2>
              <button
                type="button"
                onClick={() => {
                  window.scrollTo({ top: 380, behavior: "smooth" });
                }}
                className="text-sm font-semibold text-[#6941c6] hover:underline"
              >
                Chỉnh sửa
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <CreditCard className="size-3.5 text-slate-400" />
                  <span>Trạng thái thanh toán</span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold shadow-2xs",
                    paymentStatus === "paid"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      paymentStatus === "paid" ? "bg-emerald-500" : "bg-amber-500",
                    )}
                  />
                  {paymentStatus === "paid"
                    ? "Đã thanh toán"
                    : paymentStatus === "pending"
                      ? "Chờ thanh toán"
                      : paymentStatus}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <Package className="size-3.5 text-slate-400" />
                  <span>Trạng thái xử lý đơn</span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold shadow-2xs",
                    fulfillmentStatus === "delivered"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : fulfillmentStatus === "shipping"
                        ? "bg-sky-50 text-sky-700 border border-sky-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      fulfillmentStatus === "delivered"
                        ? "bg-emerald-500"
                        : fulfillmentStatus === "shipping"
                          ? "bg-sky-500"
                          : "bg-amber-500",
                    )}
                  />
                  {fulfillmentStatus === "unfulfilled"
                    ? "Chưa xử lý"
                    : fulfillmentStatus === "delivered"
                      ? "Đã giao"
                      : fulfillmentStatus === "shipping"
                        ? "Vận chuyển"
                        : fulfillmentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Order Completion Checklist Card */}
          <div className="rounded-xs border border-slate-200/90 bg-white p-5 shadow-2xs">
            <h2 className="text-slate-900 admin-section-title">Hoàn thiện đơn hàng</h2>
            <p className="text-xs text-slate-500 mb-4">
              Hoàn thành các mục dưới đây để tạo đơn hàng.
            </p>

            <div className="space-y-3.5">
              {/* Step 1: Customer selected */}
              <div className="flex items-start gap-3 text-sm">
                {isCustomerSelected ? (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#6941c6] text-white">
                    <Check className="size-3" />
                  </div>
                ) : (
                  <div className="size-5 shrink-0 rounded-full border border-slate-300" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">Đã chọn khách hàng</p>
                  <p className="text-xs text-slate-500">
                    {selectedCustomer ? selectedCustomer.name : "Chưa chọn"}
                  </p>
                </div>
              </div>

              {/* Step 2: Add at least one product */}
              <div className="flex items-start gap-3 text-sm">
                {hasProducts ? (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#6941c6] text-white">
                    <Check className="size-3" />
                  </div>
                ) : (
                  <div className="size-5 shrink-0 rounded-full border border-slate-300" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">Thêm ít nhất một sản phẩm</p>
                  <p className="text-xs text-slate-500">
                    {hasProducts ? `${orderItems.length} sản phẩm đã thêm` : "Chưa có sản phẩm"}
                  </p>
                </div>
              </div>

              {/* Step 3: Set payment method */}
              <div className="flex items-start gap-3 text-sm">
                {isPaymentMethodSet ? (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#6941c6] text-white">
                    <Check className="size-3" />
                  </div>
                ) : (
                  <div className="size-5 shrink-0 rounded-full border border-slate-300" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">Chọn phương thức thanh toán</p>
                  <p className="text-xs text-slate-500">
                    {paymentMethod ? adminLabel(paymentMethod) : "Chọn cách khách hàng thanh toán"}
                  </p>
                </div>
              </div>

              {/* Step 4: Set shipping address */}
              <div className="flex items-start gap-3 text-sm">
                {isShippingAddressSet ? (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#6941c6] text-white">
                    <Check className="size-3" />
                  </div>
                ) : (
                  <div className="size-5 shrink-0 rounded-full border border-slate-300" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">Nhập địa chỉ giao hàng</p>
                  <p className="text-xs text-slate-500">
                    {isShippingAddressSet
                      ? `${shippingAddress.addressLine1}, ${shippingAddress.city}`
                      : "Thêm địa chỉ giao hàng"}
                  </p>
                </div>
              </div>

              {/* Step 5: Review and create order */}
              <div className="flex items-start gap-3 text-sm">
                <div className="size-5 shrink-0 rounded-full border border-slate-300" />
                <div>
                  <p className="font-semibold text-slate-900">Kiểm tra và tạo đơn hàng</p>
                  <p className="text-xs text-slate-500">
                    Kiểm tra thông tin và tạo đơn hàng
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Products Slide-over Drawer (Reference Screenshot Design) ── */}
      {isAddProductOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsAddProductOpen(false)}
        >
          <div
            className="relative flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl overflow-hidden rounded-l-2xl animate-in slide-in-from-right duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 shrink-0">
              <div>
                <h2 className="text-slate-900 admin-section-title">Thêm sản phẩm</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Tìm và chọn sản phẩm để thêm vào đơn hàng.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                className="flex size-8 items-center justify-center rounded-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Search & Filters Toolbar */}
            <div className="border-b border-slate-100 px-6 py-4 shrink-0 bg-white">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                {/* Search box */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={drawerSearchQuery}
                    onChange={(e) => setDrawerSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên sản phẩm, mã SKU hoặc từ khóa..."
                    className="h-9.5 w-full rounded-xs border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6941c6] focus:outline-none focus:ring-1 focus:ring-[#6941c6]"
                  />
                </div>

                {/* 3 Dropdown Filters */}
                <div className="flex items-center gap-3">
                  {/* Category */}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-600 mb-1">Danh mục</span>
                    <div className="relative">
                      <select
                        value={drawerCategoryFilter}
                        onChange={(e) => setDrawerCategoryFilter(e.target.value)}
                        className="h-9.5 min-w-[130px] rounded-xs border border-slate-200 bg-white pl-3 pr-8 text-sm font-medium text-slate-700 outline-none appearance-none hover:border-slate-300 focus:border-[#6941c6]"
                      >
                        <option value="all">Tất cả danh mục</option>
                        {realCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-600 mb-1">Trạng thái</span>
                    <div className="relative">
                      <select
                        value={drawerStatusFilter}
                        onChange={(e) => setDrawerStatusFilter(e.target.value)}
                        className="h-9.5 min-w-[110px] rounded-xs border border-slate-200 bg-white pl-3 pr-8 text-sm font-medium text-slate-700 outline-none appearance-none hover:border-slate-300 focus:border-[#6941c6]"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="published">Đang hoạt động</option>
                        <option value="draft">Bản nháp</option>
                        <option value="archived">Đã lưu trữ</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* In stock */}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-600 mb-1">Còn hàng</span>
                    <div className="relative">
                      <select
                        value={drawerStockFilter}
                        onChange={(e) => setDrawerStockFilter(e.target.value)}
                        className="h-9.5 min-w-[120px] rounded-xs border border-slate-200 bg-white pl-3 pr-8 text-sm font-medium text-slate-700 outline-none appearance-none hover:border-slate-300 focus:border-[#6941c6]"
                      >
                        <option value="all">Tất cả sản phẩm</option>
                        <option value="in_stock">Chỉ sản phẩm còn hàng</option>
                        <option value="out_of_stock">Hết hàng</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Drawer Body with 2 distinct bordered blocks */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-slate-50/20">
              {/* Khối 1: Bảng danh sách sản phẩm (Card with its own border) */}
              <div className="rounded-xs border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <div
                  onScroll={handleDrawerScroll}
                  className="max-h-[360px] overflow-y-auto"
                >
                  <table className="w-full text-left text-sm table-fixed">
                    <colgroup>
                      <col className="w-10" />
                      <col className="w-[230px]" />
                      <col className="w-24" />
                      <col className="w-24" />
                      <col className="w-24" />
                      <col className="w-16" />
                      <col className="w-28" />
                      <col className="w-20" />
                    </colgroup>
                    <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-3 pl-4 pr-1">
                          <div
                            onClick={handleToggleSelectAll}
                            className={cn(
                              "size-4 rounded-xs border flex items-center justify-center cursor-pointer transition-colors",
                              allFilteredSelected
                                ? "bg-[#6941c6] border-[#6941c6] text-white"
                                : "border-slate-300 bg-white hover:border-slate-400",
                            )}
                          >
                            {allFilteredSelected && <Check className="size-3 stroke-[3]" />}
                          </div>
                        </th>
                        <th className="px-2 py-3">Sản phẩm</th>
                        <th className="px-2 py-3">Biến thể</th>
                        <th className="px-2 py-3">SKU</th>
                        <th className="px-2 py-3">Tồn kho</th>
                        <th className="px-2 py-3 text-right">Giá bán</th>
                        <th className="px-2 py-3 text-center">Số lượng</th>
                        <th className="pl-1 pr-4 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingInitial ? (
                        <tr>
                          <td colSpan={8} className="py-20 text-center text-sm text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Loader2 className="size-5 animate-spin text-[#6941c6]" />
                              <span>Đang tải danh sách sản phẩm...</span>
                            </div>
                          </td>
                        </tr>
                      ) : drawerProducts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-20 text-center text-sm text-slate-400">
                            Không tìm thấy sản phẩm phù hợp.
                          </td>
                        </tr>
                      ) : (
                        drawerProducts.map((item) => {
                          const isSelected = drawerSelectedItems.some((s) => s.item.sku === item.sku);
                          const selectedEntry = drawerSelectedItems.find((s) => s.item.sku === item.sku);
                          const currentQty = selectedEntry
                            ? selectedEntry.quantity
                            : catalogRowQuantities[item.sku] || 1;

                          return (
                            <tr
                              key={item.id}
                              className={cn(
                                "hover:bg-slate-50/70 transition-colors",
                                isSelected && "bg-purple-50/30",
                              )}
                            >
                              {/* Checkbox */}
                              <td className="py-3 pl-4 pr-1">
                                <div
                                  onClick={() => handleToggleSelect(item)}
                                  className={cn(
                                    "size-4 rounded-xs border flex items-center justify-center cursor-pointer transition-colors",
                                    isSelected
                                      ? "bg-[#6941c6] border-[#6941c6] text-white"
                                      : "border-slate-300 bg-white hover:border-slate-400",
                                  )}
                                >
                                  {isSelected && <Check className="size-3 stroke-[3]" />}
                                </div>
                              </td>

                              {/* Product Thumbnail + Name + Subtitle */}
                              <td className="px-2 py-3">
                                <div className="flex items-center gap-2.5">
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="size-10 rounded-xs object-cover border border-slate-200/80 bg-slate-100 shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-slate-900 truncate" title={item.name}>
                                      {item.name}
                                    </p>
                                    <p className="text-xs text-slate-400 truncate">{item.category}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Variant */}
                              <td className="px-2 py-3 text-slate-600 font-medium truncate" title={item.variant}>
                                {item.variant}
                              </td>

                              {/* SKU */}
                              <td className="px-2 py-3 tabular-nums text-xs text-slate-500 truncate" title={item.sku}>
                                {item.sku}
                              </td>

                              {/* Stock Pill */}
                              <td className="px-2 py-3 whitespace-nowrap">
                                {item.stock > 10 ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                    <span className="size-1.5 rounded-full bg-emerald-500" />
                                    {item.stock} còn hàng
                                  </span>
                                ) : item.stock > 0 ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                    <span className="size-1.5 rounded-full bg-amber-500" />
                                    {item.stock} còn hàng
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                    <span className="size-1.5 rounded-full bg-slate-400" />
                                    Hết hàng
                                  </span>
                                )}
                              </td>

                              {/* Price */}
                              <td className="px-2 py-3 text-right font-medium text-slate-900 whitespace-nowrap">
                                {formatVnd(item.price)}
                              </td>

                              {/* Quantity Stepper (Always fully visible) */}
                              <td className="px-2 py-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center">
                                  <div className="inline-flex items-center rounded-xs border border-slate-200 bg-white shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() => handleCatalogQtyChange(item.sku, -1)}
                                      className="flex size-7 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors rounded-l-xs"
                                    >
                                      <Minus className="size-3" />
                                    </button>
                                    <span className="w-7 text-center text-sm font-semibold text-slate-900 select-none">
                                      {currentQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCatalogQtyChange(item.sku, 1)}
                                      className="flex size-7 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors rounded-r-xs"
                                    >
                                      <Plus className="size-3" />
                                    </button>
                                  </div>
                                </div>
                              </td>

                              {/* Add Button (Always fully visible) */}
                              <td className="pl-1 pr-4 py-3 text-right whitespace-nowrap">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleToggleSelect(item)}
                                  className={cn(
                                    "h-7.5 rounded-xs px-3.5 text-sm font-semibold shadow-2xs transition-colors shrink-0",
                                    isSelected
                                      ? "bg-purple-100 text-[#6941c6] hover:bg-purple-200"
                                      : "bg-[#6941c6] text-white hover:bg-[#53389e]",
                                  )}
                                >
                                  {isSelected ? "Đã thêm" : "Thêm"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  {/* Loading more indicator */}
                  {isLoadingMore && (
                    <div className="py-3 flex items-center justify-center gap-2 text-sm text-slate-500 bg-slate-50/70 border-t border-slate-100">
                      <Loader2 className="size-3.5 animate-spin text-[#6941c6]" />
                      <span>Đang tải thêm 10 sản phẩm...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Khối 2: Selected items (Card with its own border) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-slate-900 admin-subsection-title">
                    Sản phẩm đã chọn ({drawerSelectedItems.length})
                  </h3>
                  {drawerSelectedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllSelected}
                      className="text-sm font-semibold text-[#6941c6] hover:underline cursor-pointer"
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>

                {drawerSelectedItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xs bg-white">
                    Chưa có sản phẩm nào được chọn.
                  </div>
                ) : (
                  <div className="rounded-xs border border-slate-200 bg-white overflow-hidden shadow-2xs max-h-[260px] overflow-y-auto">
                    <table className="w-full text-left text-sm table-fixed">
                      <colgroup>
                        <col className="w-[230px]" />
                        <col className="w-24" />
                        <col className="w-24" />
                        <col className="w-20" />
                        <col className="w-28" />
                        <col className="w-20" />
                        <col className="w-10" />
                      </colgroup>
                      <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                        <tr>
                          <th className="py-2.5 pl-4 pr-2">Sản phẩm</th>
                          <th className="px-2 py-2.5">Biến thể</th>
                          <th className="px-2 py-2.5">SKU</th>
                          <th className="px-2 py-2.5 text-right">Giá bán</th>
                          <th className="px-2 py-2.5 text-center">Số lượng</th>
                          <th className="px-2 py-2.5 text-right">Tạm tính</th>
                          <th className="py-2.5 pl-1 pr-3 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {drawerSelectedItems.map(({ item, quantity }) => (
                          <tr key={item.sku} className="hover:bg-slate-50/50">
                            {/* Product Info */}
                            <td className="py-2.5 pl-4 pr-2">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="size-9 rounded-xs object-cover border border-slate-200 bg-slate-100 shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate max-w-[170px]" title={item.name}>
                                    {item.name}
                                  </p>
                                  <p className="text-xs text-slate-400">{item.category}</p>
                                </div>
                              </div>
                            </td>

                            {/* Variant */}
                            <td className="px-2 py-2.5 text-slate-600 font-medium whitespace-nowrap">
                              {item.variant}
                            </td>

                            {/* SKU */}
                            <td className="px-2 py-2.5 tabular-nums text-xs text-slate-500 whitespace-nowrap">
                              {item.sku}
                            </td>

                            {/* Price */}
                            <td className="px-2 py-2.5 text-right font-medium text-slate-700 whitespace-nowrap">
                              {formatVnd(item.price)}
                            </td>

                            {/* Quantity Stepper */}
                            <td className="px-2 py-2.5">
                              <div className="flex items-center justify-center">
                                <div className="inline-flex items-center rounded-xs border border-slate-200 bg-white shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectedQtyChange(item.sku, -1)}
                                    className="flex size-6 items-center justify-center text-slate-500 hover:bg-slate-50 rounded-l-xs"
                                  >
                                    <Minus className="size-2.5" />
                                  </button>
                                  <span className="w-6 text-center text-sm font-semibold text-slate-900 select-none">
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectedQtyChange(item.sku, 1)}
                                    className="flex size-6 items-center justify-center text-slate-500 hover:bg-slate-50 rounded-r-xs"
                                  >
                                    <Plus className="size-2.5" />
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Subtotal */}
                            <td className="px-2 py-2.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                              {formatVnd(item.price * quantity)}
                            </td>

                            {/* Remove button */}
                            <td className="py-2.5 pl-1 pr-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSelected(item.sku)}
                                className="flex size-6 items-center justify-center rounded-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mx-auto"
                              >
                                <X className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Drawer Footer */}
            <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="text-sm font-medium text-slate-600">
                {drawerSelectedItems.length} sản phẩm đã chọn
              </div>

              <div className="flex items-center gap-5">
                <div className="text-right">
                  <span className="block text-xs font-medium text-slate-500 leading-none">
                    Tổng cộng
                  </span>
                  <span className="text-xl font-semibold tracking-tight text-slate-900">
                    {formatVnd(selectedDrawerTotal)}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddProductOpen(false)}
                  className="h-9 rounded-xs border-slate-200 px-4 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                >
                  Hủy
                </Button>

                <Button
                  type="button"
                  onClick={handleAddSelectedToOrder}
                  disabled={drawerSelectedItems.length === 0}
                  className="h-9 rounded-xs bg-[#6941c6] px-5 text-sm font-semibold text-white shadow-2xs hover:bg-[#53389e] disabled:opacity-50"
                >
                  Thêm vào đơn hàng
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Discount Dialog ── */}
      <Dialog open={isDiscountOpen} onOpenChange={setIsDiscountOpen}>
        <DialogContent className="sm:max-w-xs rounded-xs">
          <DialogHeader>
            <DialogTitle className="text-slate-900 admin-section-title">Thêm giảm giá</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Mã ưu đãi (tùy chọn)</label>
              <Input
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="VD: WELCOME10"
                className="h-8.5 rounded-xs border-slate-200 text-sm uppercase"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Số tiền giảm (₫)</label>
              <Input
                type="number"
                min={0}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="h-8.5 rounded-xs border-slate-200 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={() => {
                setIsDiscountOpen(false);
                toast.success(`Đã áp dụng giảm giá -${formatVnd(discountAmount)}`);
              }}
              className="rounded-xs bg-[#6941c6] text-white hover:bg-[#53389e] w-full"
            >
              Áp dụng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
