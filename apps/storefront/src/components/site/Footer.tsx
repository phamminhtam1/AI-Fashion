import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Youtube } from "lucide-react";
import { toast } from "sonner";

export function Newsletter() {
  return (
    <section className="bg-secondary px-6 py-20 text-center">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Bản tin ÉLANE</p>
      <h2 className="mt-3 text-3xl md:text-4xl">Nhận ưu đãi 10% cho đơn đầu tiên</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">Cập nhật bộ sưu tập mới, ưu đãi riêng dành cho thành viên và cảm hứng phong cách mỗi tuần.</p>
      <form
        className="mx-auto mt-8 flex max-w-md border-b border-foreground"
        onSubmit={(e) => { e.preventDefault(); (e.target as HTMLFormElement).reset(); toast.success("Cảm ơn bạn đã đăng ký!"); }}
      >
        <label htmlFor="nl" className="sr-only">Email</label>
        <input id="nl" type="email" required placeholder="Địa chỉ email của bạn" className="flex-1 bg-transparent py-3 text-sm outline-none" />
        <button className="text-xs uppercase tracking-widest">Đăng ký</button>
      </form>
    </section>
  );
}

const shop: [string, string][] = [
  ["hang-moi", "Hàng mới"],
  ["cong-so", "Công sở"],
  ["du-tiec", "Dự tiệc"],
  ["sale", "Sale"],
];
const lk = "hover:text-foreground";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-16 md:grid-cols-5 md:px-8">
        <div className="md:col-span-2">
          <p className="font-serif text-3xl tracking-[0.3em]">ÉLANE</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Modern Femininity</p>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">Thời trang nữ tinh tế cho người phụ nữ hiện đại. Thiết kế tại Việt Nam, may đo tỉ mỉ từ chất liệu chọn lọc.</p>
          <div className="mt-6 flex gap-4">
            {[Instagram, Facebook, Youtube].map((I, i) => <a key={i} href="#" aria-label="Mạng xã hội" className="hover:opacity-60"><I className="h-5 w-5" strokeWidth={1.5} /></a>)}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest">Mua sắm</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {shop.map(([slug, l]) => <li key={slug}><Link to="/danh-muc/$slug" params={{ slug }} className="hover:text-foreground">{l}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest">Hỗ trợ</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><Link to="/lien-he" className={lk}>Liên hệ</Link></li>
            <li><Link to="/faq" className={lk}>Câu hỏi thường gặp</Link></li>
            <li><Link to="/huong-dan-chon-size" className={lk}>Hướng dẫn chọn size</Link></li>
            {[["van-chuyen", "Vận chuyển"], ["doi-tra", "Đổi trả"], ["thanh-toan", "Thanh toán"], ["bao-mat", "Bảo mật"], ["dieu-khoan", "Điều khoản"]].map(([slug, l]) => (
              <li key={slug}><Link to="/chinh-sach/$slug" params={{ slug: slug! }} className={lk}>{l}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest">ÉLANE</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><Link to="/gioi-thieu" className={lk}>Về chúng tôi</Link></li>
            <li><Link to="/bo-suu-tap" className={lk}>Bộ sưu tập</Link></li>
            <li><Link to="/lookbook" className={lk}>Lookbook</Link></li>
            <li><Link to="/blog" className={lk}>Tạp chí</Link></li>
            <li><Link to="/cua-hang" className={lk}>Hệ thống cửa hàng</Link></li>
            <li><Link to="/tai-khoan" className={lk}>Tài khoản</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">© 2026 ÉLANE. Bảo lưu mọi quyền. · Hotline 1900 0000 · hello@elane.vn</div>
    </footer>
  );
}
