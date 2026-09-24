# ÉLANE — Đặc tả backend và hệ thống quản trị

Ngày lập: 24/09/2026. Website khảo sát: https://hello-kindred-point.lovable.app/

## 1. Phạm vi và mức độ xác minh

Đã đọc được HTML trang chủ. Chưa thao tác trực tiếp trên trình duyệt và chưa có source/backend. Các lần đọc trang con trả HTTP 403. Vì vậy tài liệu này gồm **phần giao diện đã quan sát ở trang chủ** và **thiết kế backend đề xuất**; không khẳng định website hiện có API, database, thanh toán hoặc xác thực thật. Các đường dẫn lấy từ liên kết trang chủ không đồng nghĩa trang đích đã được kiểm tra.

| Đã quan sát trên trang chủ | Yêu cầu backend suy ra/đề xuất |
|---|---|
| Thương hiệu ÉLANE, Modern Femininity; banner Autumn/Winter 2026 | Cấu hình thương hiệu, banner theo lịch, bản nháp/xuất bản |
| Váy/Đầm, Áo, Quần, Chân váy, Set bộ, Áo khoác, Phụ kiện | Danh mục sản phẩm có phân cấp |
| Công sở, Dự tiệc, Casual | Phân loại theo dịp mặc, độc lập với loại sản phẩm |
| Hàng mới, Bán chạy, Sale | Danh sách động; tránh coi tất cả là danh mục gốc |
| Thẻ sản phẩm có tên, giá, ảnh, nhãn Mới, size XS–XL | Sản phẩm và SKU màu–size; ảnh, giá, tồn kho theo SKU |
| Đầm lụa hai dây Noir 1.890.000₫; set tweed Parisienne 2.490.000₫ | Tiền VND lưu dạng số nguyên; giá ví dụ lấy tại thời điểm khảo sát |
| Liên kết Bộ sưu tập, Lookbook, Tạp chí | CMS riêng cho từng loại nội dung |
| Liên kết Tài khoản và Yêu thích | Khách hàng, địa chỉ, danh sách yêu thích; nội dung trang đích chưa xác minh |
| Miễn phí vận chuyển từ 1.000.000₫ | Quy tắc phí vận chuyển có hiệu lực theo thời gian |
| Đổi trả 30 ngày; nội dung quảng bá COD, thẻ, ví | Chính sách đổi trả và phương thức thanh toán cấu hình được; chưa xác minh tích hợp thật |
| Đăng ký bản tin nhận ưu đãi 10% đơn đầu | Subscriber, đồng ý nhận tin, voucher đơn đầu có kiểm tra phía server |
| Hướng dẫn size, FAQ, liên hệ, cửa hàng, các chính sách | Bảng size, FAQ, ticket liên hệ, hệ thống cửa hàng, trang nội dung |
| Lưới ảnh #ÉLANEwoman liên kết sản phẩm | Media và nội dung shoppable; không giả định đã tích hợp Instagram |

Chưa xác minh: giỏ hàng/checkout hoạt động ra sao; đăng nhập; đánh giá; tìm kiếm và bộ lọc; ví điện tử cụ thể; đơn vị vận chuyển; admin hiện có; số kho và chi nhánh. Phần dưới là thiết kế để triển khai, không phải kết quả trích xuất database của website.

## 2. Kiến trúc đề xuất

Một backend dạng modular monolith phục vụ storefront và `/admin`; PostgreSQL lưu nghiệp vụ; object storage lưu ảnh; worker xử lý thông báo, webhook và tác vụ lịch. Có thể thêm Redis cho hàng đợi/cache khi cần. Không cần tách microservice giai đoạn đầu.

Các module: Identity, Staff/RBAC, Catalog, Inventory, Cart/Checkout, Orders, Payments, Fulfillment, Returns, Customers, Promotions, Content/SEO, Reports, Settings/Audit.

Giữ frontend hiện tại và thay nguồn dữ liệu giả bằng API. Backend xác thực lại giá, tồn kho, voucher, phí ship và quyền thao tác. Frontend không được trực tiếp sửa bảng tài chính, tồn kho hoặc trạng thái đơn.

Nếu chọn nền tảng có sẵn auth/database, vẫn đặt checkout, điều chỉnh kho, thanh toán và hoàn tiền trong chức năng server có transaction. Không đưa khóa dịch vụ vào trình duyệt. Chưa chốt framework vì chưa đọc source thực tế; thiết kế này không phụ thuộc framework.

## 3. Sidebar và các tab quản lý

