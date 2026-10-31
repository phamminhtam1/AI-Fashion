import type { ReactNode } from "react";
import heroImage from "@/assets/hero.jpg";

type AuthLayoutProps = {
  mode: "login" | "register";
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthLayout({ mode, title, description, children }: AuthLayoutProps) {
  const brandNote = mode === "register"
    ? "Thành viên mới nhận ưu đãi 10% cho đơn đầu tiên."
    : "Thiết kế dành cho những khoảnh khắc của riêng bạn.";

  return (
    <section className="mx-auto max-w-[1320px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-12">
      <div className="grid overflow-hidden rounded-tl-[36px] rounded-br-[36px] border border-[#e5e1da] bg-[#f7f6f3] lg:min-h-[620px] lg:grid-cols-[1.02fr_.98fr]">
        <aside className="relative min-h-[170px] overflow-hidden sm:min-h-[210px] lg:min-h-[620px]" aria-label="ÉLANE — Modern Femininity">
          <img
            src={heroImage}
            alt="Bộ sưu tập thời trang nữ ÉLANE"
            className="absolute inset-0 h-full w-full object-cover object-[72%_8%] lg:object-[72%_center]"
          />
          <div className="absolute inset-0 bg-white/10" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-white/80 px-4 py-3 sm:px-6 lg:inset-x-auto lg:bottom-10 lg:left-8 lg:flex-col lg:items-start lg:gap-4 lg:bg-transparent lg:p-0 xl:left-10">
            <img
              src="/images/elane-logo.png"
              alt="ÉLANE — Modern Femininity"
              className="w-[132px] shrink-0 object-contain sm:w-[168px] lg:w-[min(28vw,340px)]"
            />
            <p className="max-w-[230px] text-right text-xs leading-relaxed text-[#29251f] sm:text-sm lg:text-left lg:text-base">
              {brandNote}
            </p>
          </div>
        </aside>

        <div className="flex items-center justify-center px-5 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-14 xl:px-16">
          <div className="w-full max-w-[440px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
            <h1 className="font-serif text-[30px] leading-tight tracking-[-0.035em] text-[#111111] sm:text-4xl">{title}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6e6a64] sm:text-base">{description}</p>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export const authInputClass = "mt-2 min-h-12 w-full rounded-none border border-[#d8d4cd] bg-white px-4 text-[15px] text-[#171717] outline-none transition-colors placeholder:text-[#9b978f] focus-visible:border-[#171717] focus-visible:ring-2 focus-visible:ring-[#171717]/10";
