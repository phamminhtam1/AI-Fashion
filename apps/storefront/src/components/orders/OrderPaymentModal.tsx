import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, QrCode, ShieldCheck, X } from "lucide-react";
import { formatVND } from "@/lib/products";
import { fetchBankInfo, storeApi, type BankInfo } from "@/lib/api";
import { toast } from "sonner";

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`Đã copy ${label}`),
    () => toast.error("Không copy được"),
  );
}

interface OrderPaymentModalProps {
  order: {
    id: string;
    order_number: string;
    grand_total_vnd: number;
  };
  onClose: () => void;
  onPaid: () => void;
}

export function OrderPaymentModal({ order, onClose, onPaid }: OrderPaymentModalProps) {
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 mins countdown

  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Fetch bank info
  useEffect(() => {
    let active = true;
    fetchBankInfo()
      .then((info) => {
        if (active) setBankInfo(info);
      })
      .catch((err) => {
        toast.error("Không tải được thông tin ngân hàng");
      })
      .finally(() => {
        if (active) setLoadingBank(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Poll for payment confirmation
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const o = await storeApi.order(order.id);
        if (stopped) return;
        if (o.payment_status === "paid") {
          stopped = true;
          setPaidSuccess(true);
          toast.success("Thanh toán thành công! Hệ thống đã ghi nhận.");
          setTimeout(() => {
            onPaidRef.current();
          }, 1500);
        }
      } catch {
        /* keep polling */
      }
    };

    check();
    const id = setInterval(check, 3000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [order.id]);

  const bankCode = bankInfo?.bank_code || bankInfo?.bank_name || "MSB";
  const holder = bankInfo?.account_name
    ? bankInfo.account_name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
    : "";

  const q = new URLSearchParams({
    bank: bankCode,
    acc: bankInfo?.account_number || "",
    amount: String(order.grand_total_vnd),
    des: order.order_number,
    template: "compact",
    showInfo: "true",
    holder,
  });
  const qr = `https://vietqr.app/img/?${q.toString()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg bg-background p-6 shadow-2xl border border-border">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {paidSuccess ? (
          <div className="py-12 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600 animate-bounce" />
            <h3 className="font-serif text-2xl">Thanh Toán Thành Công!</h3>
            <p className="text-sm text-muted-foreground">
              Đơn hàng <b className="text-foreground">#{order.order_number}</b> đã được xác nhận thanh toán.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1 text-xs font-medium rounded-full mb-3">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                Hệ thống xác nhận tự động qua SePay
              </div>
              <h3 className="font-serif text-2xl">Quét Mã VietQR</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Mã đơn <b className="text-foreground">#{order.order_number}</b> • Số tiền:{" "}
                <b className="text-foreground">{formatVND(order.grand_total_vnd)}</b>
              </p>
              <div className="mt-2 text-[11px] font-mono text-muted-foreground">
                Thời gian giữ đơn: <span className="text-amber-600 font-semibold">{formatCountdown(timeLeft)}</span>
              </div>
            </div>

            {loadingBank ? (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : bankInfo ? (
              <>
                <div className="relative mx-auto w-56 h-56 bg-white p-2 shadow-inner border border-border flex items-center justify-center">
                  <img src={qr} alt="VietQR SePay" className="h-full w-full object-contain" />
                </div>

                {/* Transfer Info */}
                <dl className="divide-y divide-border border border-border text-xs">
                  <div className="flex items-center justify-between p-2.5">
                    <dt className="text-muted-foreground">Ngân hàng:</dt>
                    <dd className="font-medium">{bankInfo.bank_name}</dd>
                  </div>
                  <div className="flex items-center justify-between p-2.5">
                    <dt className="text-muted-foreground">Số tài khoản:</dt>
                    <div className="flex items-center gap-2">
                      <dd className="font-mono font-bold text-sm">{bankInfo.account_number}</dd>
                      <button
                        type="button"
                        onClick={() => copyText("Số tài khoản", bankInfo.account_number)}
                        className="p-1 hover:text-foreground text-muted-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2.5">
                    <dt className="text-muted-foreground">Chủ tài khoản:</dt>
                    <dd className="font-medium">{bankInfo.account_name}</dd>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-secondary/30">
                    <dt className="text-muted-foreground">Số tiền:</dt>
                    <div className="flex items-center gap-2">
                      <dd className="font-bold text-sm text-foreground">{formatVND(order.grand_total_vnd)}</dd>
                      <button
                        type="button"
                        onClick={() => copyText("Số tiền", String(order.grand_total_vnd))}
                        className="p-1 hover:text-foreground text-muted-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-amber-500/10">
                    <div>
                      <dt className="font-semibold text-amber-700 dark:text-amber-400">Nội dung CK (Bắt buộc):</dt>
                      <span className="text-[10px] text-muted-foreground">Chuyển đúng để hệ thống tự duyệt</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <dd className="font-mono font-bold text-base text-foreground">{order.order_number}</dd>
                      <button
                        type="button"
                        onClick={() => copyText("Nội dung chuyển khoản", order.order_number)}
                        className="p-1 hover:text-foreground text-muted-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </dl>

                <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang chờ tín hiệu giao dịch từ tài khoản…
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