| Tab chính | Tab con | Chức năng và thông tin cần hiển thị |
|---|---|---|
| Tổng quan | Hôm nay; vận hành; cảnh báo | Đơn mới/chờ xác nhận; chờ đóng gói; thanh toán lỗi; tồn thấp; doanh thu thuần; lọc ngày và kho |
| Đơn hàng | Tất cả; chờ xác nhận; xử lý; hoàn thành; hủy | Tìm mã đơn/SĐT; lọc trạng thái đơn, thanh toán, giao hàng; gán nhân viên; ghi chú; xuất có phân quyền |
| Sản phẩm | Danh sách; danh mục; dịp mặc; thuộc tính; bảng size | Soạn nháp/xuất bản; SKU màu–size; ảnh theo màu; nhập CSV có xem trước lỗi; giá và SEO |
| Kho hàng | Tồn kho; nhập; xuất; chuyển; kiểm kê | Xem thực có/giữ chỗ/khả dụng; nhật ký kho; duyệt điều chỉnh; tồn tối thiểu; quét SKU/barcode |
| Nhà cung cấp | Danh sách; đơn mua; nhận hàng | Thông tin liên hệ, giá nhập, mua hàng, nhận nhiều đợt; giai đoạn 2 nếu chưa cần |
| Vận chuyển | Chờ tạo vận đơn; đang giao; giao thất bại; COD | Chọn kho xuất, kiện hàng, mã vận đơn, in nhãn, xử lý callback, đối soát COD |
| Đổi trả | Yêu cầu; tiếp nhận; kiểm hàng; hoàn tiền | Lý do, ảnh minh chứng, số lượng từng dòng, kết quả kiểm hàng, nhập lại hoặc loại bỏ |
| Khách hàng | Hồ sơ; lịch sử mua; nhóm; hỗ trợ | Địa chỉ, đơn hàng, ghi chú nội bộ, ticket, phân công CSKH; che thông tin theo quyền |
| Khuyến mãi | Chương trình; mã giảm; phí ship | Điều kiện, thời gian, giới hạn, sản phẩm áp dụng, chống cộng dồn ngoài ý muốn |
| Nội dung | Trang chủ; bộ sưu tập; lookbook; blog; trang tĩnh; FAQ | Thư viện ảnh, sắp xếp block, lên lịch, xem trước, duyệt và xuất bản |
| Marketing | Đăng ký bản tin; danh sách đồng ý nhận tin | Nguồn đăng ký, trạng thái unsubscribe, mã ưu đãi đơn đầu; gửi chiến dịch chỉ khi có tích hợp |
| Cửa hàng | Điểm bán; giờ mở cửa; kho liên kết | Địa chỉ, điện thoại, tọa độ, trạng thái hiển thị; cửa hàng không mặc nhiên là kho |
| Nhân sự | Nhân viên; phòng ban; vai trò; phạm vi; lời mời | Tạo/mời/khóa tài khoản, quản lý chức danh, cửa hàng/kho được giao, quyền và phiên đăng nhập |
| Báo cáo | Bán hàng; sản phẩm; tồn kho; thu tiền; hoàn tiền; nhân viên | Báo cáo ngày, SKU, danh mục, kênh, kho; quyền xem giá vốn/lợi nhuận tách riêng |
| Cấu hình | Thương hiệu; thanh toán; vận chuyển; chính sách; thông báo; SEO | Phí ship, thời hạn đổi trả, thông tin liên hệ, mẫu email; bí mật tích hợp được mã hóa |
| Hệ thống | Audit log; webhook lỗi; tác vụ lỗi; lịch sử import | Ai thay đổi gì, lúc nào; retry an toàn; không cho nhân viên sửa/xóa audit |

Quy ước chung: tìm kiếm, lọc, phân trang phía server; ghi nhớ bộ lọc; thao tác hàng loạt chỉ xuất hiện theo quyền; thông báo lỗi rõ dòng/trường; không xem nút bị ẩn là cơ chế bảo mật.

### Màn hình chi tiết sản phẩm

1. Thông tin: tên, slug, mô tả ngắn/dài, chất liệu, hướng dẫn bảo quản, trạng thái.
2. Phân loại: danh mục chính/phụ, dịp mặc, bộ sưu tập, tag.
3. Biến thể: hàng là SKU; cột màu, size, barcode, giá bán, giá so sánh, trạng thái. Giá vốn chỉ người được phép thấy.
4. Media: ảnh đại diện, album, ảnh theo màu, alt text, kéo sắp xếp.
5. Kho: tồn theo địa điểm; chỉ xem ở sản phẩm, điều chỉnh qua phiếu kho.
6. Size: chọn bảng size và số đo; không ghi chung một chuỗi XS–XL cho mọi sản phẩm.
7. SEO: title, description, slug, ảnh chia sẻ; đổi slug tạo redirect.
8. Lịch sử: người tạo/sửa/xuất bản và các thay đổi.

### Màn hình chi tiết đơn hàng

Header có mã đơn, ba trạng thái độc lập (đơn/thanh toán/giao hàng), ngày tạo và nhân viên phụ trách. Nội dung gồm sản phẩm snapshot; người nhận/địa chỉ snapshot; tổng tiền; khoản thanh toán và hoàn tiền; kiện giao hàng; timeline; ghi chú nội bộ; yêu cầu đổi trả. Nút thao tác phụ thuộc quyền và trạng thái hợp lệ. Sửa địa chỉ sau xác nhận phải ghi lịch sử; sau bàn giao đơn vị vận chuyển cần quy trình xử lý riêng.

## 4. Nhân viên và phân quyền

Phân biệt **hồ sơ nhân viên**, **tài khoản đăng nhập**, **vai trò**, **phạm vi dữ liệu**. Một nhân viên có nhiều vai trò; chức danh không tự cấp quyền. Nhân viên nghỉ việc bị khóa tài khoản và thu hồi phiên nhưng lịch sử đơn vẫn giữ tên/mã tham chiếu.

| Vai trò mẫu | Được làm | Giới hạn mặc định |
|---|---|---|
| Chủ hệ thống | Quản trị toàn bộ, cấp quản trị viên, phê duyệt quyền nhạy cảm | Không bỏ qua audit; không xóa chứng từ đã ghi nhận |
| Quản lý cửa hàng/vận hành | Xử lý đơn, phân công, duyệt tác vụ trong phạm vi | Không tự cấp quyền cao hơn; chỉ các kho/cửa hàng được giao |
| Nhân viên bán hàng | Tạo đơn hộ, xác nhận đơn, ghi chú, tra cứu khách cần phục vụ | Không xem giá vốn; không tự hoàn tiền hoặc sửa tồn |
| CSKH | Xem đơn liên quan, tạo ticket/đề nghị hủy/đổi trả | Không trực tiếp hoàn tiền; xuất PII cần quyền riêng |
| Nhân viên kho | Nhận, soạn, đóng gói, kiểm hàng trả, kiểm kê | Không sửa giá bán; không sửa số dư kho trực tiếp; chỉ kho được giao |
| Quản lý kho | Duyệt điều chỉnh/chuyển kho, cấu hình mức tồn | Không xem bí mật thanh toán hoặc quản trị người dùng |
| Marketing/nội dung | Banner, lookbook, blog, đề xuất voucher | Không thấy giá vốn; giới hạn xuất khách; ưu đãi vượt ngưỡng cần duyệt |
| Kế toán | Thu tiền, đối soát, duyệt hoàn tiền, báo cáo giá vốn | Không tự cấp quyền; tách người yêu cầu và người duyệt khoản lớn |
| Người xem báo cáo | Dashboard/báo cáo đã được cấp | Không sửa dữ liệu, xuất file là quyền riêng |

