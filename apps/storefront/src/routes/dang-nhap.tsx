import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { btnCls, inputCls, seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/dang-nhap")({
  head: () => seo("Đăng nhập — ÉLANE", "Đăng nhập tài khoản ÉLANE để theo dõi đơn hàng và nhận ưu đãi thành viên.", [{ name: "robots", content: "noindex" }]),
  component: Login,
});

function Login() {
  const { login } = useStore();
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-center text-4xl">Đăng nhập</h1>
      <p className="mt-3 text-center text-sm text-muted-foreground">Chào mừng bạn quay trở lại ÉLANE.</p>
      <form
        className="mt-10 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const email = String(new FormData(e.currentTarget).get("email"));
          login({ name: email.split("@")[0] ?? "Bạn", email });
          nav({ to: "/tai-khoan" });
        }}
      >
        <input name="email" required type="email" placeholder="Email" aria-label="Email" className={inputCls} />
        <input required type="password" minLength={6} placeholder="Mật khẩu" aria-label="Mật khẩu" className={inputCls} />
        <div className="flex justify-between py-2 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-foreground" /> Ghi nhớ đăng nhập</label>
          <a href="#" className="underline">Quên mật khẩu?</a>
        </div>
        <button className={`${btnCls} w-full`}>Đăng nhập</button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">Chưa có tài khoản? <Link to="/dang-ky" className="text-foreground underline">Đăng ký ngay</Link></p>
    </div>
  );
}
