import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { products, type Product } from "./products";
import { storeApi, ApiError, type StoreOrderItem, type StoreOrderSummary } from "./api";

/** Free-shipping threshold (VND) — matches announcement bar. */
export const FREE_SHIP = 1_000_000;

export type User = { id: string; name: string; email: string; phone?: string };
export type Order = {
  id: string;
  orderNumber: string;
  date: string;
  items: CartItem[];
  total: number;
  status: string;
  address: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paidAt?: string | null;
  itemsCount?: number;
  itemsPreview?: StoreOrderItem[];
};
export type CartItem = {
  productId: string;
  variantId: string;
  sku: string;
  size: string;
  qty: number;
  colorwayId?: string;
  colorName?: string;
  image?: string;
  maxStock?: number;
};

export function getCartItemImage(it: CartItem, p?: Product): string {
  if (it.image) return it.image;
  if (!p) return "";
  const v = p.variants.find((x) => x.id === it.variantId);
  const cwId = it.colorwayId || v?.colorwayId;
  const cw = p.colorways.find((c) => c.id === cwId);
  return cw?.thumbnail || cw?.images?.[0] || p.images[0] || "";
}

export type PlaceOrderInput = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  district: string;
  note?: string;
  paymentMethod: "cod" | "bank";
  total: number;
  couponCode?: string;
};

export type PlaceOrderResult = {
  id: string;
  orderNumber: string;
  grandTotalVnd: number;
  paymentMethod: "cod" | "bank";
  paymentStatus: string;
};

type Store = {
  user: User | null;
  sessionReady: boolean;
  refreshSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  orders: Order[];
  refreshOrders: () => Promise<void>;
  placeOrder: (o: PlaceOrderInput) => Promise<PlaceOrderResult>;
  cart: CartItem[];
  wishlist: string[];
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  addToCart: (p: Product, variantId: string, qty?: number) => boolean;
  updateQty: (i: number, qty: number) => void;
  removeItem: (i: number) => void;
  clearCart: () => void;
  toggleWishlist: (id: string) => void;
  cartCount: number;
  subtotal: number;
};

const Ctx = createContext<Store | null>(null);

function parseCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is CartItem =>
      !!x &&
      typeof x === "object" &&
      typeof (x as CartItem).productId === "string" &&
      typeof (x as CartItem).variantId === "string" &&
      typeof (x as CartItem).sku === "string" &&
      typeof (x as CartItem).size === "string" &&
      typeof (x as CartItem).qty === "number",
  );
}

