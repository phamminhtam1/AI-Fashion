import hero from "@/assets/hero.jpg";
import setImg from "@/assets/p-set.jpg";
import dress from "@/assets/p-dress.jpg";
import coat from "@/assets/p-coat.jpg";
import pants from "@/assets/p-pants.jpg";
import skirt from "@/assets/p-skirt.jpg";
import top from "@/assets/p-top.jpg";
import acc from "@/assets/p-acc.jpg";

export const collections = [
  { slug: "thu-dong-2026", name: "Thu Đông 2026", tagline: "Timeless femininity, redefined.", image: hero, description: "Gam màu camel, kem và đen — những lớp áo dạ mềm mại, len cashmere và phom dáng thanh lịch cho mùa lạnh.", categories: ["ao-khoac", "ao", "quan"] },
  { slug: "la-parisienne", name: "La Parisienne", tagline: "Chiều Paris, nắng nhẹ.", image: setImg, description: "Tweed, ngọc trai và những chi tiết vàng tinh xảo — cảm hứng từ phong cách Pháp cổ điển.", categories: ["set-bo", "phu-kien"] },
  { slug: "evening-noir", name: "Evening Noir", tagline: "Khi màn đêm buông xuống.", image: dress, description: "Lụa satin và những đường cắt tối giản cho các buổi tiệc tối.", categories: ["vay-dam", "chan-vay"] },
  { slug: "the-office", name: "The Office Edit", tagline: "Quyền lực trong sự tinh tế.", image: coat, description: "Blazer, sơ mi lụa và quần âu — tủ đồ công sở hoàn hảo.", categories: ["ao-khoac", "ao", "quan"] },
];

export const lookbook = [
  { image: hero, title: "Camel Hour", caption: "Áo khoác dạ Camel · Áo len Cashmere Soft · Quần suông" },
  { image: setImg, title: "Parisienne", caption: "Set tweed Parisienne · Túi Mini Lune" },
  { image: dress, title: "Noir", caption: "Đầm lụa hai dây Noir" },
  { image: coat, title: "Power Suit", caption: "Blazer oversize Noir · Quần âu cạp cao" },
  { image: skirt, title: "Champagne", caption: "Chân váy xếp ly Champagne · Áo tank top Essential" },
  { image: pants, title: "Linen Days", caption: "Quần linen ống rộng Dune" },
  { image: top, title: "Ivory", caption: "Áo sơ mi lụa Ivory · Quần âu" },
  { image: acc, title: "Details", caption: "Túi Mini Lune · Khuyên tai Perle" },
];

export type Post = { slug: string; title: string; excerpt: string; image: string; date: string; category: string; readTime: number; body: { h: string; p: string }[] };