Permission mẫu: `product.read`, `product.write`, `product.publish`, `price.write`, `cost.read`, `order.read`, `order.create`, `order.confirm`, `order.cancel`, `order.discount_override`, `inventory.receive`, `inventory.transfer`, `inventory.adjust.request`, `inventory.adjust.approve`, `refund.request`, `refund.approve`, `refund.execute`, `customer.pii.read`, `customer.export`, `content.publish`, `staff.manage`, `role.manage`, `report.profit.read`, `audit.read`.

Mỗi grant gồm permission + scope: toàn hệ thống, danh sách kho/cửa hàng hoặc đơn được giao. Server kiểm tra cả hai. Danh sách và export cũng phải lọc scope, không chỉ trang chi tiết. Quản lý không được cấp quyền mình không có. Không cho người dùng tự duyệt yêu cầu do mình lập khi chính sách yêu cầu hai người. Ngưỡng giảm giá/hoàn tiền cấu hình theo doanh nghiệp, không hardcode tùy ý.

Tab nhân sự giai đoạn đầu quản lý vận hành: mã NV, họ tên, email, điện thoại, bộ phận, chức danh, ngày vào/nghỉ, cấp trên, trạng thái, phạm vi kho/cửa hàng. Chấm công, ca làm, lương và hoa hồng là module tùy chọn riêng vì cần thêm quy tắc nghiệp vụ; không gom dữ liệu lương nhạy cảm vào hồ sơ admin thông thường.

## 5. Database: quy ước

Đây là logical schema dùng để viết migration, chưa phải SQL có thể chạy. `id` mặc định UUID PK; thời gian dùng `timestamptz` UTC, hiển thị theo múi giờ cấu hình. Các bảng nghiệp vụ có `created_at`, `updated_at`; trường actor dùng FK tài khoản khi phù hợp. Bảng nối dùng khóa ghép/unique được nêu rõ. `?` nghĩa là nullable. FK mặc định NOT NULL trừ khi có `?`.

Tiền VND dùng `bigint`, không dùng float. Số lượng dùng integer; CHECK số dương/không âm tùy ngữ cảnh. Trạng thái dùng enum hoặc CHECK. Slug/code chuẩn hóa và có unique index. Bảng đã phát sinh giao dịch không hard-delete; hồ sơ danh mục archive, còn audit/chứng từ bất biến. Dữ liệu cá nhân được xử lý theo chính sách lưu giữ, không đồng nghĩa phải giữ nguyên vĩnh viễn.

### 5.1. Tài khoản, nhân viên và quyền

| Bảng | Cột chính ngoài quy ước chung | Quan hệ/ràng buộc |
|---|---|---|
| `accounts` | `auth_subject text`, `email text?`, `phone text?`, `status`, `last_login_at?` | auth_subject unique; email chuẩn hóa unique khi tồn tại; mật khẩu do hệ auth xử lý |
| `departments` | `name`, `parent_id?` | FK self, cấm chu kỳ |
| `employees` | `account_id?`, `employee_code`, `full_name`, `work_email?`, `phone?`, `department_id?`, `job_title?`, `manager_id?`, `joined_on`, `left_on?`, `status` | account unique; employee_code unique; manager FK employees, cấm chu kỳ |
| `roles` | `code`, `name`, `is_system` | code unique |
| `permissions` | `code`, `description` | code unique |
| `role_permissions` | `role_id`, `permission_id` | PK ghép |
| `employee_role_grants` | `employee_id`, `role_id`, `scope_type`, `warehouse_id?`, `store_id?`, `expires_at?` | CHECK scope và FK khớp; all/assigned không có location; unique theo employee-role-scope với xử lý NULL |
| `staff_invitations` | `email`, `token_hash`, `expires_at`, `accepted_at?`, `invited_by` | token hash unique, một lần dùng; vai trò dự kiến trong bảng nối invitation_role_grants |
| `invitation_role_grants` | `invitation_id`, `role_id`, `scope_type`, `warehouse_id?`, `store_id?` | CHECK phạm vi như employee_role_grants |

Nếu auth không cung cấp quản lý phiên, bổ sung `account_sessions(account_id, refresh_token_hash, expires_at, revoked_at, device_label)`; không lưu refresh token nguyên văn. Khóa nhân viên phải vô hiệu quyền ngay cả khi access token cũ chưa hết hạn.

### 5.2. Catalog, media, nội dung sản phẩm

| Bảng | Cột chính | Quan hệ/ràng buộc |
|---|---|---|
| `categories` | `parent_id?`, `name`, `slug`, `sort_order`, `status`, `seo_title?`, `seo_description?` | FK self; slug unique; cấm chu kỳ |
| `occasions` | `code`, `name`, `slug` | Công sở, Dự tiệc, Casual; code/slug unique |
| `products` | `name`, `slug`, `description`, `material?`, `care_instructions?`, `primary_category_id`, `size_chart_id?`, `status`, `published_at?`, `new_until?`, `seo_title?`, `seo_description?` | slug unique; draft/published/archived |
| `product_categories` | `product_id`, `category_id` | PK ghép; danh mục chính phải có trong tập phân loại |
| `product_occasions` | `product_id`, `occasion_id` | PK ghép |
| `colors` | `code`, `name`, `hex?`, `swatch_asset_id?` | code unique; hỗ trợ họa tiết qua ảnh |
| `sizes` | `code`, `label`, `sort_order` | Có `ONE_SIZE` cho phụ kiện |
| `product_variants` | `product_id`, `sku`, `barcode?`, `color_id`, `size_id`, `price_vnd`, `compare_at_price_vnd?`, `weight_g?`, `status` | sku unique; barcode unique nếu có; unique(product,color,size); giá >=0 |
| `media_assets` | `object_key`, `mime_type`, `bytes`, `width?`, `height?`, `alt_text?`, `uploaded_by?` | object_key unique; chỉ nhận loại/kích thước hợp lệ |
| `product_media` | `product_id`, `asset_id`, `color_id?`, `sort_order`, `is_cover` | Một cover chung mỗi sản phẩm bằng partial unique index |
| `size_charts` | `name`, `unit`, `instructions?` | Đơn vị chuẩn cm |
| `size_chart_measurements` | `size_chart_id`, `size_id`, `measurement_code`, `min_value numeric`, `max_value numeric` | unique(chart,size,measurement); min<=max |
| `collections` | `name`, `slug`, `description?`, `cover_asset_id?`, `status`, `starts_at?`, `ends_at?`, `seo_title?`, `seo_description?` | slug unique; thời gian hợp lệ |
| `collection_products` | `collection_id`, `product_id`, `sort_order` | PK ghép |

