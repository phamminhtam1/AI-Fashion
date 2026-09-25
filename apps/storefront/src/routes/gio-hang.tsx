import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";
import { formatVND, products } from "@/lib/products";
import { FREE_SHIP, useStore } from "@/lib/store";

export const Route = createFileRoute("/gio-hang")({
  head: () => ({
    meta: [
      { title: "Giỏ hàng — ÉLANE" },
      { name: "description", content: "Xem lại các sản phẩm trong giỏ hàng ÉLANE của bạn." },
      { property: "og:title", content: "Giỏ hàng — ÉLANE" },
      { property: "og:description", content: "Xem lại các sản phẩm trong giỏ hàng ÉLANE của bạn." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { cart, subtotal, updateQty, removeItem } = useStore();
  const shipping = subtotal >= FREE_SHIP || subtotal === 0 ? 0 : 30000;
  if (cart.length === 0)
    return (
      <div className="py-32 text-center">
        <h1 className="text-4xl">Giỏ hàng trống</h1>
        <p className="mt-3 text-muted-foreground">Hãy khám phá những thiết kế mới nhất của chúng tôi.</p>
        <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className="mt-8 inline-block bg-primary px-10 py-4 text-xs uppercase tracking-widest text-primary-foreground">Tiếp tục mua sắm</Link>
      </div>
    );
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <h1 className="text-4xl">Giỏ hàng</h1>
      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-border border-y border-border">
          {cart.map((it, i) => {
            const p = products.find((x) => x.id === it.productId)!;
            return (
              <li key={i} className="flex gap-5 py-6">
                <Link to="/san-pham/$slug" params={{ slug: p.slug }}><img src={p.images[0]} alt={p.name} className="h-36 w-27 object-cover" /></Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-4">
                    <div><p>{p.name}</p><p className="mt-1 text-sm text-muted-foreground">{it.sku} · Size {it.size}</p></div>
                    <button onClick={() => removeItem(i)} aria-label="Xóa"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center border border-border">
                      <button className="p-2" onClick={() => updateQty(i, it.qty - 1)} aria-label="Giảm"><Minus className="h-3 w-3" /></button>
                      <span className="w-8 text-center text-sm">{it.qty}</span>
                      <button className="p-2" onClick={() => updateQty(i, it.qty + 1)} aria-label="Tăng"><Plus className="h-3 w-3" /></button>
                    </div>
                    <span>{formatVND((p.salePrice ?? p.price) * it.qty)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <aside className="h-fit bg-secondary p-8">
          <h2 className="text-xl">Tóm tắt đơn hàng</h2>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between"><dt>Tạm tính</dt><dd>{formatVND(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Vận chuyển</dt><dd>{shipping ? formatVND(shipping) : "Miễn phí"}</dd></div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-medium"><dt>Tổng cộng</dt><dd>{formatVND(subtotal + shipping)}</dd></div>
          </dl>
          <Link to="/thanh-toan" className="mt-6 block bg-primary py-4 text-center text-xs uppercase tracking-widest text-primary-foreground">Tiến hành thanh toán</Link>
        </aside>
      </div>
    </div>
  );
}
