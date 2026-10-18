/** Vietnamese display labels. Stored values and API payloads keep their original codes. */
const labels: Record<string, string> = {
  pending: "Chờ xử lý",
  pending_payment: "Chờ thanh toán",
  completed: "Đã hoàn tất",
  confirmed: "Đã xác nhận",
  cancelled: "Đã hủy",
  paid: "Đã thanh toán",
  unpaid: "Chưa thanh toán",
  awaiting: "Chờ thanh toán",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
  unfulfilled: "Chưa xử lý",
  processing: "Đang xử lý",
  picking: "Đang lấy hàng",
  packed: "Đã đóng gói",
  shipping: "Đang giao hàng",
  shipped: "Đã gửi hàng",
  delivered: "Đã giao hàng",
  fulfilled: "Đã hoàn tất",
  partial: "Đã xử lý một phần",
  returned: "Đã trả hàng",
  published: "Đang bán",
  draft: "Bản nháp",
  archived: "Đã lưu trữ",
  in_stock: "Còn hàng",
  low_stock: "Sắp hết hàng",
  out_of_stock: "Hết hàng",
  active: "Đang hoạt động",
  blocked: "Đã khóa",
  disabled: "Đã tắt",
  rate_limited: "Tạm giới hạn lượt dùng",
  exhausted: "Đã hết hạn mức",
  revoked: "Đã thu hồi",
  approved: "Đã duyệt",
  posted: "Đã ghi sổ",
  void: "Đã hủy",
  receipt: "Nhập kho",
  issue: "Xuất kho",
  adjustment: "Điều chỉnh kho",
  card: "Thẻ tín dụng",
  "credit card": "Thẻ tín dụng",
  bank: "Chuyển khoản ngân hàng",
  bank_transfer: "Chuyển khoản ngân hàng",
  "bank transfer": "Chuyển khoản ngân hàng",
  vietqr: "Chuyển khoản VietQR",
  cod: "Thanh toán khi nhận hàng",
  cash: "Tiền mặt",
  "cash on delivery": "Thanh toán khi nhận hàng",
  paypal: "PayPal",
  "main warehouse": "Kho chính",
  "atelier hanoi": "Cửa hàng Hà Nội",
  "hcm hub": "Trung tâm TP. Hồ Chí Minh",
  "online store": "Cửa hàng trực tuyến",
  "instagram shop": "Cửa hàng Instagram",
  marketplace: "Sàn thương mại điện tử",
};

export function adminLabel(value: string | null | undefined): string {
  if (!value) return "Chưa xác định";
  return labels[value.toLowerCase().trim()] ?? "Chưa xác định";
}

export function paymentStatusLabel(value: string | null | undefined): string {
  return value?.toLowerCase() === "pending" ? "Chờ thanh toán" : adminLabel(value);
}

export function adminErrorMessage(error: unknown, status?: number): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  // Keep actionable Vietnamese errors returned by the API; translate common mixed terms.
  if (/[\u00c0-\u024f\u1e00-\u1eff]/i.test(message)) {
    return message
      .replace(/\bSlug\b/gi, "Đường dẫn")
      .replace(/\bfile\b/gi, "tệp")
      .replace(/\bstatus\b/gi, "trạng thái")
      .replace(/\bitems\b/gi, "sản phẩm")
      .replace(/\bpayload\b/gi, "dữ liệu gửi lên");
  }
  if (/fetch|network|load failed|connection/i.test(message)) return "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.";
  if (/invalid.*(key|token)|unauthorized|authentication/i.test(message)) return "Thông tin xác thực không hợp lệ hoặc đã hết hạn.";
  if (/rate.?limit|too many requests/i.test(message) || status === 429) return "Đã vượt giới hạn lượt yêu cầu. Vui lòng thử lại sau.";
  if (/insufficient.*(credit|balance|quota)|quota.*exceeded/i.test(message)) return "Đã hết hạn mức sử dụng. Vui lòng kiểm tra số dư.";
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (status === 404) return "Không tìm thấy dữ liệu yêu cầu.";
  if (status === 409) return "Dữ liệu đã thay đổi hoặc bị trùng. Vui lòng kiểm tra và thử lại.";
  if (status === 400 || status === 422) return "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các trường đã nhập.";
  if (status && status >= 500) return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.";
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}