Ví dụ: sản phẩm Đầm lụa hai dây Noir có nhiều SKU như `NOIR-BLACK-S`, `NOIR-BLACK-M`. Đây là ví dụ thiết kế, không phải SKU đã trích xuất. Tồn, giữ chỗ, trọng lượng và giá đều gắn SKU. “Hàng mới” lọc published_at/new_until; “Sale” dựa trên giá hiệu lực; “Bán chạy” dựa trên số lượng bán ròng trong khoảng ngày, có thể thêm danh sách biên tập nhưng phải phân biệt với xếp hạng tính toán.

### 5.3. Kho và mua hàng

| Bảng | Cột chính | Quan hệ/ràng buộc |
|---|---|---|
| `stores` | `code`, `name`, `address jsonb`, `phone?`, `latitude?`, `longitude?`, `opening_hours jsonb`, `status` | code unique |
| `warehouses` | `code`, `name`, `store_id?`, `address jsonb`, `status` | code unique; kho độc lập hoặc gắn điểm bán |
| `inventory_balances` | `warehouse_id`, `variant_id`, `on_hand`, `reserved`, `reorder_point` | PK(warehouse,variant); 0<=reserved<=on_hand |
| `inventory_documents` | `code`, `type`, `status`, `source_warehouse_id?`, `target_warehouse_id?`, `reason`, `requested_by`, `approved_by?`, `posted_at?` | receipt/issue/adjustment/transfer/return_receipt; trạng thái draft/approved/posted/void |
| `inventory_document_lines` | `document_id`, `variant_id`, `qty`, `unit_cost_vnd?` | qty>0; điều chỉnh giảm thể hiện bằng loại/direction, không vừa âm vừa direction |
| `stock_movements` | `document_line_id?`, `warehouse_id`, `variant_id`, `delta_qty`, `unit_cost_vnd?`, `shipment_item_id?`, `return_item_id?`, `operation_key` | operation_key unique; bất biến sau ghi sổ; mỗi event có nguồn hợp lệ |
| `stock_reservations` | `order_item_id`, `warehouse_id`, `variant_id`, `qty`, `expires_at?`, `status` | active/consumed/released/expired; qty>0; tổng active khớp reserved |
| `stocktakes` | `warehouse_id`, `status`, `started_at`, `completed_at?`, `created_by`, `approved_by?` | Kiểm kê có thời điểm chốt |
| `stocktake_lines` | `stocktake_id`, `variant_id`, `expected_qty`, `counted_qty`, `adjustment_document_id?` | unique(stocktake,variant); counted>=0 |
| `suppliers` | `code`, `name`, `contact_name?`, `phone?`, `email?`, `address jsonb?`, `status` | code unique |
| `purchase_orders` | `code`, `supplier_id`, `warehouse_id`, `status`, `expected_at?`, `created_by`, `approved_by?` | code unique |
| `purchase_order_items` | `purchase_order_id`, `variant_id`, `ordered_qty`, `unit_cost_vnd` | ordered_qty>0; giá vốn>=0 |
| `purchase_receipt_lines` | `purchase_order_item_id`, `inventory_document_line_id` | Nhận nhiều đợt; tổng nhận không vượt lượng mua trừ khi có duyệt bổ sung |

`available = on_hand - reserved`. Khi giao cho hãng vận chuyển: giảm on_hand và reserved cùng transaction; khi chỉ đặt hàng: tăng reserved. Hủy trước xuất kho chỉ giải phóng reserved. Hàng trả chỉ tăng on_hand sau kiểm định đạt. Nếu cần hàng hỏng/cách ly, dùng kho cách ly không cấp cho checkout hoặc thêm stock bucket ở giai đoạn sau.

Chuyển kho có hai chặng: xuất kho nguồn vào kho trung chuyển, nhận từ trung chuyển vào kho đích. Không cộng kho đích ngay khi xe chưa giao. MVP một kho có thể ẩn chức năng chuyển nhưng giữ warehouse_id trong schema. Giá vốn báo cáo lấy snapshot tại xuất kho theo phương pháp đã chọn (đề xuất bình quân di động), không lấy giá nhập mới nhất của sản phẩm.

### 5.4. Khách hàng, giỏ và đơn hàng

| Bảng | Cột chính | Quan hệ/ràng buộc |
|---|---|---|
| `customers` | `account_id?`, `full_name`, `email?`, `phone?`, `status`, `internal_note?` | account unique nếu có; khách mua không đăng nhập được phép |
| `customer_addresses` | `customer_id`, `recipient_name`, `phone`, `address_line`, `administrative_units jsonb`, `is_default` | Một mặc định/customer; địa chỉ không phụ thuộc cứng số cấp hành chính |
| `wishlist_items` | `customer_id`, `product_id` | PK ghép; chọn lưu theo product trước, không theo size |
| `carts` | `customer_id?`, `guest_token_hash?`, `status`, `expires_at` | Khách hoặc guest token phải tồn tại; token unique khi có |
| `cart_items` | `cart_id`, `variant_id`, `qty` | unique(cart,variant); qty>0; giá hiển thị không phải giá checkout có thẩm quyền |
| `orders` | `order_number`, `customer_id?`, `status`, `currency`, `subtotal_vnd`, `discount_vnd`, `shipping_vnd`, `tax_vnd`, `grand_total_vnd`, `recipient_snapshot jsonb`, `shipping_address_snapshot jsonb`, `assigned_employee_id?`, `source`, `policy_snapshot jsonb`, `placed_at`, `version` | order_number unique; guest vẫn có snapshot; version dùng optimistic concurrency |
| `order_items` | `order_id`, `variant_id`, `sku_snapshot`, `name_snapshot`, `color_snapshot`, `size_snapshot`, `image_key_snapshot?`, `qty`, `unit_price_vnd`, `discount_vnd`, `tax_vnd`, `line_total_vnd` | qty>0; tổng tiền được tính tại server; không sửa tùy ý sau xác nhận |
| `order_adjustments` | `order_id`, `order_item_id?`, `type`, `amount_vnd`, `promotion_id?`, `description` | Phân bổ giảm giá/phí có nguồn; tránh cộng hai lần với các tổng đã cache |
| `order_events` | `order_id`, `event_type`, `from_status?`, `to_status?`, `actor_account_id?`, `note?`, `payload jsonb` | Append-only; tách ghi chú nội bộ khỏi timeline cho khách |
| `order_notes` | `order_id`, `author_employee_id`, `body`, `visibility` | internal/customer; mặc định internal |
| `order_assignments` | `order_id`, `employee_id`, `assigned_by`, `started_at`, `ended_at?` | Lịch sử phân công; orders.assigned_employee_id là trạng thái hiện tại |

