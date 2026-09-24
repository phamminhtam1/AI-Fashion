import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Package } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatVND, products } from "@/lib/products";
import { btnCls, seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/tai-khoan")({
  head: () => seo("Tài khoản của tôi — ÉLANE", "Quản lý thông tin cá nhân, đơn hàng và danh sách yêu thích tại ÉLANE.", [{ name: "robots", content: "noindex" }]),
  component: Account,
});

function Account() {
  const { user, logout, orders, wishlist } = useStore();
  const [tab, setTab] = useState<"overview" | "orders" | "profile">("overview");

  if (!user)
    return (
      <div className="mx-auto max-w-md px-6 py-28 text-center">
        <h1 className="text-4xl">Tài khoản</h1>
        <p className="mt-3 text-muted-foreground">Đăng nhập để xem đơn hàng và quyền lợi thành viên.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/dang-nhap" className={btnCls}>Đăng nhập</Link>
          <Link to="/dang-ky" className="border border-foreground px-10 py-4 text-xs uppercase tracking-widest">Đăng ký</Link>
        </div>
      </div>
    );

  const tabs = [["overview", "Tổng quan"], ["orders", "Đơn hàng của tôi"], ["profile", "Thông tin cá nhân"]] as const;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Thành viên ÉLANE</p>
      <h1 className="mt-2 text-4xl">Xin chào, {user.name}</h1>
      <div className="mt-10 grid gap-10 md:grid-cols-[220px_1fr]">
        <aside className="flex gap-4 overflow-x-auto border-b border-border pb-3 text-sm md:flex-col md:border-b-0 md:border-r md:pb-0">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap text-left ${tab === k ? "font-medium underline underline-offset-4" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
          <Link to="/yeu-thich" className="whitespace-nowrap text-muted-foreground hover:text-foreground">Yêu thích ({wishlist.length})</Link>
          <button onClick={logout} className="whitespace-nowrap text-left text-muted-foreground hover:text-foreground">Đăng xuất</button>
        </aside>

        <section>
          {tab === "overview" && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[["Đơn hàng", orders.length], ["Yêu thích", wishlist.length], ["Hạng thành viên", "Silver"]].map(([l, v]) => (
                <div key={l} className="bg-secondary p-6"><p className="text-[11px] uppercase tracking-widest text-muted-foreground">{l}</p><p className="mt-3 font-serif text-3xl">{v}</p></div>
              ))}
              <div className="border border-border p-6 sm:col-span-3">
                <p className="font-serif text-xl">Ưu đãi của bạn</p>
                <p className="mt-2 text-sm text-muted-foreground">Mã <b className="text-foreground">WELCOME10</b> — giảm 10% cho đơn hàng đầu tiên.</p>
              </div>
            </div>
          )}

          {tab === "orders" && (orders.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} />
              <p className="mt-4 text-muted-foreground">Bạn chưa có đơn hàng nào.</p>
              <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className={`${btnCls} mt-6 inline-block`}>Mua sắm ngay</Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((o) => (
                <li key={o.id} className="border border-border p-6">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <div><p className="font-medium">#{o.id}</p><p className="text-xs text-muted-foreground">{new Date(o.date).toLocaleDateString("vi-VN")} · {o.address}</p></div>
                    <span className="h-fit bg-secondary px-3 py-1 text-xs">{o.status}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {o.items.map((it, i) => {
                      const p = products.find((x) => x.id === it.productId);
                      return p ? <img key={i} src={p.images[0]} alt={p.name} className="h-20 w-15 object-cover" /> : null;
                    })}
                  </div>
                  <p className="mt-4 text-right text-sm">Tổng: <b>{formatVND(o.total)}</b></p>
                </li>
              ))}
            </ul>
          ))}

          {tab === "profile" && (
            <dl className="divide-y divide-border border-y border-border text-sm">
              {[["Họ và tên", user.name], ["Email", user.email], ["Số điện thoại", user.phone || "—"]].map(([k, v]) => (
                <div key={k} className="flex justify-between py-4"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
