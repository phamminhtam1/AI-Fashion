import {
  ArrowLeft,
  Box,
  Check,
  Crown,
  Eye,
  EyeOff,
  ImagePlus,
  LockKeyhole,
  PenLine,
  Plus,
  ShoppingCart,
  Trash2,
  Unlock,
  UserCog,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminErrorMessage } from "@/lib/admin-language";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const BRAND = "#6335ee";
const INK = "text-[#0b0c24]";
const MUTED = "text-[#5a6a8e]";
const LINE = "border-[#e6eaf2]";
const panel = "rounded-xs border border-[#e6eaf2] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const inputCls = "h-9 rounded-xs border-[#e1e6ef] bg-white text-sm shadow-none placeholder:text-[#8a97b3]";
const outlineBtn = "rounded-xs border-[#e1e6ef] bg-white font-medium text-[#0b0c24] shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:bg-slate-50";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;
type Mode = "create" | "edit";
type RoleItem = { id: string; code: string; name: string; description: string };
type StaffItem = Awaited<ReturnType<typeof adminApi.staff>>["items"][number];

type EmployeeFormPageProps = {
  mode: Mode;
  employeeId?: string | null;
  permissions?: string[];
  onBack: () => void;
};

type FormState = {
  full_name: string;
  work_email: string;
  phone: string;
  job_title: string;
  notes: string;
  role_code: string;
  password: string;
  password_confirm: string;
  avatar_url: string | null;
};

const roleStyle: Record<string, { icon: IconType; cls: string; bg: string }> = {
  system_owner: { icon: Crown, cls: "text-[#693ae5]", bg: "bg-[#f5f1ff]" },
  ops_manager: { icon: UserCog, cls: "text-[#2f7bff]", bg: "bg-[#eff5ff]" },
  sales_staff: { icon: ShoppingCart, cls: "text-[#ff7a1a]", bg: "bg-[#fff4e9]" },
  content_editor: { icon: PenLine, cls: "text-[#f0125f]", bg: "bg-[#fff0f6]" },
  warehouse_staff: { icon: Box, cls: "text-[#1d4ff0]", bg: "bg-[#eff5ff]" },
};

const fallbackRoles: RoleItem[] = [
  { id: "", code: "ops_manager", name: "Quản lý", description: "Toàn quyền quản lý, bao gồm nhân viên, sản phẩm, đơn hàng." },
  { id: "", code: "sales_staff", name: "Nhân viên bán hàng", description: "Tạo đơn, quản lý khách hàng, tư vấn." },
  { id: "", code: "content_editor", name: "Nhân viên content", description: "Tạo và quản lý nội dung." },
  { id: "", code: "warehouse_staff", name: "Nhân viên kho", description: "Quản lý tồn kho, kiểm hàng." },
];

function emptyForm(): FormState {
  return { full_name: "", work_email: "", phone: "", job_title: "", notes: "", role_code: "ops_manager", password: "Trang1234@", password_confirm: "Trang1234@", avatar_url: null };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "NV";
}

function roleDescription(code: string) {
  return fallbackRoles.find((role) => role.code === code)?.description ?? "Vai trò tùy chỉnh trong hệ thống.";
}

function RoleCard({ role, selected, onSelect }: { role: RoleItem; selected: boolean; onSelect: () => void }) {
  const style = roleStyle[role.code] ?? { icon: UserRound, cls: "text-[#2f7bff]", bg: "bg-[#eff5ff]" };
  const Icon = style.icon;
  return (
    <button type="button" onClick={onSelect} className={cn("flex min-h-[72px] items-center gap-3 rounded-xs border p-3 text-left transition", selected ? "border-[#6b3cf0] bg-[#faf8ff] shadow-[0_0_0_1px_#6b3cf0]" : "border-[#e1e6ef] bg-white hover:border-violet-300")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xs", style.bg)}><Icon className={cn("size-5", style.cls)} strokeWidth={1.8} /></span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-semibold", INK)}>{role.name}</span>
        <span className={cn("mt-0.5 block line-clamp-2 text-xs leading-4", MUTED)}>{role.description}</span>
      </span>
      <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", selected ? "border-[#6b3cf0] bg-[#6b3cf0] text-white" : "border-[#b9c3d5] bg-white")}>
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

function AvatarPicker({ form, mode, uploading, onFile, onRemove }: { form: FormState; mode: Mode; uploading: boolean; onFile: (file: File) => void; onRemove: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-5">
      {form.avatar_url ? <img src={form.avatar_url} alt="Ảnh đại diện" className="size-[78px] rounded-full object-cover ring-1 ring-[#e2e7f0]" /> : <span className="grid size-[78px] place-items-center rounded-full bg-[#eef2f8] text-[#7b8ba8]"><UserRound className="size-10" strokeWidth={1.4} /></span>}
      <div className="flex items-center gap-3">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }} />
        <Button type="button" variant="outline" className={cn("h-9 gap-2 px-3 text-sm", outlineBtn)} onClick={() => inputRef.current?.click()} disabled={uploading}>
          <ImagePlus className="size-4 text-[#6335ee]" /> {uploading ? "Đang tải..." : mode === "edit" ? "Thay đổi ảnh" : "Thêm ảnh"}
        </Button>
        {mode === "edit" && form.avatar_url && <Button type="button" variant="outline" className={cn("h-9 gap-2 border-red-200 px-3 text-sm text-red-600 hover:bg-red-50", outlineBtn)} onClick={onRemove}><Trash2 className="size-4" /> Xóa ảnh</Button>}
        <p className={cn("absolute mt-[68px] text-xs", MUTED)}>JPG, PNG tối đa 2MB</p>
      </div>
    </div>
  );
}

export function EmployeeFormPage({ mode, employeeId, permissions = [], onBack }: EmployeeFormPageProps) {
  const navigate = useNavigate();
  const canManage = permissions.includes("*") || permissions.includes("staff.manage");
  const [roles, setRoles] = useState<RoleItem[]>(fallbackRoles);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [status, setStatus] = useState<"active" | "locked" | "left">("active");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([adminApi.roles(), mode === "edit" && employeeId ? adminApi.staff() : Promise.resolve(null)])
      .then(([roleResponse, staffResponse]) => {
        if (cancelled) return;
        const nextRoles = roleResponse.items.map((role) => ({ id: role.id, code: role.code, name: role.name, description: role.description }));
        if (nextRoles.length) setRoles(nextRoles);
        if (mode === "edit" && employeeId && staffResponse) {
          const employee = staffResponse.items.find((item) => item.id === employeeId);
          if (!employee) throw new Error("Không tìm thấy nhân viên");
          setForm({ full_name: employee.full_name, work_email: employee.work_email ?? "", phone: employee.phone ?? "", job_title: employee.job_title ?? "", notes: employee.notes ?? "", role_code: employee.role?.role_code ?? employee.roles[0]?.role_code ?? nextRoles[0]?.code ?? "ops_manager", password: "", password_confirm: "", avatar_url: employee.avatar_url });
          setStatus(employee.status === "locked" || employee.status === "left" ? employee.status : "active");
        } else if (nextRoles.length) {
          setForm((current) => ({ ...current, role_code: nextRoles.find((role) => role.code === current.role_code)?.code ?? nextRoles[0]!.code }));
        }
      })
      .catch((error) => { if (!cancelled) toast.error(error instanceof Error ? adminErrorMessage(error) : "Không tải được dữ liệu nhân viên"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId, mode]);

  const selectedRole = useMemo(() => roles.find((role) => role.code === form.role_code), [form.role_code, roles]);
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("Ảnh tối đa 2MB"); return; }
    setUploading(true);
    try { const response = await adminApi.uploadStaffAvatar(file); setField("avatar_url", response.url); toast.success("Đã tải ảnh đại diện"); }
    catch (error) { toast.error(error instanceof Error ? adminErrorMessage(error) : "Không tải được ảnh đại diện"); }
    finally { setUploading(false); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || saving) return;
    if (mode === "create" && form.password !== form.password_confirm) { toast.error("Mật khẩu xác nhận không khớp"); return; }
    if (!form.role_code) { toast.error("Vui lòng chọn vai trò"); return; }
    setSaving(true);
    try {
      if (mode === "create") {
        await adminApi.createStaff({ full_name: form.full_name.trim(), work_email: form.work_email.trim(), phone: form.phone.trim() || undefined, job_title: form.job_title.trim() || undefined, notes: form.notes.trim() || undefined, avatar_url: form.avatar_url, role_code: form.role_code, password: form.password || "Trang1234@" });
        toast.success("Đã tạo nhân viên");
      } else if (employeeId) {
        await adminApi.updateStaffProfile(employeeId, { full_name: form.full_name.trim(), work_email: form.work_email.trim(), phone: form.phone.trim() || null, job_title: form.job_title.trim() || null, notes: form.notes.trim() || null, avatar_url: form.avatar_url });
        await adminApi.updateStaffRoles(employeeId, [form.role_code]);
        toast.success("Đã lưu thay đổi nhân viên");
      }
      navigate({ to: "/phanquyen" });
    } catch (error) { toast.error(error instanceof Error ? adminErrorMessage(error) : "Không thể lưu nhân viên"); }
    finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    if (!employeeId || status === "left") return;
    const next = status === "active" ? "locked" : "active";
    try { await adminApi.updateStaff(employeeId, next); setStatus(next); toast.success(next === "locked" ? "Đã tạm khóa tài khoản" : "Đã mở khóa tài khoản"); }
    catch (error) { toast.error(error instanceof Error ? adminErrorMessage(error) : "Không cập nhật được trạng thái"); }
  };

  if (!canManage) return <div className={cn(panel, "p-8 text-center text-sm text-red-600")}>Bạn không có quyền quản lý nhân viên.</div>;
  if (loading) return <div className={cn(panel, "flex min-h-[420px] items-center justify-center text-sm", MUTED)}>Đang tải thông tin nhân viên...</div>;

  return (
    <form onSubmit={submit} className="space-y-4 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button type="button" onClick={onBack} className="mt-2 grid size-8 place-items-center rounded-xs border border-[#e1e6ef] bg-white text-[#0b0c24] hover:bg-slate-50" aria-label="Quay lại"><ArrowLeft className="size-4" /></button>
          <div><h1 className="text-3xl font-bold leading-9 tracking-tight text-[#00000b]">{mode === "create" ? "Thêm nhân viên" : "Chỉnh sửa nhân viên"}</h1><p className={cn("mt-1 text-sm", MUTED)}>{mode === "create" ? "Tạo tài khoản nhân viên mới để cấp quyền truy cập vào hệ thống ÉLANE." : "Cập nhật thông tin và phân quyền cho nhân viên."}</p></div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-4">
          <section className={cn(panel, "p-5")}>
            <h2 className={cn("text-lg font-semibold", INK)}>Thông tin cơ bản</h2>
            <div className="mt-5"><AvatarPicker form={form} mode={mode} uploading={uploading} onFile={(file) => void handleFile(file)} onRemove={() => setField("avatar_url", null)} /></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Họ và tên" required><Input required className={inputCls} placeholder="Nhập họ và tên" value={form.full_name} onChange={(event) => setField("full_name", event.target.value)} /></Field>
              <Field label="Email" required><Input required type="email" disabled={mode === "edit"} className={inputCls} placeholder="Nhập email công việc" value={form.work_email} onChange={(event) => setField("work_email", event.target.value)} /></Field>
              <Field label="Số điện thoại"><Input className={inputCls} placeholder="Nhập số điện thoại" value={form.phone} onChange={(event) => setField("phone", event.target.value)} /></Field>
              <Field label="Chức danh"><Input className={inputCls} placeholder="Ví dụ: Nhân viên content" value={form.job_title} onChange={(event) => setField("job_title", event.target.value)} /></Field>
            </div>
            <Field label="Ghi chú" className="mt-4"><Textarea className="min-h-[82px] rounded-xs border-[#e1e6ef] text-sm" maxLength={500} placeholder="Nhập ghi chú (nếu có)" value={form.notes} onChange={(event) => setField("notes", event.target.value)} /><p className={cn("mt-1 text-right text-xs", MUTED)}>{form.notes.length}/500</p></Field>
          </section>

          {mode === "create" && <section className={cn(panel, "p-5")}>
            <h2 className={cn("text-lg font-semibold", INK)}>Thiết lập tài khoản</h2>
            <p className={cn("mt-1 text-sm", MUTED)}>Thông tin dùng để nhân viên đăng nhập vào hệ thống.</p>
            <div className="mt-5 space-y-4">
              <Field label="Tên đăng nhập" required><Input required readOnly className={cn(inputCls, "bg-[#f7f8fb]")} placeholder="Dùng email công việc" value={form.work_email} onChange={() => undefined} /><p className={cn("mt-1.5 text-xs", MUTED)}>Tên đăng nhập sử dụng email công việc.</p></Field>
              <div className="grid gap-4 sm:grid-cols-2"><PasswordField label="Mật khẩu" value={form.password} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(value) => setField("password", value)} /><PasswordField label="Xác nhận mật khẩu" value={form.password_confirm} visible={showConfirm} onToggle={() => setShowConfirm((value) => !value)} onChange={(value) => setField("password_confirm", value)} /></div>
            </div>
          </section>}

          {mode === "edit" && <section className={cn(panel, "p-5")}>
            <div className="flex items-center justify-between gap-4"><div><h2 className={cn("text-lg font-semibold", INK)}>Trạng thái tài khoản</h2><p className={cn("mt-1 text-sm", MUTED)}>Kiểm soát khả năng đăng nhập và sử dụng hệ thống.</p></div><Button type="button" variant="outline" className={cn("h-9 gap-2", outlineBtn)} onClick={() => void toggleStatus()} disabled={status === "left"}>{status === "active" ? <><LockKeyhole className="size-4" /> Tạm khóa</> : <><Unlock className="size-4" /> Mở khóa</>}</Button></div><div className="mt-4 flex items-center gap-2 text-sm font-medium"><span className={cn("size-2.5 rounded-full", status === "active" ? "bg-[#12b76a]" : status === "locked" ? "bg-[#ff8a00]" : "bg-red-500")} />{status === "active" ? "Đang hoạt động" : status === "locked" ? "Tạm khóa" : "Đã nghỉ việc"}</div>
          </section>}
        </div>

        <section className={cn(panel, "p-5") }>
          <h2 className={cn("text-lg font-semibold", INK)}>Phân quyền</h2>
          <p className={cn("mt-1 text-sm", MUTED)}>Chọn vai trò cho nhân viên hoặc thiết lập quyền tùy chỉnh.</p>
          <p className="mt-5 text-sm font-semibold text-[#0b0c24]">Chọn vai trò <span className="text-red-500">*</span></p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{roles.filter((role) => role.code !== "system_owner" || permissions.includes("*")).map((role) => <RoleCard key={role.id || role.code} role={role} selected={form.role_code === role.code} onSelect={() => setField("role_code", role.code)} />)}</div>
          {selectedRole && <p className={cn("mt-4 rounded-xs bg-[#f8f6ff] px-3 py-2 text-xs", MUTED)}>Đang chọn: <strong className="text-[#6335ee]">{selectedRole.name}</strong> · {roleDescription(selectedRole.code)}</p>}
          <button type="button" className="mt-4 flex w-full items-center justify-between rounded-xs bg-[#f8f6ff] px-3 py-3 text-sm text-[#6335ee] hover:bg-[#f1edff]" onClick={() => toast.info("Bạn có thể tinh chỉnh quyền chi tiết trong tab Vai trò sau khi tạo nhân viên.")}><span>Hoặc thiết lập quyền tùy chỉnh</span><span className="font-semibold">Thiết lập quyền chi tiết <Plus className="ml-1 inline size-4" /></span></button>
        </section>
      </div>

      <div className="flex justify-end gap-3 border-t border-[#e6eaf2] pt-4"><Button type="button" variant="outline" className={cn("h-9 px-4", outlineBtn)} onClick={onBack}>Hủy</Button><Button type="submit" disabled={saving || uploading} style={{ backgroundColor: BRAND }} className="h-9 rounded-xs px-4 text-white hover:opacity-90">{saving ? "Đang lưu..." : mode === "create" ? "Tạo nhân viên" : "Lưu thay đổi"}</Button></div>
    </form>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: ReactNode }) { return <label className={cn("block", className)}><span className="mb-1.5 block text-sm font-medium text-[#0b0c24]">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</span>{children}</label>; }

function PasswordField({ label, value, visible, onToggle, onChange }: { label: string; value: string; visible: boolean; onToggle: () => void; onChange: (value: string) => void }) { return <Field label={label} required><div className="relative"><Input required minLength={8} type={visible ? "text" : "password"} className={cn(inputCls, "pr-10")} value={value} onChange={(event) => onChange(event.target.value)} /><button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71809e]" onClick={onToggle} aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></Field>; }