Giá trị snapshot giữ nguyên khi đổi tên sản phẩm, giá hoặc địa chỉ trong hồ sơ khách. Dòng đơn giữ tham chiếu SKU archived, không xóa dây chuyền. Giỏ chưa giữ hàng. Khi ghép giỏ guest với giỏ tài khoản, gộp cùng SKU và kiểm lại giới hạn số lượng, không tự hứa còn hàng.

### 5.5. Thanh toán, giao hàng, đổi trả

| Bảng | Cột chính | Quan hệ/ràng buộc |
|---|---|---|
| `payments` | `order_id`, `method`, `provider`, `provider_reference?`, `amount_vnd`, `status`, `paid_at?`, `idempotency_key` | unique(provider,provider_reference) khi có; idempotency unique; nhiều lần thử/đơn |
| `payment_events` | `payment_id`, `provider_event_id`, `event_type`, `amount_vnd?`, `received_at`, `verified_at?` | unique(provider_event_id, payment_id); lưu lịch sử tiền thực tế |
| `webhook_events` | `provider`, `external_event_id`, `payload_redacted jsonb`, `signature_verified`, `status`, `attempts`, `processed_at?`, `last_error?` | unique(provider,external_event_id); payload hạn chế dữ liệu nhạy cảm |
| `shipments` | `order_id`, `warehouse_id`, `carrier`, `tracking_number?`, `status`, `cod_amount_vnd`, `shipping_fee_vnd`, `handed_over_at?`, `delivered_at?` | Một đơn nhiều kiện; tracking unique theo hãng nếu có |
| `shipment_items` | `shipment_id`, `order_item_id`, `qty`, `unit_cost_snapshot_vnd?` | qty>0; tổng giao không vượt lượng đã đặt trừ quy trình thay thế rõ ràng |
| `shipment_events` | `shipment_id`, `external_event_id?`, `status`, `occurred_at`, `description?` | Chống trùng callback; giữ lịch sử đến trễ |
| `cod_settlements` | `carrier`, `reference`, `period_from`, `period_to`, `received_at?`, `status` | reference unique theo hãng |
| `cod_settlement_lines` | `settlement_id`, `shipment_id`, `collected_vnd`, `fee_vnd`, `remitted_vnd`, `difference_vnd`, `status` | Đối chiếu thu hộ với chuyển về; không coi delivered là tiền đã vào tài khoản |
| `returns` | `return_number`, `order_id`, `type`, `reason`, `status`, `requested_at`, `approved_by?`, `received_at?`, `replacement_order_id?` | return_number unique; exchange/refund; đổi size tạo đơn thay thế liên kết |
| `return_items` | `return_id`, `order_item_id`, `qty`, `inspection_result?`, `restock_qty`, `refund_amount_vnd` | Tổng trả không vượt số giao chưa trả; restock_qty<=qty |
| `return_media` | `return_id`, `asset_id` | PK ghép |
| `refunds` | `payment_id`, `return_id?`, `amount_vnd`, `reason`, `status`, `requested_by`, `approved_by?`, `executed_by?`, `provider_reference?`, `idempotency_key` | Tổng succeeded + pending không vượt tiền đã thu có thể hoàn; idempotency unique |

Tách trạng thái đơn, tiền và giao hàng. Refund có thể có mà không có return (hủy trước giao). Return có thể không restock (hàng hỏng). Một đơn có thể giao/hoàn một phần. Tiền refund theo phần giảm giá đã phân bổ cho từng dòng, không theo giá niêm yết hiện tại. Quy tắc hoàn phí ship là cấu hình rõ ràng.

### 5.6. Ưu đãi, nội dung và hệ thống

