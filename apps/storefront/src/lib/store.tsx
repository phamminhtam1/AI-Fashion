import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { products, type Product } from "./products";
import { storeApi, type StoreOrderSummary } from "./api";

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
};
export type CartItem = { productId: string; variantId: string; sku: string; size: string; qty: number };

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
};

export type PlaceOrderResult = {
  orderNumber: string;
  grandTotalVnd: number;
  paymentMethod: "cod" | "bank";
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
  addToCart: (p: Product, variantId: string, qty?: number) => void;
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

  const refreshSession = async () => {
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
  };

  const refreshOrders = async () => {
    if (!user && !(await storeApi.me())) {
      setOrders([]);
      return;
    }
    const res = await storeApi.orders();
    setOrders(mapOrders(res.items));
  };

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
      });
      setCart([]);
      await refreshOrders().catch(() => {});
      return {
        orderNumber: res.order_number,
        grandTotalVnd: res.grand_total_vnd,
        paymentMethod: o.paymentMethod,
      };
    },
    cart,
    wishlist,
    cartOpen,
    setCartOpen,
    addToCart: (p, variantId, qty = 1) => {
      const v = p.variants.find((x) => x.id === variantId);
      if (!v) {
        toast.error("Không tìm thấy biến thể");
        return;
      }
      setCart((c) => {
        const i = c.findIndex((x) => x.variantId === variantId);
        if (i >= 0) return c.map((x, j) => (j === i ? { ...x, qty: x.qty + qty } : x));
        return [...c, { productId: p.id, variantId, sku: v.sku, size: v.size, qty }];
      });
      toast.success("Đã thêm vào giỏ hàng", { description: `${p.name} · ${v.sku} · ${v.size}` });
      setCartOpen(true);
    },
    updateQty: (i, qty) => setCart((c) => c.map((x, j) => (j === i ? { ...x, qty: Math.max(1, qty) } : x))),
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
