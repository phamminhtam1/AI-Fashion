import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { formatVND } from "@/lib/products";
import { checkPaymentStatus, fetchBankInfo, type BankInfo } from "@/lib/api";
import { toast } from "sonner";
import { fireCheckoutCelebration } from "@/lib/celebrate";

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
  const [checkingManual, setCheckingManual] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
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

  const handleCopy = (key: string, label: string, value: string) => {
    void navigator.clipboard.writeText(value).then(
      () => {
        setCopiedKey(key);
        toast.success(`Đã sao chép ${label}`);
        setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
      },
      () => toast.error("Không sao chép được"),
    );
  };

  // Fetch bank info
  useEffect(() => {
    let active = true;
    fetchBankInfo()
      .then((info) => {
        if (active) setBankInfo(info);
      })
      .catch(() => {
        toast.error("Không tải được thông tin ngân hàng");
      })
      .finally(() => {
        if (active) setLoadingBank(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Real-time polling via public status endpoint (1.5s interval)
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      try {
        const st = await checkPaymentStatus(order.id);
        if (stopped) return;
        if (st.is_paid) {
          stopped = true;
          setPaidSuccess(true);
          fireCheckoutCelebration();
          toast.success("Thanh toán thành công! Hệ thống đã ghi nhận.");
          setTimeout(() => {
            onPaidRef.current();
          }, 2000);
        }
      } catch {
        /* keep polling */
      }
    };

    void check();
    const id = setInterval(check, 1500);

    const handleFocus = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      stopped = true;
      clearInterval(id);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [order.id]);

  // Manual Check
  const handleManualCheck = async () => {
    if (checkingManual) return;
    setCheckingManual(true);
    try {
      const st = await checkPaymentStatus(order.id);
      if (st.is_paid) {
        setPaidSuccess(true);
        fireCheckoutCelebration();
        toast.success("Thanh toán thành công! Hệ thống đã ghi nhận.");
        setTimeout(() => {
          onPaidRef.current();
        }, 1500);
      } else {
        toast.info("Chưa ghi nhận giao dịch từ ngân hàng. Quý khách vui lòng kiểm tra lại nội dung chuyển khoản.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chưa kiểm tra được trạng thái");
    } finally {
      setCheckingManual(false);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto bg-background p-6 sm:p-7 shadow-2xl border border-border">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        {paidSuccess ? (
          <div className="py-12 text-center space-y-5 animate-in zoom-in-95 duration-300">
            <div className="relative inline-flex items-center justify-center">
              <div className="absolute -inset-4 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>
            </div>
            <div>
              <h3 className="font-serif text-2xl text-foreground">Thanh Toán Thành Công!</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Đơn hàng <b className="text-foreground">#{order.order_number}</b> đã được xác nhận thanh toán tự động qua SePay Napas 24/7.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="bg-foreground text-background px-8 py-3 text-xs uppercase tracking-widest font-medium hover:bg-foreground/90 transition-colors shadow-sm"
            >
              Xem danh sách đơn hàng
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1 text-[11px] font-medium rounded-full border border-amber-500/20">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                Hệ thống xác nhận tự động SePay Napas 24/7
              </div>
              <h3 className="font-serif text-2xl text-foreground">Quét Mã VietQR</h3>
              <p className="text-xs text-muted-foreground">
                Mã đơn <b className="text-foreground">#{order.order_number}</b> • Số tiền:{" "}
                <b className="text-foreground font-serif text-sm">{formatVND(order.grand_total_vnd)}</b>
              </p>
              <div className="text-[11px] font-mono text-muted-foreground flex items-center justify-center gap-1.5">
                <Clock className="h-3 w-3 text-amber-600" />
                <span>Thời gian giữ đơn:</span>
                <span className="text-amber-600 font-bold">{formatCountdown(timeLeft)}</span>
              </div>
            </div>

            {loadingBank ? (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Đang tải thông tin VietQR…</p>
              </div>
            ) : bankInfo ? (
              <>
                {/* QR Viewfinder Container with Laser Scan */}
                <div className="relative mx-auto flex flex-col items-center">
                  <div className="relative p-3 bg-white rounded-lg shadow-xl border-2 border-border/40">
                    {/* Viewfinder Corners */}
                    <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-600 rounded-tl" />
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-600 rounded-tr" />
                    <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-600 rounded-bl" />
                    <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-600 rounded-br" />

                    {/* Laser Scanning Line */}
                    <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-qr-scan pointer-events-none z-10" />

                    <div className="w-56 h-56 flex items-center justify-center bg-white overflow-hidden">
                      <img src={qr} alt="VietQR SePay" className="h-full w-full object-contain select-none" />
                    </div>
                  </div>

                  {/* Actions below QR */}
                  <div className="mt-3.5 flex items-center justify-center gap-2">
                    <a
                      href={qr}
                      download={`VietQR-${order.order_number}.png`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground border border-border hover:bg-secondary transition-colors rounded"
                    >
                      <Download className="h-3 w-3" />
                      <span>Tải QR</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleManualCheck()}
                      disabled={checkingManual}
                      className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-foreground border border-foreground/60 hover:bg-foreground hover:text-background transition-colors rounded shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${checkingManual ? "animate-spin" : ""}`} />
                      <span>{checkingManual ? "Đang kiểm tra…" : "Kiểm tra ngay"}</span>
                    </button>
                  </div>
                </div>

                {/* Transfer Info Cards */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-secondary/20 border border-border">
                    <span className="text-muted-foreground">Ngân hàng:</span>
                    <span className="font-semibold text-foreground">{bankInfo.bank_name}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-secondary/20 border border-border">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Số tài khoản:</span>
                      <span className="font-mono font-bold text-sm text-foreground">{bankInfo.account_number}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy("acc", "Số tài khoản", bankInfo.account_number)}
                      className="inline-flex items-center gap-1 border border-border px-2.5 py-1 bg-background hover:bg-secondary rounded text-[11px]"
                    >
                      {copiedKey === "acc" ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-secondary/20 border border-border">
                    <span className="text-muted-foreground">Chủ tài khoản:</span>
                    <span className="font-semibold text-foreground uppercase">{bankInfo.account_name}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-secondary/40 border border-border">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Số tiền chính xác:</span>
                      <span className="font-serif font-bold text-base text-foreground">{formatVND(order.grand_total_vnd)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy("amount", "Số tiền", String(order.grand_total_vnd))}
                      className="inline-flex items-center gap-1 border border-border px-2.5 py-1 bg-background hover:bg-secondary rounded text-[11px]"
                    >
                      {copiedKey === "amount" ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Transfer Content Highlight */}
                  <div className="p-3 bg-amber-500/10 border-2 border-amber-500/40 rounded space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300">
                          Nội dung CK (Bắt buộc):
                        </span>
                        <span className="block text-[10px] text-muted-foreground">Chuyển đúng để hệ thống tự duyệt</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy("des", "Nội dung chuyển khoản", order.order_number)}
                        className="inline-flex items-center gap-1 text-[11px] border border-amber-500/50 bg-background text-amber-900 dark:text-amber-200 px-3 py-1 font-medium hover:bg-amber-500 hover:text-white rounded"
                      >
                        {copiedKey === "des" ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="bg-background p-2 rounded border border-amber-500/20 text-center font-mono font-bold text-base text-foreground tracking-wider select-all">
                      {order.order_number}
                    </div>
                  </div>
                </div>

                {/* Live listening status */}
                <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground bg-secondary/50 py-2.5 px-3 rounded">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />
                  <span>Đang lắng nghe tín hiệu chuyển khoản tự động từ tài khoản…</span>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