| Bảng | Cột chính | Quan hệ/ràng buộc |
|---|---|---|
| `promotions` | `name`, `type`, `value`, `max_discount_vnd?`, `min_order_vnd`, `starts_at`, `ends_at`, `status`, `priority`, `stackable`, `first_order_only`, `global_limit?`, `per_customer_limit?` | percent 0..100; lịch hợp lệ |
| `promotion_products` | `promotion_id`, `product_id` | PK ghép |
| `promotion_categories` | `promotion_id`, `category_id` | PK ghép; quy tắc gồm danh mục con cần nêu rõ |
| `coupons` | `promotion_id`, `code`, `usage_limit?`, `status` | code unique không phân biệt hoa/thường |
| `promotion_redemptions` | `promotion_id`, `coupon_id?`, `order_id`, `customer_id?`, `identity_hash?`, `status`, `discount_vnd`, `expires_at?` | reserved/committed/released; unique(promotion,order); hạn mức cập nhật nguyên tử |
| `shipping_rules` | `name`, `priority`, `zone_definition jsonb`, `min_subtotal_vnd?`, `fee_vnd`, `starts_at?`, `ends_at?`, `status` | Ngưỡng miễn ship tính trên cơ sở cấu hình, đề xuất giá hàng sau giảm |
| `content_pages` | `slug`, `type`, `title`, `status`, `published_revision_id?`, `seo_title?`, `seo_description?` | slug unique; home/about/policy/faq landing |
| `content_revisions` | `page_id`, `version_no`, `blocks jsonb`, `created_by`, `approved_by?`, `published_at?` | unique(page,version); block schema có version, không HTML tùy ý |
| `banners` | `placement`, `desktop_asset_id`, `mobile_asset_id?`, `title?`, `cta_label?`, `target_url?`, `sort_order`, `starts_at?`, `ends_at?`, `status` | URL được validate; placement enum |
| `lookbooks` | `slug`, `title`, `description?`, `cover_asset_id?`, `status`, `published_at?`, `seo_title?`, `seo_description?` | slug unique |
| `lookbook_images` | `lookbook_id`, `asset_id`, `sort_order` | FK media |
| `lookbook_hotspots` | `lookbook_image_id`, `product_id`, `x numeric`, `y numeric` | x,y 0..1; tính năng shoppable đề xuất |
| `blog_categories` | `name`, `slug` | slug unique |
| `blog_posts` | `category_id?`, `author_employee_id?`, `slug`, `title`, `excerpt?`, `body`, `cover_asset_id?`, `status`, `published_at?`, `seo_title?`, `seo_description?` | slug unique; sanitize nội dung |
| `faqs` | `group_name`, `question`, `answer`, `sort_order`, `status` | Nội dung hỗ trợ |
| `newsletter_subscribers` | `email`, `status`, `source`, `consented_at?`, `consent_version?`, `unsubscribed_at?`, `unsubscribe_token_hash` | email chuẩn hóa unique; không gộp đồng ý marketing với tạo tài khoản |
| `support_tickets` | `customer_id?`, `order_id?`, `contact_email?`, `contact_phone?`, `subject`, `status`, `assigned_employee_id?` | Guest được gửi liên hệ; chống spam |
| `support_messages` | `ticket_id`, `sender_account_id?`, `body`, `visibility` | Mặc định nội bộ khi do nhân viên tạo ghi chú |
| `seo_redirects` | `old_path`, `new_path`, `status_code` | old_path unique; tránh vòng lặp; mặc định 301 cho đổi slug |
| `settings` | `key`, `value jsonb`, `visibility`, `updated_by` | key unique; bí mật tích hợp không lưu plain trong đây |
| `approval_requests` | `action`, `resource_type`, `resource_id`, `payload_hash`, `requested_by`, `approved_by?`, `status`, `expires_at?` | Thay payload làm mất hiệu lực duyệt; lưu ref kiểm tra trong service |
| `audit_logs` | `actor_account_id?`, `action`, `resource_type`, `resource_id`, `before_redacted jsonb?`, `after_redacted jsonb?`, `request_id`, `occurred_at` | Append-only; không ghi password/token/PII nguyên văn không cần thiết |
| `idempotency_records` | `scope`, `key`, `request_hash`, `resource_id?`, `response_status?`, `expires_at` | unique(scope,key); cùng key khác payload trả conflict |
| `outbox_events` | `event_type`, `aggregate_id`, `payload jsonb`, `status`, `attempts`, `available_at`, `processed_at?` | Ghi cùng transaction nghiệp vụ; worker retry và consumer chống trùng |

`resource_type/resource_id` của audit/approval là tham chiếu đa hình, không phải FK thật: service kiểm tra resource tồn tại. Các quan hệ nghiệp vụ quan trọng dùng FK cụ thể. JSON chỉ dùng cho snapshot, block nội dung và cấu hình có validation; không gom toàn bộ catalog/orders vào JSON.

### 5.7. Chỉ mục và ràng buộc xuyên bảng

- `orders(status, placed_at DESC)`, `(customer_id, placed_at DESC)`, `(assigned_employee_id, placed_at DESC)`; mã đơn unique.
- `products(status,published_at DESC)`; index slug; bảng nối category/product theo cả hai chiều.
- `product_variants(product_id,status)`; SKU/barcode unique. Tìm tên tiếng Việt cần chuẩn hóa dấu hoặc full-text phù hợp, sau này mới thêm search service.
- `inventory_balances(variant_id,warehouse_id)` ngoài PK; `stock_reservations(status,expires_at)` cho worker.
- `payments(order_id,status)`, `shipments(order_id,status)`, `returns(order_id,status)`; webhook provider/event unique.
- `audit_logs(resource_type,resource_id,occurred_at DESC)` và `(actor_account_id,occurred_at DESC)`.
- Bảng nối FK cascade chỉ với liên kết cấu hình chưa có nghiệp vụ; orders/payments/movements dùng RESTRICT hoặc archive. Không cascade xóa lịch sử từ customers/products.
- Tổng giao/trả/hoàn/giữ hàng là ràng buộc xuyên hàng: kiểm trong transaction có khóa hàng; CHECK đơn lẻ không đủ.
- Các trạng thái cache trên orders (nếu thêm) phải suy ra và cập nhật transaction từ payments/shipments, không được sửa độc lập.

## 6. Luồng nghiệp vụ bắt buộc

### Checkout

1. Nhận cart/variant/quantity, địa chỉ, mã giảm và phương thức; client gửi idempotency key.
2. Server đọc giá hiệu lực và trạng thái SKU; tính voucher, ship, thuế theo chính sách. MVP chỉ VND; quy tắc giá đã gồm thuế hay chưa phải được chốt rõ, không mặc định thêm thuế hai lần.
3. Mở transaction; khóa các balance theo thứ tự ổn định; kiểm khả dụng. Giữ hạn mức voucher cũng trong transaction, không kiểm rồi cập nhật rời nhau.
4. Tạo order/items/snapshot, reservation, redemption và outbox; commit. Nếu bất kỳ SKU thiếu, rollback tất cả.
5. Tạo payment intent bên ngoài transaction bằng idempotency key ổn định; lỗi mạng cho retry an toàn và reconciler kiểm tra giao dịch treo.
6. Thanh toán online chưa xong giữ kho theo TTL cấu hình, ví dụ 15 phút. Đơn COD sau xác nhận giữ đến xuất/hủy, không để TTL thanh toán tự giải phóng.
7. Webhook xác minh chữ ký, merchant, mã tham chiếu, tiền và currency; chỉ ghi nhận một lần. Trang redirect về từ cổng không tự đánh dấu đã trả tiền.
8. Nếu tiền đến sau khi reservation hết hạn, thử giữ lại kho dưới khóa. Hết hàng thì tạo ngoại lệ để xử lý hoàn tiền/CSKH; không tự xuất hàng âm.