function mapOrders(items: StoreOrderSummary[]): Order[] {
  return items.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    date: o.placed_at,
    items: [],
    total: o.grand_total_vnd,
    status: o.status,
    address: "",
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    paidAt: o.paid_at,
    itemsCount: o.items_count,
    itemsPreview: o.items_preview,
  }));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const refreshSession = useCallback(async () => {
    const me = await storeApi.me();
    if (!me) {
      setUser(null);
      return;
    }
    setUser({
      id: me.customer_id,
      name: me.full_name,
      email: me.email ?? "",
      phone: me.phone ?? undefined,
    });
    try {
      const wish = await storeApi.wishlist();
      setWishlist(wish.items.map((x) => x.product_id));
    } catch {
      /* keep local */
    }
  }, []);

  const inFlightOrdersRef = useRef<Promise<void> | null>(null);
  const lastOrdersFetchRef = useRef<number>(0);

  const refreshOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      return;
    }
    const now = Date.now();
    if (inFlightOrdersRef.current) {
      return inFlightOrdersRef.current;
    }
    // Throttle duplicate calls within 2000ms
    if (now - lastOrdersFetchRef.current < 2000) {
      return;
    }
    lastOrdersFetchRef.current = now;
    const p = (async () => {
      try {
        const res = await storeApi.orders();
        setOrders(mapOrders(res.items));
      } catch (err: unknown) {
        if (
          (err instanceof ApiError && err.status === 401) ||
          (typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 401)
        ) {
          setUser(null);
          setOrders([]);
        }
      } finally {
        inFlightOrdersRef.current = null;
      }
    })();
    inFlightOrdersRef.current = p;
    return p;
  }, [user]);

  useEffect(() => {
    try {
      setCart(parseCart(JSON.parse(localStorage.getItem("elane-cart") || "[]")));
      setWishlist(JSON.parse(localStorage.getItem("elane-wish") || "[]"));
      localStorage.removeItem("elane-user");
      localStorage.removeItem("elane-orders");
    } catch {
      setCart([]);
    }
    setReady(true);
    void (async () => {
      try {
        await refreshSession();
      } catch {
        setUser(null);
      } finally {
        setSessionReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("elane-cart", JSON.stringify(cart));
  }, [cart, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem("elane-wish", JSON.stringify(wishlist));
  }, [wishlist, ready]);

  useEffect(() => {
    if (ready && products.length > 0 && cart.length > 0) {
      const validCart = cart.filter((it) => products.some((p) => p.id === it.productId));
      if (validCart.length !== cart.length) {
        setCart(validCart);
      }
    }
  }, [ready, cart]);

  useEffect(() => {
    if (!sessionReady || !user) return;
    void refreshOrders().catch(() => setOrders([]));
  }, [sessionReady, user?.id]);

  const price = (id: string) => {
    const p = products.find((x) => x.id === id);
    return p ? p.salePrice ?? p.price : 0;
  };

  const value: Store = {
    user,
    sessionReady,
    refreshSession,
    login: async (email, password) => {
      await storeApi.login({ email, password });
      await refreshSession();
      toast.success("Đăng nhập thành công");
    },
    register: async ({ fullName, email, phone, password }) => {
      await storeApi.register({
        full_name: fullName,
        email,
        phone,
        password,
      });
      await refreshSession();
      toast.success(`Chào mừng, ${fullName}`);
    },
    logout: async () => {
      try {
        await storeApi.logout();
      } catch {
        /* still clear local */
      }
      setUser(null);
      setOrders([]);
      toast("Đã đăng xuất");
    },
    orders,
    refreshOrders,
    placeOrder: async (o) => {
      const res = await storeApi.placeOrder({
        items: cart.map((x) => ({ variant_id: x.variantId, qty: x.qty })),
        shipping: {
          full_name: o.fullName,
          phone: o.phone,
          email: o.email,
          address_line: o.address,
          city: o.city,
          district: o.district,
          note: o.note,
        },
        payment_method: o.paymentMethod,
        note: o.note,
        ...(o.couponCode ? { coupon_code: o.couponCode } : {}),
      });
      setCart([]);
      await refreshOrders().catch(() => {});
      return {
        id: res.id,
        orderNumber: res.order_number,
        grandTotalVnd: res.grand_total_vnd,
        paymentMethod: o.paymentMethod,
        paymentStatus: res.payment_status,
      };
    },
    cart,
    wishlist,
    cartOpen,
    setCartOpen,
    addToCart: (p, variantId, qty = 1): boolean => {
      const v = p.variants.find((x) => x.id === variantId);
      if (!v) {
        toast.error("Không tìm thấy biến thể sản phẩm");
        return false;
      }
      if (v.available <= 0) {
        toast.error("Sản phẩm này tạm thời đã hết hàng");
        return false;
      }
      const existing = cart.find((x) => x.variantId === variantId);
      const currentQty = existing ? existing.qty : 0;
      if (currentQty + qty > v.available) {
        const remaining = Math.max(0, v.available - currentQty);
        if (remaining <= 0) {
          toast.error(`Bạn đã có ${currentQty} sản phẩm trong giỏ hàng (kho chỉ còn tối đa ${v.available} sản phẩm)`);
        } else {
          toast.error(`Kho chỉ còn ${v.available} sản phẩm. Bạn đã có ${currentQty} trong giỏ và chỉ có thể thêm tối đa ${remaining} sản phẩm.`);
        }
        return false;
      }
      const cw = p.colorways.find((c) => c.id === v.colorwayId);
      const cwIndex = p.colorways.findIndex((c) => c.id === v.colorwayId);
      const colorName = cwIndex >= 0 ? p.colors[cwIndex]?.name : undefined;
      const image = cw?.thumbnail || cw?.images?.[0] || p.images[0];
      setCart((c) => {
        const i = c.findIndex((x) => x.variantId === variantId);
        if (i >= 0) return c.map((x, j) => (j === i ? { ...x, qty: x.qty + qty, maxStock: v.available } : x));
        return [
          ...c,
          {
            productId: p.id,
            variantId,
            sku: v.sku,
            size: v.size,
            qty,
            colorwayId: v.colorwayId,
            colorName,
            image,
            maxStock: v.available,
          },
        ];
      });
      toast.success("Đã thêm vào giỏ hàng", {
        description: `${p.name}${colorName ? ` · ${colorName}` : ""} · Size ${v.size} (SL: ${qty})`,
      });
      setCartOpen(true);
      return true;
    },
    updateQty: (i, qty) => {
      setCart((c) => {
        const it = c[i];
        if (!it) return c;
        if (qty <= 0) return c.filter((_, j) => j !== i);
        const p = products.find((x) => x.id === it.productId);
        const v = p?.variants.find((x) => x.id === it.variantId);
        const maxAvail = v?.available ?? it.maxStock ?? 99;
        if (qty > maxAvail) {
          toast.error(`Kho chỉ còn tối đa ${maxAvail} sản phẩm`);
          return c.map((x, j) => (j === i ? { ...x, qty: maxAvail, maxStock: maxAvail } : x));
        }
        return c.map((x, j) => (j === i ? { ...x, qty, maxStock: maxAvail } : x));
      });
    },
    removeItem: (i) => setCart((c) => c.filter((_, j) => j !== i)),
    clearCart: () => setCart([]),
    toggleWishlist: (id) => {
      if (!user) {
        toast.error("Vui lòng đăng nhập để lưu yêu thích");
        return;
      }
      const has = wishlist.includes(id);
      setWishlist((w) => (has ? w.filter((x) => x !== id) : [...w, id]));
      void (async () => {
        try {
          if (has) await storeApi.removeWishlist(id);
          else await storeApi.addWishlist(id);
          toast(has ? "Đã xóa khỏi danh sách yêu thích" : "Đã thêm vào danh sách yêu thích");
        } catch (e) {
          setWishlist((w) => (has ? [...w, id] : w.filter((x) => x !== id)));
          toast.error(e instanceof Error ? e.message : "Không cập nhật được yêu thích");
        }
      })();
    },
    cartCount: cart.reduce((s, x) => s + x.qty, 0),
    subtotal: cart.reduce((s, x) => s + price(x.productId) * x.qty, 0),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}