export const posts: Post[] = [
  {
    slug: "cach-phoi-do-cong-so-thanh-lich", title: "7 cách phối đồ công sở thanh lịch cho nàng hiện đại", category: "Phong cách", date: "2026-09-18", readTime: 5, image: coat,
    excerpt: "Từ blazer oversize đến sơ mi lụa — bí quyết xây dựng tủ đồ công sở tinh gọn mà vẫn nổi bật.",
    body: [
      { h: "1. Blazer oversize và quần âu cạp cao", p: "Một chiếc blazer phom rộng kết hợp quần âu cạp cao tạo nên tỉ lệ cơ thể hoàn hảo, vừa quyền lực vừa thoải mái." },
      { h: "2. Sơ mi lụa cùng chân váy bút chì", p: "Chất lụa mềm mại cân bằng sự nghiêm túc của chân váy bút chì — lựa chọn an toàn cho mọi cuộc họp." },
      { h: "3. Chơi với gam trung tính", p: "Đen, kem, be và camel dễ phối với nhau, giúp bạn tạo ra hàng chục bộ trang phục chỉ từ vài món đồ." },
      { h: "4. Phụ kiện tối giản", p: "Một đôi khuyên tai ngọc trai và túi xách cấu trúc là đủ để hoàn thiện diện mạo." },
    ],
  },
  {
    slug: "xu-huong-thu-dong-2026", title: "Xu hướng thời trang nữ Thu Đông 2026", category: "Xu hướng", date: "2026-09-10", readTime: 6, image: hero,
    excerpt: "Quiet luxury tiếp tục lên ngôi cùng gam camel, chất liệu len và những đường cắt vượt thời gian.",
    body: [
      { h: "Quiet luxury", p: "Sự sang trọng thầm lặng thể hiện qua chất liệu cao cấp và phom dáng chuẩn mực thay vì logo phô trương." },
      { h: "Gam màu camel", p: "Camel là màu chủ đạo của mùa — ấm áp, dễ phối và luôn thanh lịch." },
      { h: "Áo khoác dáng dài", p: "Áo khoác dạ dáng dài là khoản đầu tư xứng đáng, có thể mặc trong nhiều năm." },
    ],
  },
  {
    slug: "chon-dam-du-tiec", title: "Bí quyết chọn đầm dự tiệc theo dáng người", category: "Hướng dẫn", date: "2026-08-28", readTime: 4, image: dress,
    excerpt: "Đầm slip, đầm xòe hay đầm ôm — đâu là lựa chọn tôn dáng nhất cho bạn?",
    body: [
      { h: "Dáng quả lê", p: "Ưu tiên đầm chữ A hoặc đầm xòe giúp cân bằng phần hông." },
      { h: "Dáng đồng hồ cát", p: "Đầm ôm hoặc đầm slip lụa tôn lên đường cong tự nhiên." },
      { h: "Dáng thẳng", p: "Đầm cổ đổ, có chi tiết xếp nếp giúp tạo độ mềm mại." },
    ],
  },
  {
    slug: "bao-quan-do-lua", title: "Hướng dẫn bảo quản đồ lụa luôn như mới", category: "Chăm sóc", date: "2026-08-15", readTime: 3, image: top,
    excerpt: "Lụa là chất liệu quý — vài lưu ý đơn giản giúp trang phục bền đẹp theo thời gian.",
    body: [
      { h: "Giặt tay nhẹ nhàng", p: "Dùng nước lạnh và dung dịch giặt chuyên dụng, không vắt xoắn." },
      { h: "Phơi trong bóng râm", p: "Ánh nắng trực tiếp làm phai màu và giảm độ bóng của lụa." },
      { h: "Ủi ở nhiệt độ thấp", p: "Ủi mặt trái với nhiệt độ thấp hoặc dùng bàn hơi nước." },
    ],
  },
];

export const policies: Record<string, { title: string; sections: { h: string; p: string }[] }> = {
  "van-chuyen": { title: "Chính sách vận chuyển", sections: [
    { h: "Phí vận chuyển", p: "Miễn phí vận chuyển cho đơn hàng từ 1.000.000₫. Đơn dưới 1.000.000₫ áp dụng phí đồng giá 30.000₫." },
    { h: "Thời gian giao hàng", p: "Nội thành Hà Nội và TP. HCM: 1–2 ngày. Các tỉnh thành khác: 2–4 ngày làm việc." },
    { h: "Theo dõi đơn hàng", p: "Mã vận đơn sẽ được gửi qua email và SMS ngay khi đơn hàng được bàn giao cho đơn vị vận chuyển." },
  ] },
  "doi-tra": { title: "Chính sách đổi trả", sections: [
    { h: "Thời hạn", p: "Đổi trả miễn phí trong vòng 30 ngày kể từ ngày nhận hàng." },
    { h: "Điều kiện", p: "Sản phẩm còn nguyên tem mác, chưa qua sử dụng, giặt tẩy. Phụ kiện trang sức không áp dụng đổi trả vì lý do vệ sinh." },
    { h: "Hoàn tiền", p: "Tiền được hoàn trong 5–7 ngày làm việc qua phương thức thanh toán ban đầu." },
  ] },
  "thanh-toan": { title: "Chính sách thanh toán", sections: [
    { h: "Phương thức", p: "Thanh toán khi nhận hàng (COD), chuyển khoản ngân hàng, thẻ Visa/Mastercard/JCB và ví điện tử MoMo, ZaloPay." },
    { h: "Bảo mật", p: "Mọi giao dịch được mã hóa theo tiêu chuẩn bảo mật quốc tế. ÉLANE không lưu trữ thông tin thẻ của bạn." },
  ] },
  "bao-mat": { title: "Chính sách bảo mật", sections: [
    { h: "Thu thập thông tin", p: "Chúng tôi chỉ thu thập thông tin cần thiết để xử lý đơn hàng và cải thiện trải nghiệm mua sắm." },
    { h: "Sử dụng thông tin", p: "Thông tin được dùng để giao hàng, chăm sóc khách hàng và gửi ưu đãi (nếu bạn đồng ý)." },
    { h: "Quyền của bạn", p: "Bạn có thể yêu cầu xem, chỉnh sửa hoặc xóa dữ liệu cá nhân bất cứ lúc nào qua hello@elane.vn." },
  ] },
  "dieu-khoan": { title: "Điều khoản sử dụng", sections: [
    { h: "Chấp nhận điều khoản", p: "Khi truy cập và mua sắm tại ÉLANE, bạn đồng ý với các điều khoản được nêu tại đây." },
    { h: "Giá và sản phẩm", p: "Giá sản phẩm có thể thay đổi mà không báo trước. Màu sắc thực tế có thể chênh lệch nhẹ do màn hình hiển thị." },
    { h: "Sở hữu trí tuệ", p: "Toàn bộ hình ảnh, nội dung và thiết kế trên website thuộc quyền sở hữu của ÉLANE." },
  ] },
};

