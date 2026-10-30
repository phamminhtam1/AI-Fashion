import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  CircleDot,
  Info,
  Landmark,
  LoaderCircle,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { adminApi, type AdminStoreSettings } from "@/lib/api";
import { adminErrorMessage } from "@/lib/admin-language";
import { cn } from "@/lib/utils";

type EditableSettings = Omit<AdminStoreSettings, "bankTransferConfigured" | "updatedAt">;

function editable(value: AdminStoreSettings): EditableSettings {
  return {
    brand: { ...value.brand },
    payments: { ...value.payments },
    shipping: { ...value.shipping },
    returns: { ...value.returns },
    notifications: { ...value.notifications },
  };
}

function updatedLabel(value: string | null) {
  if (!value) return "Đã tải cấu hình hiện tại";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Đã tải cấu hình hiện tại";
  return `Đã lưu ${date.toLocaleDateString("vi-VN")} lúc ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

export function SettingsManager({ permissions }: { permissions: string[] }) {
  const canWrite = permissions.includes("*") || permissions.includes("settings.write");
  const [saved, setSaved] = useState<AdminStoreSettings | null>(null);
  const [draft, setDraft] = useState<EditableSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dirty = useMemo(
    () => Boolean(saved && draft && JSON.stringify(editable(saved)) !== JSON.stringify(draft)),
    [draft, saved],
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await adminApi.storeSettings();
      setSaved(result.value);
      setDraft(editable(result.value));
    } catch (error) {
      setLoadError(error instanceof Error ? adminErrorMessage(error) : "Không tải được cài đặt cửa hàng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, []);

  function update<K extends keyof EditableSettings>(key: K, value: EditableSettings[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!draft || !canWrite || saving) return;
    if (!draft.payments.codEnabled && !draft.payments.bankEnabled) {
      toast.error("Bật ít nhất một phương thức thanh toán trước khi lưu.");
      document.getElementById("settings-payments")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    try {
      const result = await adminApi.updateStoreSettings(draft);
      setSaved(result.value);
      setDraft(editable(result.value));
      toast.success("Đã lưu cài đặt cửa hàng");
    } catch (error) {
      toast.error(error instanceof Error ? adminErrorMessage(error) : "Không lưu được cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (saved) setDraft(editable(saved));
  }

  const inputClass = "h-10 rounded-xs border-input bg-white shadow-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/10";
  const fieldClass = "space-y-1.5";

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-sans admin-page-title">Cài đặt cửa hàng</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quản lý thông tin hiển thị, thanh toán, vận chuyển và trải nghiệm sau mua.</p>
        </div>
        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <Check className="size-4 text-emerald-600" aria-hidden="true" />
          <span>{updatedLabel(saved?.updatedAt ?? null)}</span>
        </div>
      </header>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadSettings()}>Tải lại</Button>
        </div>
      )}

      {loading && !draft ? (
        <div className="grid min-h-64 place-items-center rounded-xs border border-border bg-white text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />Đang tải cấu hình cửa hàng…</span>
        </div>
      ) : draft ? (
        <div className="min-w-0">
          <div className="space-y-3">
            <section id="settings-general" className="rounded-xs border border-border bg-white px-4 py-5 sm:px-5">
              <SectionHeading title="Thông tin chung" description="Tên và nội dung thương hiệu hiển thị trên cửa hàng." />
              <div className="grid w-full gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className={fieldClass}><Label htmlFor="store-name">Tên cửa hàng</Label><Input id="store-name" value={draft.brand.name} disabled={!canWrite} className={inputClass} onChange={(event) => update("brand", { ...draft.brand, name: event.target.value })} /></div>
                <div className={fieldClass}><Label htmlFor="store-tagline">Thông điệp thương hiệu</Label><Input id="store-tagline" value={draft.brand.tagline} disabled={!canWrite} className={inputClass} onChange={(event) => update("brand", { ...draft.brand, tagline: event.target.value })} /></div>
                <div className={fieldClass}><Label htmlFor="support-email">Email chăm sóc khách hàng</Label><Input id="support-email" type="email" value={draft.brand.supportEmail} disabled={!canWrite} className={inputClass} onChange={(event) => update("brand", { ...draft.brand, supportEmail: event.target.value })} /></div>
                <div className={fieldClass}><Label htmlFor="support-phone">Hotline</Label><Input id="support-phone" type="tel" value={draft.brand.supportPhone} disabled={!canWrite} className={inputClass} onChange={(event) => update("brand", { ...draft.brand, supportPhone: event.target.value })} /></div>
              </div>
              <InfoNote>Thông tin thương hiệu được đồng bộ vào dữ liệu công khai của cửa hàng.</InfoNote>
          </section>

            <section id="settings-payments" className="rounded-xs border border-border bg-white px-4 py-5 sm:px-5">
              <SectionHeading title="Thanh toán" description="Chọn các phương thức khách hàng có thể dùng khi đặt hàng." />
              <div className="grid gap-3 xl:grid-cols-2">
                <div className="rounded-xs border border-border bg-slate-50/40 px-4">
                  <SettingSwitch title="Thanh toán khi nhận hàng (COD)" description="Khách thanh toán trực tiếp cho đơn vị giao hàng." checked={draft.payments.codEnabled} disabled={!canWrite || (!draft.payments.bankEnabled && draft.payments.codEnabled)} onChange={(checked) => update("payments", { ...draft.payments, codEnabled: checked })} />
                </div>
                <div className="rounded-xs border border-border bg-slate-50/40 px-4">
                  <SettingSwitch title="Chuyển khoản VietQR" description="Đối soát giao dịch tự động qua SePay." checked={draft.payments.bankEnabled} disabled={!canWrite || (!saved?.bankTransferConfigured && !draft.payments.bankEnabled)} onChange={(checked) => update("payments", { ...draft.payments, bankEnabled: checked })} />
                </div>
              </div>
              <div className="mt-4 flex w-full items-start gap-3 rounded-xs border border-border bg-slate-50/70 p-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xs bg-white text-slate-600 ring-1 ring-border"><Landmark className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">Tài khoản nhận tiền</p><p className="mt-1 text-xs text-muted-foreground">Số tài khoản và webhook được quản lý an toàn trên máy chủ; khóa bí mật không hiển thị tại đây.</p>{!saved?.bankTransferConfigured && <p className="mt-2 text-xs font-medium text-amber-700">Chưa cấu hình SEPAY_BANK_ACCOUNT và SEPAY_BANK_BIN.</p>}</div>
                <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium", saved?.bankTransferConfigured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}><span className={cn("size-1.5 rounded-full", saved?.bankTransferConfigured ? "bg-emerald-500" : "bg-amber-500")} />{saved?.bankTransferConfigured ? "SePay" : "Chưa kết nối"}</span>
              </div>
              {!draft.payments.codEnabled && !draft.payments.bankEnabled && <p className="mt-3 text-sm text-rose-700">Bật ít nhất một phương thức thanh toán để lưu.</p>}
          </section>

            <section id="settings-shipping" className="rounded-xs border border-border bg-white px-4 py-5 sm:px-5">
              <SectionHeading title="Vận chuyển" description="Thiết lập phí và điều kiện miễn phí vận chuyển trên website." status="Đang áp dụng" />
              <div className="grid w-full gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className={fieldClass}><Label htmlFor="free-shipping-threshold">Miễn phí vận chuyển từ</Label><div className="relative"><Input id="free-shipping-threshold" type="number" min={0} step={10000} value={draft.shipping.freeShippingFromVnd} disabled={!canWrite} className={cn(inputClass, "pr-10 tabular-nums")} onChange={(event) => update("shipping", { ...draft.shipping, freeShippingFromVnd: Math.max(0, Number(event.target.value) || 0) })} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">₫</span></div><p className="text-xs text-muted-foreground">Đơn đạt ngưỡng sẽ được miễn phí vận chuyển tự động.</p></div>
                <div className={fieldClass}><Label htmlFor="shipping-fee">Phí vận chuyển tiêu chuẩn</Label><div className="relative"><Input id="shipping-fee" type="number" min={0} step={1000} value={draft.shipping.feeVnd} disabled={!canWrite} className={cn(inputClass, "pr-10 tabular-nums")} onChange={(event) => update("shipping", { ...draft.shipping, feeVnd: Math.max(0, Number(event.target.value) || 0) })} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">₫</span></div><p className="text-xs text-muted-foreground">Áp dụng khi đơn chưa đạt ngưỡng miễn phí.</p></div>
                <div className={fieldClass}><Label htmlFor="city-delivery">Giao nội thành</Label><Input id="city-delivery" value={draft.shipping.cityDeliveryDays} disabled={!canWrite} className={inputClass} onChange={(event) => update("shipping", { ...draft.shipping, cityDeliveryDays: event.target.value })} /></div>
                <div className={fieldClass}><Label htmlFor="other-delivery">Giao tỉnh thành khác</Label><Input id="other-delivery" value={draft.shipping.otherDeliveryDays} disabled={!canWrite} className={inputClass} onChange={(event) => update("shipping", { ...draft.shipping, otherDeliveryDays: event.target.value })} /></div>
              </div>
              <InfoNote>Mức phí được dùng khi tính tổng tiền ở bước thanh toán và hiển thị trong chính sách vận chuyển.</InfoNote>
          </section>

            <section id="settings-returns" className="rounded-xs border border-border bg-white px-4 py-5 sm:px-5">
              <SectionHeading title="Đổi trả" description="Quy định này được hiển thị trên trang chính sách của cửa hàng." status="Đang công khai" />
              <div className="grid w-full gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className={fieldClass}><Label htmlFor="return-window">Thời hạn đổi trả</Label><div className="relative"><Input id="return-window" type="number" min={1} max={180} value={draft.returns.returnWindowDays} disabled={!canWrite} className={cn(inputClass, "pr-14 tabular-nums")} onChange={(event) => update("returns", { ...draft.returns, returnWindowDays: Math.max(1, Number(event.target.value) || 1) })} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">ngày</span></div></div>
                <div className={fieldClass}><Label htmlFor="refund-window">Thời gian hoàn tiền</Label><Input id="refund-window" value={draft.returns.refundWindow} disabled={!canWrite} className={inputClass} onChange={(event) => update("returns", { ...draft.returns, refundWindow: event.target.value })} /></div>
                <div className={cn(fieldClass, "sm:col-span-2 xl:col-span-4")}><Label htmlFor="return-conditions">Điều kiện đổi trả</Label><Textarea id="return-conditions" rows={4} value={draft.returns.conditions} disabled={!canWrite} className="min-h-24 rounded-xs border-input bg-white shadow-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/10" onChange={(event) => update("returns", { ...draft.returns, conditions: event.target.value })} /><p className="text-xs text-muted-foreground">Nội dung này được cập nhật trên trang Chính sách đổi trả.</p></div>
              </div>
          </section>

            <section id="settings-notifications" className="rounded-xs border border-border bg-white px-4 py-5 sm:px-5">
              <SectionHeading title="Thông báo quản trị" description="Chọn sự kiện hiển thị trong chuông thông báo của admin." status="Trong admin" />
              <div className="grid gap-3 xl:grid-cols-3">
                <div className="rounded-xs border border-border bg-slate-50/40 px-4"><SettingSwitch title="Đơn hàng mới" description="Báo khi cửa hàng nhận đơn đặt mới." checked={draft.notifications.newOrder} disabled={!canWrite} onChange={(checked) => update("notifications", { ...draft.notifications, newOrder: checked })} /></div>
                <div className="rounded-xs border border-border bg-slate-50/40 px-4"><SettingSwitch title="Thanh toán thành công" description="Báo khi đơn hàng được xác nhận đã thanh toán." checked={draft.notifications.paymentSuccess} disabled={!canWrite} onChange={(checked) => update("notifications", { ...draft.notifications, paymentSuccess: checked })} /></div>
                <div className="rounded-xs border border-border bg-slate-50/40 px-4"><SettingSwitch title="SKU sắp hết hàng" description="Báo khi sản phẩm chạm ngưỡng cảnh báo tồn kho." checked={draft.notifications.lowStock} disabled={!canWrite} onChange={(checked) => update("notifications", { ...draft.notifications, lowStock: checked })} /></div>
              </div>
              <InfoNote>Cấu hình này điều khiển thông báo trong admin; hệ thống hiện chưa có dịch vụ gửi email hoặc SMS.</InfoNote>
            </section>
          </div>

          <footer className="sticky bottom-3 z-20 mt-4 flex w-full min-h-[68px] flex-wrap items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white/95 px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md sm:px-4 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
              <CircleDot className={cn("size-4 shrink-0", dirty ? "text-primary" : "text-emerald-600")} aria-hidden="true" />
              <span className="truncate">{dirty ? "Có thay đổi chưa lưu" : updatedLabel(saved?.updatedAt ?? null)}</span>
            </div>
            {canWrite ? (
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" className="h-9 rounded-xs" disabled={!dirty || saving} onClick={discard}>Hủy thay đổi</Button>
                <Button type="button" className="h-9 rounded-xs bg-primary px-4 text-primary-foreground hover:bg-primary/90" disabled={!dirty || saving || loading} onClick={() => void save()}>
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Lưu cài đặt
                </Button>
              </div>
            ) : <span className="shrink-0 text-xs text-muted-foreground">Chỉ xem · thiếu quyền settings.write</span>}
          </footer>
        </div>
      ) : null}
    </div>
  );
}

function SectionHeading({ title, description, status }: { title: string; description: string; status?: string }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-base font-semibold leading-6 text-foreground">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
      {status && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />{status}</span>}
    </header>
  );
}

function SettingSwitch({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex min-h-[68px] items-center justify-between gap-4 py-3">
      <div className="min-w-0"><p className="text-sm font-medium text-foreground">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

function InfoNote({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex w-full items-start gap-2.5 rounded-xs border border-border bg-slate-50/60 px-3.5 py-3 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{children}</div>;
}