### Các trạng thái

| Đối tượng | Luồng chính | Nhánh khác |
|---|---|---|
| Đơn | pending → confirmed → processing → completed | pending/confirmed → cancelled nếu chưa xuất; processing chỉ hủy phần chưa xuất qua quy trình |
| Tiền | pending → succeeded | failed/cancelled; trạng thái partially_refunded/refunded suy ra từ refunds |
| Giao hàng | pending → packing → handed_over → in_transit → delivered | failed_delivery, returning, returned; không ghi đè delivered bởi callback cũ |
| Đổi trả | requested → approved → received → inspected → resolved | rejected/cancelled; kiểm hàng trước restock |
| Hoàn tiền | requested → approved → processing → succeeded | rejected/failed; retry dùng cùng key, không tạo refund mới tùy tiện |

Hoàn thành đơn khi phần phải giao đã giao và nghĩa vụ thanh toán/thu hộ đáp ứng chính sách. COD đã giao và COD hãng chưa chuyển về là hai tình trạng khác nhau, thể hiện riêng ở đối soát. Đổi trả phát sinh sau completed giữ lịch sử đơn gốc và xử lý qua return/refund.

### Nhập kho và kiểm kê

Phiếu nháp → duyệt → ghi sổ. Khi ghi sổ, tạo movement và cập nhật balance cùng transaction, khóa theo SKU/kho. Phiếu posted không sửa; sai thì tạo phiếu đảo và phiếu mới. Kiểm kê phải có thời điểm chốt; nếu tiếp tục nhập/xuất trong lúc đếm, điều chỉnh số kỳ vọng theo movements, không ghi đè tồn đang chạy bằng số đếm cũ.

### Đổi size và hoàn một phần

Khách chọn dòng đơn và số lượng; server kiểm ngày giao, chính sách snapshot và lượng chưa trả. Nhân viên duyệt; kho nhận và phân loại. Đổi size tạo đơn thay thế liên kết, giữ SKU mới; phần chênh tiền thành khoản thu/hoàn có chứng từ. Refund chỉ chạy sau duyệt và trong giới hạn đã thu; restock không phụ thuộc việc cổng hoàn tiền đã trả callback hay chưa.

## 7. API contract đề xuất

Prefix `/api/v1`. Response lỗi có `code`, `message`, `field_errors?`, `request_id`. Danh sách dùng cursor hoặc page có giới hạn; filter/sort whitelist. Gửi idempotency key cho checkout, thanh toán, refund, posting phiếu kho. Mutation có version khi cần ngăn hai nhân viên ghi đè.

| Nhóm | Endpoint tiêu biểu | Lưu ý |
|---|---|---|
| Public catalog | `GET /products`, `/products/:slug`, `/categories`, `/collections/:slug` | Chỉ published; filter category/occasion/color/size/price; không lộ cost |
| Public content | `GET /homepage`, `/lookbooks/:slug`, `/posts/:slug`, `/pages/:slug`, `/stores` | Chỉ revision đang xuất bản; banner đúng lịch |
| Customer | `GET /me`, `GET/POST /me/addresses`, `GET /me/orders`, `GET /me/orders/:id` | Quyền sở hữu, không tin customer_id từ client |
| Wishlist | `GET /me/wishlist`, `PUT/DELETE /me/wishlist/:productId` | Idempotent |
| Cart | `POST /carts`, `GET /carts/:id`, `PUT /carts/:id/items/:variantId` | Ràng buộc account hoặc guest token bảo mật |
| Checkout | `POST /checkout/quote`, `POST /checkout` | Quote có hạn, submit tính lại trong transaction |
| Guest tracking | `POST /guest-orders/verify`, `GET /guest-orders/:id` | OTP/token có hạn; không chỉ mã đơn + SĐT đoán được |
| Admin catalog | `POST/PATCH /admin/products`, `POST /admin/products/:id/publish` | Draft khác publish; không auto-publish import |
| Admin orders | `GET /admin/orders`, `POST /admin/orders/:id/confirm`, `/cancel`, `/assign` | Command riêng theo state machine; tránh PATCH status tùy ý |
| Inventory | `POST /admin/inventory-documents`, `/:id/approve`, `/:id/post` | Kiểm quyền, scope và phê duyệt; không PATCH balances |
| Fulfillment | `POST /admin/orders/:id/shipments`, `POST /admin/shipments/:id/hand-over` | Kiểm quantity và reservation |
| Returns | `POST /me/orders/:id/returns`, `POST /admin/returns/:id/approve`, `/inspect` | Quantity còn được trả; ảnh upload an toàn |
| Refunds | `POST /admin/refunds`, `POST /admin/refunds/:id/approve`, `/:id/execute` | Không gọi cổng từ browser |
| Staff | `POST /admin/staff/invitations`, `PATCH /admin/staff/:id`, `PUT /admin/staff/:id/role-grants` | Không tự nâng quyền; thay quyền có audit |
| CMS | `POST /admin/pages/:id/revisions`, `POST /admin/pages/:id/publish` | Validate blocks; quyền publish riêng |
| Webhooks | `POST /webhooks/payments/:provider`, `/webhooks/shipping/:carrier` | Chữ ký + chống trùng + giới hạn payload |
| Reports | `GET /admin/reports/sales`, `/inventory`, `/cash`, `/profit` | Mỗi báo cáo có scope; profit cần cost.read/report.profit.read |

Upload: server cấp URL upload có hạn; kiểm MIME thực, dung lượng, quyền và object key; ảnh public, hồ sơ nhân viên/ticket private. Import CSV: upload → parse/validate → preview lỗi → confirm → job import có kết quả từng dòng; không cho import chỉnh stock balance trực tiếp.

## 8. Dashboard, báo cáo và số liệu