export const stores = [
  { city: "Hà Nội", name: "ÉLANE Tràng Tiền", address: "68 Tràng Tiền, Hoàn Kiếm, Hà Nội", hours: "9:00 – 22:00", phone: "024 0000 0001" },
  { city: "Hà Nội", name: "ÉLANE Lotte Tây Hồ", address: "Tầng 2, Lotte Mall, 683 Lạc Long Quân, Tây Hồ", hours: "9:30 – 22:00", phone: "024 0000 0002" },
  { city: "TP. Hồ Chí Minh", name: "ÉLANE Đồng Khởi", address: "125 Đồng Khởi, Quận 1, TP. HCM", hours: "9:00 – 22:00", phone: "028 0000 0001" },
  { city: "TP. Hồ Chí Minh", name: "ÉLANE Thảo Điền", address: "12 Quốc Hương, Thảo Điền, TP. Thủ Đức", hours: "9:30 – 21:30", phone: "028 0000 0002" },
  { city: "Đà Nẵng", name: "ÉLANE Bạch Đằng", address: "88 Bạch Đằng, Hải Châu, Đà Nẵng", hours: "9:00 – 21:30", phone: "0236 000 0001" },
];

export const faqs: { group: string; items: [string, string][] }[] = [
  { group: "Đặt hàng", items: [["Làm sao để đặt hàng?", "Chọn sản phẩm, kích cỡ, thêm vào giỏ và tiến hành thanh toán. Bạn có thể đặt hàng không cần tài khoản."], ["Tôi có thể hủy đơn không?", "Bạn có thể hủy đơn trước khi đơn được bàn giao vận chuyển bằng cách liên hệ hotline 1900 0000."]] },
  { group: "Vận chuyển", items: [["Thời gian giao hàng bao lâu?", "1–2 ngày tại Hà Nội và TP. HCM, 2–4 ngày tại các tỉnh thành khác."], ["Phí vận chuyển là bao nhiêu?", "Miễn phí cho đơn từ 1.000.000₫, dưới mức này phí đồng giá 30.000₫."]] },
  { group: "Đổi trả", items: [["Chính sách đổi trả thế nào?", "Đổi trả miễn phí trong 30 ngày với sản phẩm còn nguyên tem mác."], ["Bao lâu tôi nhận được tiền hoàn?", "5–7 ngày làm việc sau khi chúng tôi nhận được sản phẩm trả lại."]] },
  { group: "Sản phẩm", items: [["Làm sao chọn đúng size?", "Tham khảo bảng hướng dẫn chọn size hoặc chat với stylist của chúng tôi."], ["Sản phẩm được sản xuất ở đâu?", "Toàn bộ sản phẩm được thiết kế và may tại Việt Nam."]] },
];
