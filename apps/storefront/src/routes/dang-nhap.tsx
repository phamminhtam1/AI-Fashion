import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { AuthLayout, authInputClass } from "@/components/site/AuthLayout";
import { seo } from "@/components/site/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/dang-nhap")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    if (typeof s.next === "string" && s.next.length > 0) return { next: s.next };
    return {};
  },
  head: () => seo("Đăng nhập — ÉLANE", "Đăng nhập tài khoản ÉLANE để theo dõi đơn hàng và nhận ưu đãi thành viên.", [{ name: "robots", content: "noindex" }]),
  component: Login,
});

function Login() {
  const { login, storeSettings } = useStore();
  const nav = useNavigate();
  const { next } = Route.useSearch();

  return (
    <AuthLayout
      mode="login"
      title="Chào mừng bạn trở lại"
      description="Đăng nhập để tiếp tục hành trình cùng ÉLANE."
    >
      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void (async () => {
            try {
              await login(String(f.get("email")), String(f.get("password")));
              if (next?.startsWith("/")) window.location.assign(next);
              else nav({ to: "/tai-khoan" });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Đăng nhập thất bại");
            }
          })();
        }}
      >
        <div>
          <label htmlFor="login-email" className="text-[15px] font-medium text-[#26231f]">Email</label>
          <input id="login-email" name="email" required type="email" autoComplete="email" placeholder="email@vidu.com" className={authInputClass} />
        </div>
        <div>
          <label htmlFor="login-password" className="text-[15px] font-medium text-[#26231f]">Mật khẩu</label>
          <input id="login-password" name="password" required type="password" minLength={6} autoComplete="current-password" placeholder="Nhập mật khẩu của bạn" className={authInputClass} />
        </div>
        <div className="flex justify-end text-sm">
          <a
            href={`mailto:${storeSettings.brand.supportEmail}?subject=${encodeURIComponent("Hỗ trợ đăng nhập tài khoản ÉLANE")}`}
            className="text-[#6e6a64] underline decoration-[#b69b72] underline-offset-4 transition-colors hover:text-[#171717]"
          >
            Cần hỗ trợ đăng nhập?
          </a>
        </div>
        <button type="submit" className="group flex min-h-14 w-full items-center justify-center gap-3 bg-[#111111] px-6 text-sm font-medium tracking-[0.08em] text-white transition-colors hover:bg-[#34312d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
          Đăng nhập
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
        </button>
      </form>
      <p className="mt-7 border-t border-[#e5e1da] pt-6 text-[15px] text-[#6e6a64]">
        Chưa có tài khoản?{" "}
        <Link to="/dang-ky" className="font-medium text-[#171717] underline decoration-[#b69b72] underline-offset-4 transition-colors hover:text-[#8b6d43]">Đăng ký ngay</Link>
      </p>
    </AuthLayout>
  );
}