- Giá trị đơn tạo: tổng grand_total các đơn được tạo trong kỳ theo bộ lọc; không gọi là tiền đã thu.
- Bán hàng thuần: giá trị hàng giao sau giảm giá, trừ giá trị hàng hoàn được ghi nhận trong kỳ. Hiển thị phí ship, thuế riêng; thống nhất chọn ngày ghi nhận.
- Tiền thu ròng: giao dịch tiền đã thành công trừ hoàn tiền thành công, theo ngày tiền. COD chờ đối soát thành chỉ tiêu riêng.
- Giá vốn: snapshot tại xuất kho, đảo phần đủ điều kiện khi nhập hàng trả; lợi nhuận gộp = bán hàng thuần − giá vốn thuần. Không gọi đây là lợi nhuận sau tất cả chi phí.
- Tồn: on_hand, reserved, available, hàng trung chuyển, hàng cách ly; top SKU sắp hết và lâu không bán.
- Nhân viên: đơn được phân công/xử lý, thời gian xác nhận, tỷ lệ hủy theo lý do. Muốn hoa hồng phải định nghĩa người được ghi nhận bán hàng, công thức, trừ đơn hoàn và ngày khóa kỳ riêng.
- Bộ lọc thời gian phải hiển thị múi giờ, phạm vi kho/cửa hàng và định nghĩa chỉ tiêu. Dashboard và export dùng cùng truy vấn nghiệp vụ.

## 9. Bảo mật và vận hành

Kiểm RBAC/scope ở server; MFA cho chủ/quản trị và vai trò tiền; rate limit login/OTP/checkout; xác thực email theo nhu cầu; CSRF nếu dùng cookie, cookie HttpOnly/Secure và cấu hình SameSite phù hợp. Không lưu số thẻ/CVV; dùng cổng thanh toán/token phù hợp.

PII không được ghi đầy đủ trong log; quyền xem/xuất riêng, export có hạn tải và audit. Audit không cho người vận hành sửa; secrets chỉ server truy cập. Input rich text được sanitize; kiểm file upload thực tế. Backups có mã hóa và kiểm tra khôi phục; cấu hình lịch theo yêu cầu mất dữ liệu/chịu gián đoạn của shop.

Worker có retry backoff, dead-letter và màn hình lỗi; outbox không mất email/vận đơn khi request bị ngắt; webhook trễ hoặc trùng không làm lùi trạng thái. Chạy tác vụ đối chiếu tổng reserved với reservation, tồn với ledger, tiền với cổng; sai lệch đưa vào hàng đợi xử lý, không tự sửa số liệu im lặng.

## 10. Lộ trình triển khai và nghiệm thu

### Giai đoạn 1 — Nền tảng quản lý

Auth nhân viên, role/scope; catalog, SKU, ảnh, danh mục/dịp; một kho; nhập/điều chỉnh có ledger; storefront đọc API; CMS trang chủ/các chính sách. Seed vai trò và dữ liệu danh mục đã thấy. Không seed tất cả size cho mọi SKU mà chưa xác nhận dữ liệu thực.

### Giai đoạn 2 — Bán hàng thực tế

Giỏ, checkout, đơn, COD, giữ hàng, xử lý đơn, packing/giao hàng, hồ sơ khách; ưu đãi và phí ship; tích hợp một cổng thanh toán/đơn vị vận chuyển sau khi được chọn. Đổi trả cơ bản và refund có duyệt phải có trước khi vận hành bán thật.

### Giai đoạn 3 — Quản trị đầy đủ

Lookbook, blog, newsletter; nhiều kho, mua hàng, đối soát COD; báo cáo giá vốn/lợi nhuận; duyệt theo ngưỡng; import/export; nâng cấp search và job theo tải. Chấm công/lương chỉ thêm nếu có nhu cầu quản lý nhân sự sâu.

### Các tình huống nghiệm thu quan trọng

1. Hai checkout cùng mua SKU còn 1: chỉ một đơn giữ hàng thành công; tồn không âm.
2. Checkout gọi lại cùng key: cùng một đơn; key cũ với payload mới bị từ chối.
3. Webhook gửi hai lần/đảo thứ tự: không cộng tiền hoặc trừ kho hai lần, không lùi trạng thái.
4. Online thanh toán đến sau hết hạn giữ hàng: xử lý thiếu hàng có kiểm soát.
5. Nhân viên kho sửa URL/API truy cập kho khác: bị từ chối; export cũng bị chặn.
6. Marketing không lấy được giá vốn hay danh sách số điện thoại qua response phụ.
7. Hủy trước xuất giải phóng kho và voucher đúng một lần.
8. Trả 1 trong 2 sản phẩm được giảm giá: hoàn đúng phần tiền đã phân bổ; không hoàn dư.
9. Đổi giá, tên hoặc địa chỉ hồ sơ sau mua: đơn cũ giữ nguyên snapshot.
10. Phiếu kho đã posted không sửa; thao tác lại không tạo movement trùng.
11. Khóa nhân viên: phiên cũ không còn quyền; lịch sử vẫn truy nguyên.
12. Worker lỗi sau commit: retry không gửi/tạo chứng từ trùng; báo cáo đối soát phát hiện lỗi còn lại.
13. Đổi size có SKU mới, chênh tiền, hàng hoàn và giá vốn theo đúng chứng từ.
14. Sao lưu khôi phục được vào môi trường kiểm tra; dữ liệu nhạy cảm không lọt vào log hoặc bản export không có quyền.

## 11. Thông tin cần chốt trước khi code

- Source/ZIP frontend để map chính xác route, form, filter, dữ liệu mock và hành vi giỏ/checkout.
- Một hay nhiều kho/cửa hàng; có bán tại quầy/POS hay chỉ online.
- Nhân viên thực tế và phạm vi ai được duyệt giảm giá, điều chỉnh kho, hoàn tiền.
- Nhà cung cấp thanh toán/vận chuyển muốn tích hợp; chưa mặc định các logo/nội dung frontend là tích hợp có thật.
- Quy tắc thuế/giá, giá vốn, đơn đầu, cộng dồn voucher, miễn ship, đổi trả và thời hạn giữ kho.
- Phạm vi nhân sự: chỉ tài khoản/quyền/phân công hay cả ca làm, chấm công, lương/hoa hồng.

Bản này đủ làm cơ sở chia module, viết migration và dựng admin. Để gọi là bóc tách 1:1 website, cần kiểm tra các trang con và source; hiện mới xác minh trang chủ cùng các liên kết của nó.
