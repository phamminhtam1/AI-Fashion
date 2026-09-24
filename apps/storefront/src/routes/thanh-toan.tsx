import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { formatVND, products } from "@/lib/products";
import { FREE_SHIP, useStore } from "@/lib/store";

export const Route = createFileRoute("/thanh-toan")({
  head: () => ({
    meta: [
      { title: "Thanh toán — ÉLANE" },
      { name: "description", content: "Hoàn tất đơn hàng ÉLANE của bạn an toàn và nhanh chóng." },
      { property: "og:title", content: "Thanh toán — ÉLANE" },
      { property: "og:description", content: "Hoàn tất đơn hàng ÉLANE của bạn." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

const input = "w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground";

function Checkout() {
  const { cart, subtotal, placeOrder, user } = useStore();
  const [done, setDone] = useState<string | null>(null);
  const [pay, setPay] = useState("cod");
  const shipping = subtotal >= FREE_SHIP ? 0 : 30000;

  if (done)
    return (
      <div className="mx-auto max-w-lg py-32 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" strokeWidth={1} />
        <h1 className="mt-6 text-4xl">Cảm ơn bạn!</h1>
        <p className="mt-3 text-muted-foreground">Đơn hàng <b className="text-foreground">{done}</b> đã được đặt thành công. Chúng tôi sẽ liên hệ xác nhận trong thời gian sớm nhất.</p>
        <div className="mt-8 flex justify-center gap-3"><Link to="/" className="bg-primary px-10 py-4 text-xs uppercase tracking-widest text-primary-foreground">Tiếp tục mua sắm</Link><Link to="/tai-khoan" className="border border-foreground px-10 py-4 text-xs uppercase tracking-widest">Xem đơn hàng</Link></div>
      </div>
    );

  if (cart.length === 0)
    return (
      <div className="py-32 text-center">
        <h1 className="text-3xl">Giỏ hàng của bạn đang trống</h1>
        <Link to="/" className="mt-6 inline-block underline">Về trang chủ</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <h1 className="text-4xl">Thanh toán</h1>
      <form
        className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]"
        onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setDone(placeOrder({ total: subtotal + shipping, address: `${f.get("address")}, ${f.get("district")}, ${f.get("city")}` })); }}
      >
        <div className="space-y-10">
          <fieldset className="space-y-3">
            <legend className="mb-4 text-xs uppercase tracking-widest">Thông tin giao hàng</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <input required name="name" defaultValue={user?.name} placeholder="Họ và tên" className={input} aria-label="Họ và tên" />
              <input required type="tel" placeholder="Số điện thoại" className={input} aria-label="Số điện thoại" />
            </div>
            <input required type="email" defaultValue={user?.email} placeholder="Email" className={input} aria-label="Email" />
            <input required name="address" placeholder="Địa chỉ" className={input} aria-label="Địa chỉ" />
            <div className="grid gap-3 md:grid-cols-2">
              <input required name="city" placeholder="Tỉnh / Thành phố" className={input} aria-label="Tỉnh / Thành phố" />
              <input required name="district" placeholder="Quận / Huyện" className={input} aria-label="Quận / Huyện" />
            </div>
            <textarea placeholder="Ghi chú đơn hàng" className={input} rows={3} aria-label="Ghi chú" />
          </fieldset>
          <fieldset>
            <legend className="mb-4 text-xs uppercase tracking-widest">Phương thức thanh toán</legend>
            <div className="divide-y divide-border border border-border">
              {[["cod", "Thanh toán khi nhận hàng (COD)"], ["bank", "Chuyển khoản ngân hàng"], ["card", "Thẻ tín dụng / ghi nợ"], ["wallet", "Ví MoMo / ZaloPay"]].map(([v, l]) => (
                <label key={v} className="flex cursor-pointer items-center gap-3 px-4 py-4 text-sm">
                  <input type="radio" name="pay" value={v} checked={pay === v} onChange={() => setPay(v!)} className="accent-foreground" /> {l}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <aside className="h-fit bg-secondary p-8">
          <h2 className="text-xl">Đơn hàng ({cart.length})</h2>
          <ul className="mt-6 space-y-4">
            {cart.map((it, i) => {
              const p = products.find((x) => x.id === it.productId)!;
              return (
                <li key={i} className="flex gap-3 text-sm">
                  <img src={p.images[0]} alt={p.name} className="h-20 w-15 object-cover" />
                  <div className="flex-1"><p>{p.name}</p><p className="text-xs text-muted-foreground">{it.color} · {it.size} · x{it.qty}</p></div>
                  <span>{formatVND((p.salePrice ?? p.price) * it.qty)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt>Tạm tính</dt><dd>{formatVND(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Vận chuyển</dt><dd>{shipping ? formatVND(shipping) : "Miễn phí"}</dd></div>
            <div className="flex justify-between pt-2 text-base font-medium"><dt>Tổng cộng</dt><dd>{formatVND(subtotal + shipping)}</dd></div>
          </dl>
          <button className="mt-6 w-full bg-primary py-4 text-xs uppercase tracking-widest text-primary-foreground">Đặt hàng</button>
        </aside>
      </form>
    </div>
  );
}
