import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { AuthLayout, authInputClass } from "@/components/site/AuthLayout";
import { seo } from "@/components/site/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/dang-ky")({
  head: () => seo("Đăng ký thành viên — ÉLANE", "Tạo tài khoản ÉLANE và nhận ngay ưu đãi 10% cho đơn hàng đầu tiên.", [{ name: "robots", content: "noindex" }]),
  component: Register,
});

function Register() {
  const { register } = useStore();
  const nav = useNavigate();

  return (
    <AuthLayout
      mode="register"
      title="Tạo tài khoản"
      description="Gia nhập ÉLANE để nhận ưu đãi 10% cho đơn hàng đầu tiên và theo dõi đơn mua dễ dàng."
    >
      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void (async () => {
            try {
              const phoneRaw = String(f.get("phone") || "").trim();
              await register({
                fullName: String(f.get("name")),
                email: String(f.get("email")),
                ...(phoneRaw ? { phone: phoneRaw } : {}),
                password: String(f.get("password")),
              });
              nav({ to: "/tai-khoan" });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Đăng ký thất bại");
            }
          })();
        }}
      >
        <div>
          <label htmlFor="register-name" className="text-[15px] font-medium text-[#26231f]">Họ và tên</label>
          <input id="register-name" name="name" required autoComplete="name" placeholder="Tên của bạn" className={authInputClass} />
        </div>
        <div>
          <label htmlFor="register-email" className="text-[15px] font-medium text-[#26231f]">Email</label>
          <input id="register-email" name="email" required type="email" autoComplete="email" placeholder="email@vidu.com" className={authInputClass} />
        </div>
        <div>
          <label htmlFor="register-phone" className="text-[15px] font-medium text-[#26231f]">Số điện thoại <span className="font-normal text-[#8a867f]">(không bắt buộc)</span></label>
          <input id="register-phone" name="phone" type="tel" autoComplete="tel" placeholder="090 000 0000" className={authInputClass} />
        </div>
        <div>
          <label htmlFor="register-password" className="text-[15px] font-medium text-[#26231f]">Mật khẩu</label>
          <input id="register-password" name="password" required type="password" minLength={6} autoComplete="new-password" placeholder="Tối thiểu 6 ký tự" className={authInputClass} />
        </div>
        <label className="flex items-start gap-3 py-1 text-sm leading-relaxed text-[#6e6a64]">
          <input required type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[#111111]" />
          <span>Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của ÉLANE.</span>
        </label>
        <button type="submit" className="group flex min-h-14 w-full items-center justify-center gap-3 bg-[#111111] px-6 text-sm font-medium tracking-[0.08em] text-white transition-colors hover:bg-[#34312d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
          Tạo tài khoản
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
        </button>
      </form>
      <p className="mt-6 border-t border-[#e5e1da] pt-5 text-[15px] text-[#6e6a64]">
        Đã có tài khoản?{" "}
        <Link to="/dang-nhap" className="font-medium text-[#171717] underline decoration-[#b69b72] underline-offset-4 transition-colors hover:text-[#8b6d43]">Đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}
