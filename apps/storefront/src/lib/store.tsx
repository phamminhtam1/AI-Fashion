import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { products, type Product } from "./products";

export type User = { name: string; email: string; phone?: string };
export type Order = { id: string; date: string; items: CartItem[]; total: number; status: string; address: string };
export type CartItem = { productId: string; size: string; color: string; qty: number };

type Store = {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
  orders: Order[];
  placeOrder: (o: Omit<Order, "id" | "date" | "status" | "items">) => string;
  cart: CartItem[];
  wishlist: string[];
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  addToCart: (p: Product, size: string, color: string, qty?: number) => void;
  updateQty: (i: number, qty: number) => void;
  removeItem: (i: number) => void;
  clearCart: () => void;
  toggleWishlist: (id: string) => void;
  cartCount: number;
  subtotal: number;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    try {
      setCart(JSON.parse(localStorage.getItem("elane-cart") || "[]"));
      setWishlist(JSON.parse(localStorage.getItem("elane-wish") || "[]"));
      setUser(JSON.parse(localStorage.getItem("elane-user") || "null"));
      setOrders(JSON.parse(localStorage.getItem("elane-orders") || "[]"));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("elane-cart", JSON.stringify(cart));
  }, [cart, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem("elane-wish", JSON.stringify(wishlist));
  }, [wishlist, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("elane-user", JSON.stringify(user));
    localStorage.setItem("elane-orders", JSON.stringify(orders));
  }, [user, orders, ready]);

  const price = (id: string) => {
    const p = products.find((x) => x.id === id);
    return p ? p.salePrice ?? p.price : 0;
  };

  const value: Store = {
    user,
    login: (u) => { setUser(u); toast.success(`Chào mừng, ${u.name}`); },
    logout: () => { setUser(null); toast("Đã đăng xuất"); },
    orders,
    placeOrder: (o) => {
      const id = "ELN" + Math.floor(100000 + Math.random() * 900000);
      setOrders((os) => [{ ...o, id, date: new Date().toISOString(), status: "Đang xử lý", items: cart }, ...os]);
      setCart([]);
      return id;
    },
    cart,
    wishlist,
    cartOpen,
    setCartOpen,
    addToCart: (p, size, color, qty = 1) => {
      setCart((c) => {
        const i = c.findIndex((x) => x.productId === p.id && x.size === size && x.color === color);
        if (i >= 0) return c.map((x, j) => (j === i ? { ...x, qty: x.qty + qty } : x));
        return [...c, { productId: p.id, size, color, qty }];
      });
      toast.success("Đã thêm vào giỏ hàng", { description: `${p.name} · ${color} · ${size}` });
      setCartOpen(true);
    },
    updateQty: (i, qty) => setCart((c) => c.map((x, j) => (j === i ? { ...x, qty: Math.max(1, qty) } : x))),
    removeItem: (i) => setCart((c) => c.filter((_, j) => j !== i)),
    clearCart: () => setCart([]),
    toggleWishlist: (id) =>
      setWishlist((w) => {
        const has = w.includes(id);
        toast(has ? "Đã xóa khỏi danh sách yêu thích" : "Đã thêm vào danh sách yêu thích");
        return has ? w.filter((x) => x !== id) : [...w, id];
      }),
    cartCount: cart.reduce((s, x) => s + x.qty, 0),
    subtotal: cart.reduce((s, x) => s + price(x.productId) * x.qty, 0),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

export const FREE_SHIP = 1000000;
