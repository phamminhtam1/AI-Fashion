import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";
import { formatVND, products } from "@/lib/products";
import { FREE_SHIP, useStore } from "@/lib/store";
import { fetchBankInfo, storeApi, type BankInfo } from "@/lib/api";
import { toast } from "sonner";

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

type Done = {
  orderNumber: string;
  grandTotalVnd: number;
  paymentMethod: "cod" | "bank";
};

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`Đã copy ${label}`),
    () => toast.error("Không copy được"),
  );
}

function Checkout() {
  const { cart, subtotal, placeOrder, user, sessionReady } = useStore();
  const nav = useNavigate();
  const [done, setDone] = useState<Done | null>(null);
  const [pay, setPay] = useState<"cod" | "bank">("cod");
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount_vnd: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const shipping = subtotal >= FREE_SHIP ? 0 : 30000;
  const discount = applied?.discount_vnd ?? 0;
  const grand = Math.max(0, subtotal + shipping - discount);

  async function applyCoupon() {
    setCouponError(null);
    const code = couponInput.trim();
    if (!code) {
      setCouponError("Nhập mã giảm giá");
      return;
    }
    setCouponBusy(true);
    try {
      const res = await storeApi.previewCoupon({ code, subtotal_vnd: subtotal });
      setApplied({ code: res.code, discount_vnd: res.discount_vnd });
      setCouponInput(res.code);
    } catch (err) {
      setApplied(null);
      setCouponError(err instanceof Error ? err.message : "Mã không hợp lệ");
    } finally {
      setCouponBusy(false);
    }
  }

  useEffect(() => {
    if (!sessionReady) return;
    if (!user) {
      void nav({ to: "/dang-nhap", search: { next: "/thanh-toan" } });
    }
  }, [sessionReady, user, nav]);

  useEffect(() => {
    if (pay !== "bank") return;
    let cancelled = false;
    void fetchBankInfo()
      .then((info) => {
        if (!cancelled) setBankInfo(info);
      })
      .catch((err) => {
        if (!cancelled) {
          setBankInfo(null);
          toast.error(err instanceof Error ? err.message : "Chưa cấu hình tài khoản ngân hàng");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pay]);

  if (done) {
    if (done.paymentMethod === "bank" && bankInfo) {
      const qr = `https://img.vietqr.io/image/${bankInfo.bank_bin}-${bankInfo.account_number}-compact2.png?amount=${done.grandTotalVnd}&addInfo=${encodeURIComponent(done.orderNumber)}&accountName=${encodeURIComponent(bankInfo.account_name)}`;
      return (
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" strokeWidth={1} />
          <h1 className="mt-6 text-4xl">Đơn đã tạo</h1>
          <p className="mt-3 text-muted-foreground">
            Mã đơn <b className="text-foreground">{done.orderNumber}</b>. Quét QR hoặc chuyển khoản đúng số tiền và nội dung để hệ thống xác nhận tự động.
          </p>
          <img src={qr} alt="VietQR chuyển khoản" className="mx-auto mt-8 h-56 w-56 bg-white object-contain p-2" />
          <dl className="mt-8 space-y-3 text-left text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border py-2">
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">Ngân hàng</dt>
                <dd>{bankInfo.bank_name}</dd>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2">
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">Số tài khoản</dt>
                <dd className="font-medium">{bankInfo.account_number}</dd>
              </div>
              <button type="button" className="p-2" aria-label="Copy STK" onClick={() => copyText("STK", bankInfo.account_number)}>
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2">
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">Chủ tài khoản</dt>
                <dd>{bankInfo.account_name}</dd>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2">
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">Số tiền</dt>
                <dd className="font-medium">{formatVND(done.grandTotalVnd)}</dd>
              </div>
              <button type="button" className="p-2" aria-label="Copy số tiền" onClick={() => copyText("số tiền", String(done.grandTotalVnd))}>
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2">
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">Nội dung CK</dt>
                <dd className="font-medium">{done.orderNumber}</dd>
              </div>
              <button type="button" className="p-2" aria-label="Copy nội dung" onClick={() => copyText("nội dung", done.orderNumber)}>
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </dl>
          <p className="mt-6 text-sm text-muted-foreground">Đơn sẽ chuyển sang đã thanh toán sau khi SePay nhận được giao dịch khớp mã và số tiền.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/" className="bg-primary px-10 py-4 text-xs uppercase tracking-widest text-primary-foreground">Tiếp tục mua sắm</Link>
            <Link to="/tai-khoan" className="border border-foreground px-10 py-4 text-xs uppercase tracking-widest">Xem đơn hàng</Link>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-lg py-32 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" strokeWidth={1} />
        <h1 className="mt-6 text-4xl">Cảm ơn bạn!</h1>
        <p className="mt-3 text-muted-foreground">
          Đơn hàng <b className="text-foreground">{done.orderNumber}</b> đã được đặt thành công. Chúng tôi sẽ liên hệ xác nhận trong thời gian sớm nhất.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/" className="bg-primary px-10 py-4 text-xs uppercase tracking-widest text-primary-foreground">Tiếp tục mua sắm</Link>
          <Link to="/tai-khoan" className="border border-foreground px-10 py-4 text-xs uppercase tracking-widest">Xem đơn hàng</Link>
        </div>
      </div>
    );
  }

  if (!sessionReady || !user) {
    return (
      <div className="py-32 text-center text-muted-foreground">
        Đang chuyển tới đăng nhập…
      </div>
    );
  }

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
        onSubmit={(e) => {
          e.preventDefault();
          if (pay === "bank" && !bankInfo) {
            toast.error("Chưa cấu hình tài khoản ngân hàng");
            return;
          }
          const f = new FormData(e.currentTarget);
          void (async () => {
            setSubmitting(true);
            try {
              const result = await placeOrder({
                fullName: String(f.get("name")),
                phone: String(f.get("phone")),
                email: String(f.get("email")),
                address: String(f.get("address")),
                city: String(f.get("city")),
                district: String(f.get("district")),
                note: String(f.get("note") || "") || undefined,
                paymentMethod: pay,
                total: grand,
                couponCode: applied?.code,
              });
              setDone(result);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Đặt hàng thất bại");
            } finally {
              setSubmitting(false);
            }
          })();
        }}
      >
        <div className="space-y-10">
          <fieldset className="space-y-3">
            <legend className="mb-4 text-xs uppercase tracking-widest">Thông tin giao hàng</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <input required name="name" defaultValue={user.name} placeholder="Họ và tên" className={input} aria-label="Họ và tên" />
              <input required name="phone" type="tel" defaultValue={user.phone} placeholder="Số điện thoại" className={input} aria-label="Số điện thoại" />
            </div>
            <input required name="email" type="email" defaultValue={user.email} placeholder="Email" className={input} aria-label="Email" />
            <input required name="address" placeholder="Địa chỉ" className={input} aria-label="Địa chỉ" />
            <div className="grid gap-3 md:grid-cols-2">
              <input required name="city" placeholder="Tỉnh / Thành phố" className={input} aria-label="Tỉnh / Thành phố" />
              <input required name="district" placeholder="Quận / Huyện" className={input} aria-label="Quận / Huyện" />
            </div>
            <textarea name="note" placeholder="Ghi chú đơn hàng" className={input} rows={3} aria-label="Ghi chú" />
          </fieldset>
          <fieldset>
            <legend className="mb-4 text-xs uppercase tracking-widest">Phương thức thanh toán</legend>
            <div className="divide-y divide-border border border-border">
              {([["cod", "Thanh toán khi nhận hàng (COD)"], ["bank", "Chuyển khoản ngân hàng"]] as const).map(([v, l]) => (
                <label key={v} className="flex cursor-pointer items-center gap-3 px-4 py-4 text-sm">
                  <input type="radio" name="pay" value={v} checked={pay === v} onChange={() => setPay(v)} className="accent-foreground" /> {l}
                </label>
              ))}
            </div>
            {pay === "bank" && bankInfo && (
              <div className="mt-4 space-y-1 border border-border bg-secondary/40 px-4 py-4 text-sm text-muted-foreground">
                <p><span className="text-foreground">{bankInfo.bank_name}</span> · {bankInfo.account_number}</p>
                <p>{bankInfo.account_name}</p>
                <p className="pt-1 text-xs">Nội dung chuyển khoản = mã đơn (hiện sau khi đặt).</p>
              </div>
            )}
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
                  <div className="flex-1"><p>{p.name}</p><p className="text-xs text-muted-foreground">{it.sku} · {it.size} · x{it.qty}</p></div>
                  <span>{formatVND((p.salePrice ?? p.price) * it.qty)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt>Tạm tính</dt><dd>{formatVND(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Vận chuyển</dt><dd>{shipping ? formatVND(shipping) : "Miễn phí"}</dd></div>
            {applied && (
              <div className="flex justify-between text-success">
                <dt>Giảm giá ({applied.code})</dt>
                <dd>−{formatVND(applied.discount_vnd)}</dd>
              </div>
            )}
            <div className="pt-2">
              <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">Mã giảm giá</label>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Nhập mã"
                  className={input}
                  aria-label="Mã giảm giá"
                  disabled={!!applied}
                />
                {applied ? (
                  <button
                    type="button"
                    className="shrink-0 border border-border px-3 text-xs uppercase tracking-widest"
                    onClick={() => {
                      setApplied(null);
                      setCouponError(null);
                    }}
                  >
                    Gỡ
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={couponBusy}
                    className="shrink-0 border border-foreground px-3 text-xs uppercase tracking-widest disabled:opacity-60"
                    onClick={() => void applyCoupon()}
                  >
                    {couponBusy ? "…" : "Áp dụng"}
                  </button>
                )}
              </div>
              {couponError && <p className="mt-2 text-xs text-destructive">{couponError}</p>}
            </div>
            <div className="flex justify-between pt-2 text-base font-medium"><dt>Tổng cộng</dt><dd>{formatVND(grand)}</dd></div>
          </dl>
          <button type="submit" disabled={submitting} className="mt-6 w-full bg-primary py-4 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-60">
            {submitting ? "Đang đặt…" : "Đặt hàng"}
          </button>
        </aside>
      </form>
    </div>
  );
}
