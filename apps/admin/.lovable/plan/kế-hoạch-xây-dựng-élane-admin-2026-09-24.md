# Kế hoạch xây dựng ÉLANE Admin

## Mục tiêu
Xây dựng hệ quản trị thương mại điện tử hoàn chỉnh tại `/`, bám sát phương án **Swiss editorial grid** đã chọn và nhận diện của website ÉLANE. Giao diện dùng tiếng Việt, tối ưu desktop nhưng vẫn sử dụng tốt trên tablet/mobile.

## Phạm vi sản phẩm

### 1. Nền tảng quản trị và phân quyền
- Kích hoạt Lovable Cloud để lưu trữ dữ liệu và quản lý đăng nhập.
- Trang đăng nhập quản trị, đăng xuất, khôi phục mật khẩu và bảo vệ toàn bộ khu vực vận hành.
- Vai trò tách riêng: Quản trị viên, Vận hành, Biên tập viên, Chăm sóc khách hàng; giới hạn quyền theo từng module.
- Nhật ký thao tác quan trọng.

### 2. Trung tâm điều hành
- Tổng quan doanh thu, đơn hàng, chuyển đổi, giá trị đơn trung bình.
- Biểu đồ theo khoảng thời gian, đơn mới, cảnh báo tồn kho theo màu/size, chiến dịch đang chạy và tác vụ nhanh.
- Tìm kiếm toàn hệ thống, thông báo, xuất báo cáo và trạng thái hoạt động.

### 3. Bán hàng và kho vận
- Đơn hàng: lọc/tìm kiếm, xem chi tiết, cập nhật trạng thái, thanh toán, vận chuyển, ghi chú và lịch sử.
- Đổi trả/hoàn tiền theo chính sách 30 ngày.
- Sản phẩm: CRUD, ảnh, SKU, màu, size, giá thường/giá sale, mô tả, chất liệu, bảo quản và SEO.
- Danh mục, nhãn Hàng mới/Bán chạy/Sale, tồn kho theo biến thể, nhập/xuất kho và cảnh báo sắp hết.

### 4. Khách hàng và marketing
- Hồ sơ khách, lịch sử mua hàng, phân khúc, yêu thích và ghi chú chăm sóc.
- Mã giảm giá, chiến dịch theo lịch, ngưỡng freeship, danh sách nhận bản tin và hiệu quả chiến dịch.
- Quản lý đánh giá: duyệt, ẩn và phản hồi.

### 5. Nội dung website
- Bộ sưu tập, Lookbook, Tạp chí, banner/trang chủ và lịch xuất bản.
- Trang giới thiệu, FAQ, hướng dẫn size, cửa hàng và các chính sách.
- Xem trước nội dung trước khi xuất bản; metadata riêng cho từng khu vực quản trị.

## Thiết kế
- Giữ đúng màu `#F2EEE8`, `#CBBDAE`, `#242320`, `#A23D35` qua hệ token semantic.
- Libre Baskerville cho tiêu đề, IBM Plex Sans cho nội dung.
- Sidebar thu gọn được; bento grid, viền mảnh, góc tối đa 8px, không gradient/glassmorphism.
- Dùng ảnh lookbook đúng tinh thần ÉLANE; trạng thái tải, rỗng, lỗi, xác nhận và phản hồi thao tác đầy đủ.
- Chuyển động nhẹ, hỗ trợ giảm chuyển động và khả năng truy cập bàn phím.

## Kỹ thuật triển khai
- TanStack Start + TypeScript + Tailwind v4, dùng các thành phần giao diện dùng chung.
- Lovable Cloud cho đăng nhập, dữ liệu, lưu ảnh và các thao tác phía máy chủ.
- Mô hình dữ liệu tách vai trò an toàn; RLS cho mọi bảng; migration có quyền truy cập đầy đủ và dữ liệu mẫu hiển thị ngay.
- Kiểm tra dữ liệu đầu vào, trạng thái lỗi, giao diện desktop/mobile và luồng chính từ đăng nhập đến cập nhật dữ liệu.

## Trình tự
1. Thiết lập Cloud, schema, quyền truy cập và dữ liệu mẫu.
2. Xây app shell, đăng nhập, sidebar, tìm kiếm và dashboard.
3. Hoàn thiện các module bán hàng, kho, khách hàng, marketing và nội dung.
4. Kết nối CRUD, upload ảnh, lọc/tìm kiếm, thông báo và audit log.
5. Kiểm thử luồng chính, quyền truy cập, hiển thị responsive và rà soát production.
