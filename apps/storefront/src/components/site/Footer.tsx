import { ArrowRight, Facebook, Instagram, Mail, PhoneCall, Youtube } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { formatVND } from "@/lib/products";
import { useStore } from "@/lib/store";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const shop: [string, string][] = [
  ["hang-moi", "Hàng mới"],
  ["cong-so", "Công sở"],
  ["du-tiec", "Dự tiệc"],
  ["sale", "Sale"],
];

const socialNetworks = [
  [Instagram, "Instagram"],
  [Facebook, "Facebook"],
  [Youtube, "YouTube"],
] as const;

function SocialLinks() {
  return (
    <div className="mt-5 flex items-center gap-2">
      {socialNetworks.map(([Icon, label]) => (
        <a
          key={label}
          href="#"
          aria-label={label}
          className="grid size-10 place-items-center rounded-full border border-[#cfc6ba] text-[#39342f] transition-colors hover:border-[#211f1c] hover:bg-[#211f1c] hover:text-white"
        >
          <Icon aria-hidden="true" className="size-[17px]" strokeWidth={1.5} />
        </a>
      ))}
    </div>
  );
}

function SupportCard({ phone, email }: { phone: string; email: string }) {
  return (
    <div className="mt-6 overflow-hidden rounded-tl-[3rem] rounded-br-[3rem] bg-[#211f1c] p-5 text-white sm:p-6">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#d5b58f]">
        Tư vấn & đặt hàng
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <a
          href={`tel:${phone.replace(/[^+\d]/g, "")}`}
          className="text-xl font-medium tracking-tight transition-colors hover:text-[#e3c8a8] sm:text-2xl"
        >
          {phone}
        </a>
        <a
          href={`tel:${phone.replace(/[^+\d]/g, "")}`}
          aria-label={`Gọi ${phone}`}
          className="grid size-10 shrink-0 place-items-center bg-[#d5b58f] text-[#211f1c] transition-colors hover:bg-white"
        >
          <PhoneCall aria-hidden="true" className="size-[17px]" strokeWidth={1.6} />
        </a>
      </div>
      <a
        href={`mailto:${email}`}
        className="mt-2 inline-flex max-w-full items-center gap-2 break-all text-sm text-white/70 transition-colors hover:text-white"
      >
        <Mail aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />
        {email}
      </a>
    </div>
  );
}

function FooterColumnHeading({ children }: { children: string }) {
  return (
    <>
      <div aria-hidden="true" className="mb-4 h-px w-8 bg-[#b18b64]" />
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b5842]">
        {children}
      </h2>
    </>
  );
}

function Newsletter() {
  return (
    <section className="bg-[#171717] text-white">
      <div className="mx-auto grid max-w-[1600px] gap-8 px-6 py-10 sm:px-8 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-16 md:py-12">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-medium leading-tight tracking-tight sm:text-3xl md:text-4xl">
            Đón nhận những điều mới từ ÉLANE
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
            Cập nhật bộ sưu tập, câu chuyện phong cách và những ưu đãi dành riêng cho bạn.
          </p>
        </div>

        <form
          className="flex min-w-0 items-end gap-4 border-b border-white/45"
          onSubmit={(e) => {
            e.preventDefault();
            (e.target as HTMLFormElement).reset();
            toast.success("Cảm ơn bạn đã đăng ký!");
          }}
        >
          <label htmlFor="footer-newsletter-email" className="sr-only">Email</label>
          <input
            id="footer-newsletter-email"
            type="email"
            required
            placeholder="Địa chỉ email của bạn"
            className="min-h-12 min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/55"
          />
          <button className="inline-flex min-h-12 shrink-0 items-center gap-2 pb-3 text-xs font-medium uppercase tracking-[0.12em] transition-opacity hover:opacity-70">
            Đăng ký
            <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </button>
        </form>
      </div>
    </section>
  );
}

