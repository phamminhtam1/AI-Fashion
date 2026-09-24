import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { btnCls, inputCls, seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/dang-ky")({
  head: () => seo("Đăng ký thành viên — ÉLANE", "Tạo tài khoản ÉLANE và nhận ngay ưu đãi 10% cho đơn hàng đầu tiên.", [{ name: "robots", content: "noindex" }]),
  component: Register,
});

function Register() {
  const { login } = useStore();
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-center text-4xl">Tạo tài khoản</h1>
      <p className="mt-3 text-center text-sm text-muted-foreground">Nhận ưu đãi 10% cho đơn đầu tiên và quyền lợi thành viên.</p>
      <form
        className="mt-10 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          login({ name: String(f.get("name")), email: String(f.get("email")), phone: String(f.get("phone")) });
          nav({ to: "/tai-khoan" });
        }}
      >
        <input name="name" required placeholder="Họ và tên" aria-label="Họ và tên" className={inputCls} />
        <input name="email" required type="email" placeholder="Email" aria-label="Email" className={inputCls} />
        <input name="phone" type="tel" placeholder="Số điện thoại" aria-label="Số điện thoại" className={inputCls} />
        <input required type="password" minLength={6} placeholder="Mật khẩu (tối thiểu 6 ký tự)" aria-label="Mật khẩu" className={inputCls} />
        <label className="flex items-start gap-2 py-2 text-xs text-muted-foreground">
          <input required type="checkbox" className="mt-0.5 accent-foreground" /> Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của ÉLANE.
        </label>
        <button className={`${btnCls} w-full`}>Đăng ký</button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">Đã có tài khoản? <Link to="/dang-nhap" className="text-foreground underline">Đăng nhập</Link></p>
    </div>
  );
}