export function Footer() {
  const { storeSettings } = useStore();

  return (
    <footer className="bg-[#f5f3ef] text-[#211f1c]">
      <Newsletter />

      <div className="mx-auto max-w-[1600px] px-6 py-8 sm:px-8 sm:py-10 md:hidden">
        <img
          src="/images/elane-logo.png"
          alt={`${storeSettings.brand.name} - ${storeSettings.brand.tagline}`}
          className="h-16 w-auto object-contain object-left"
        />
        <p className="mt-3 max-w-sm text-sm leading-6 text-[#5f5a54]">
          Thời trang nữ tinh tế, thiết kế tại Việt Nam và hoàn thiện từ những chất liệu được chọn lọc.
        </p>
        <SupportCard phone={storeSettings.brand.supportPhone} email={storeSettings.brand.supportEmail} />
        <SocialLinks />

        <Accordion type="single" collapsible className="mt-7 border-t border-[#d8d4ce]">
          <AccordionItem value="shop" className="border-[#d8d4ce]">
            <AccordionTrigger className="py-4 text-sm font-semibold no-underline hover:no-underline">Mua sắm</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1 text-sm text-[#5f5a54]">
                {shop.map(([slug, label]) => (
                  <li key={slug}><Link to="/danh-muc/$slug" params={{ slug }} className="inline-flex min-h-10 items-center transition-colors hover:text-[#211f1c]">{label}</Link></li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="service" className="border-[#d8d4ce]">
            <AccordionTrigger className="py-4 text-sm font-semibold no-underline hover:no-underline">Dịch vụ khách hàng</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1 text-sm text-[#5f5a54]">
                <li><Link to="/lien-he" className="inline-flex min-h-10 items-center transition-colors hover:text-[#211f1c]">Liên hệ</Link></li>
                <li><Link to="/faq" className="inline-flex min-h-10 items-center transition-colors hover:text-[#211f1c]">Câu hỏi thường gặp</Link></li>
                <li><Link to="/huong-dan-chon-size" className="inline-flex min-h-10 items-center transition-colors hover:text-[#211f1c]">Hướng dẫn chọn size</Link></li>
                {[ ["van-chuyen", "Vận chuyển"], ["doi-tra", "Đổi trả"], ["thanh-toan", "Thanh toán"], ["bao-mat", "Bảo mật"], ["dieu-khoan", "Điều khoản"] ].map(([slug, label]) => (
                  <li key={slug}><Link to="/chinh-sach/$slug" params={{ slug }} className="inline-flex min-h-10 items-center transition-colors hover:text-[#211f1c]">{label}</Link></li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="about" className="border-[#d8d4ce]">
            <AccordionTrigger className="py-4 text-sm font-semibold no-underline hover:no-underline">Khám phá ÉLANE</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1 text-sm text-[#5f5a54]">
                <li><Link to="/gioi-thieu" className="inline-flex min-h-10 items-center transition-colors hover:text-[#211f1c]">Về chúng tôi</Link></li>
                <li><Link to="/bo-suu-tap" className="inline-flex min-h-10 items-center transition-colors hover:text-[#211f1c]">Bộ sưu tập</Link></li>
                <li><Link to="/blog" className="inline-flex min-h-10 items-center transition-colors hover:text-[#211f1c]">Tạp chí</Link></li>
                <li><Link to="/cua-hang" className="inline-flex min-h-10 items-center transition-colors hover:text-[#211f1c]">Hệ thống cửa hàng</Link></li>
                <li><Link to="/tai-khoan" className="inline-flex min-h-10 items-center transition-colors hover:text-[#211f1c]">Tài khoản</Link></li>
              </ul>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>

      <div className="mx-auto hidden max-w-[1600px] grid-cols-1 gap-x-10 gap-y-10 px-6 py-10 sm:grid-cols-2 sm:px-8 sm:py-12 md:grid xl:grid-cols-[1.3fr_0.8fr_1.15fr_0.9fr] xl:gap-x-12 xl:gap-y-12 xl:py-16">
        <div>
          <img
            src="/images/elane-logo.png"
            alt={`${storeSettings.brand.name} - ${storeSettings.brand.tagline}`}
            className="h-20 w-auto object-contain object-left"
          />
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#5f5a54]">
            Thời trang nữ tinh tế, thiết kế tại Việt Nam và hoàn thiện từ những chất liệu được chọn lọc.
          </p>

          <SupportCard phone={storeSettings.brand.supportPhone} email={storeSettings.brand.supportEmail} />
          <SocialLinks />
        </div>

        <nav aria-label="Mua sắm">
          <FooterColumnHeading>Mua sắm</FooterColumnHeading>
          <ul className="mt-5 space-y-3 text-sm text-[#5f5a54]">
            {shop.map(([slug, label]) => (
              <li key={slug}>
                <Link to="/danh-muc/$slug" params={{ slug }} className="transition-colors hover:text-[#211f1c]">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Dịch vụ khách hàng">
          <FooterColumnHeading>Dịch vụ khách hàng</FooterColumnHeading>
          <ul className="mt-5 space-y-3 text-sm text-[#5f5a54]">
            <li><Link to="/lien-he" className="transition-colors hover:text-[#211f1c]">Liên hệ</Link></li>
            <li><Link to="/faq" className="transition-colors hover:text-[#211f1c]">Câu hỏi thường gặp</Link></li>
            <li><Link to="/huong-dan-chon-size" className="transition-colors hover:text-[#211f1c]">Hướng dẫn chọn size</Link></li>
            {[["van-chuyen", "Vận chuyển"], ["doi-tra", "Đổi trả"], ["thanh-toan", "Thanh toán"], ["bao-mat", "Bảo mật"], ["dieu-khoan", "Điều khoản"]].map(([slug, label]) => (
              <li key={slug}>
                <Link to="/chinh-sach/$slug" params={{ slug: slug! }} className="transition-colors hover:text-[#211f1c]">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Khám phá ÉLANE">
          <FooterColumnHeading>Khám phá ÉLANE</FooterColumnHeading>
          <ul className="mt-5 space-y-3 text-sm text-[#5f5a54]">
            <li><Link to="/gioi-thieu" className="transition-colors hover:text-[#211f1c]">Về chúng tôi</Link></li>
            <li><Link to="/bo-suu-tap" className="transition-colors hover:text-[#211f1c]">Bộ sưu tập</Link></li>
            <li><Link to="/blog" className="transition-colors hover:text-[#211f1c]">Tạp chí</Link></li>
            <li><Link to="/cua-hang" className="transition-colors hover:text-[#211f1c]">Hệ thống cửa hàng</Link></li>
            <li><Link to="/tai-khoan" className="transition-colors hover:text-[#211f1c]">Tài khoản</Link></li>
          </ul>

        </nav>
      </div>

      <div className="bg-[#eae7e1]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-6 py-5 text-xs text-[#5f5a54] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 {storeSettings.brand.name}. Bảo lưu mọi quyền.</p>
          <p>
            {storeSettings.shipping.freeShippingFromVnd > 0
              ? `Miễn phí vận chuyển từ ${formatVND(storeSettings.shipping.freeShippingFromVnd)}`
              : "Giao hàng toàn quốc"}
            {` · Đổi trả trong ${storeSettings.returns.returnWindowDays} ngày`}
          </p>
        </div>
      </div>
    </footer>
  );
}
