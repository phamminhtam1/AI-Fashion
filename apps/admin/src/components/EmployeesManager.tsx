import {
  ArrowLeft,
  ArrowUp,
  Box,
  CalendarDays,
  Check,
  ChevronDown,
  Crown,
  Eye,
  Globe,
  History,
  KeyRound,
  Lock,
  MoreHorizontal,
  Music2,
  PenLine,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Unlock,
  UserRound,
  UserRoundX,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { AdminPagination } from "@/components/AdminPagination";
import { AnimatedPanel } from "@/components/ui/AnimatedPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adminErrorMessage } from "@/lib/admin-language";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";

/* ═════════════════════════ Design tokens (đo từ design) ═════════════════════════ */

const BRAND = "#243B53"; // màu nhấn thống nhất với các trang quản trị
const MUTED = "text-[#5a6a8e]"; // mô tả, chú thích

const outlineBtn = "rounded-xs border-slate-200 bg-white font-medium text-slate-700 shadow-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#243B53] focus-visible:ring-offset-2";
const primaryBtn = "h-9 rounded-xs bg-[#243B53] px-4 text-sm font-medium text-white shadow-none transition-colors hover:bg-[#1B2E42] focus-visible:ring-2 focus-visible:ring-[#243B53] focus-visible:ring-offset-2";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

/* ═════════════════════════ Kiểu dữ liệu ═════════════════════════ */

type EmployeeStatus = "active" | "locked" | "left";
type Employee = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  roleCode: string;
  roleCodes: string[];
  role: string;
  channel: string;
  channels: string[];
  status: EmployeeStatus;
  joined: string;
  joinedAt: string | null;
  lastActive: string;
  lastActiveAt: string | null;
  initials: string;
};
type RoleOption = { code: string; name: string };

const statusFilters = ["Tất cả trạng thái", "Đang hoạt động", "Tạm khóa", "Đã nghỉ việc"];
const statusLabel: Record<EmployeeStatus, string> = { active: "Đang hoạt động", locked: "Tạm khóa", left: "Đã nghỉ việc" };
const fallbackRoles: RoleOption[] = [
  { code: "system_owner", name: "Admin" },
  { code: "ops_manager", name: "Quản lý" },
  { code: "sales_staff", name: "Nhân viên bán hàng" },
  { code: "content_editor", name: "Nhân viên content" },
  { code: "warehouse_staff", name: "Nhân viên kho" },
];

/** Màu icon bám theo nhóm vai trò, đồng bộ với thẻ vai trò bên tab kế bên. */
const roleStyle: Record<string, { icon: IconType; color: string }> = {
  system_owner: { icon: Crown, color: "text-[#243B53]" },
  ops_manager: { icon: Users, color: "text-[#2878c7]" },
  content_editor: { icon: PenLine, color: "text-[#c44575]" },
  sales_staff: { icon: ShoppingCart, color: "text-[#16886b]" },
  warehouse_staff: { icon: Box, color: "text-[#c47b20]" },
};

const metricTone = {
  brand: { border: "border-t-[#243B53]", icon: "text-[#243B53]", value: "text-[#243B53]", selected: "bg-[#EAF0F6] ring-[#243B53]/25" },
  success: { border: "border-t-emerald-500", icon: "text-emerald-600", value: "text-emerald-700", selected: "bg-emerald-50/70 ring-emerald-500/25" },
  warning: { border: "border-t-amber-500", icon: "text-amber-600", value: "text-amber-700", selected: "bg-amber-50/70 ring-amber-500/25" },
  danger: { border: "border-t-rose-500", icon: "text-rose-600", value: "text-rose-700", selected: "bg-rose-50/70 ring-rose-500/25" },
} as const;

/* ═════════════════════════ Hàm tiện ích ═════════════════════════ */

const pad2 = (n: number) => String(n).padStart(2, "0");

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "NV"; }

/** dd/MM/yyyy */
function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** "2 phút trước", "3 giờ trước", "5 ngày trước". */
function formatLastActive(value: string | null | undefined) {
  if (!value) return "Chưa đăng nhập";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa đăng nhập";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

const isRecent = (value: string | null | undefined) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && Date.now() - time < 24 * 3600 * 1000;
};

function channelFor(roleCode: string) { if (roleCode === "system_owner" || roleCode === "ops_manager") return "Tất cả kênh"; if (roleCode === "sales_staff") return "Kênh bán hàng"; return "—"; }

/** Danh sách kênh phụ trách (nếu API trả về); không có thì rỗng và hiện chữ như cũ. */
function readChannels(item: unknown): string[] {
  const raw = (item as { channels?: unknown; channel_codes?: unknown } | null)?.channels ?? (item as { channel_codes?: unknown } | null)?.channel_codes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => (typeof entry === "string" ? entry : String((entry as { code?: string; platform?: string; name?: string })?.code ?? (entry as { platform?: string })?.platform ?? (entry as { name?: string })?.name ?? "")))
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function mapEmployee(item: Awaited<ReturnType<typeof adminApi.staff>>["items"][number]): Employee {
  const role = item.role;
  const status = item.status === "locked" || item.status === "left" ? item.status : "active";
  return {
    id: item.id,
    name: item.full_name,
    email: item.work_email ?? "",
    phone: item.phone ?? "",
    avatarUrl: item.avatar_url,
    roleCode: role?.role_code ?? "",
    roleCodes: item.roles.map((itemRole) => itemRole.role_code),
    role: role?.role_name ?? "Chưa gán vai trò",
    channel: channelFor(role?.role_code ?? ""),
    channels: readChannels(item),
    status,
    joined: formatDate(item.joined_on),
    joinedAt: item.joined_on ?? null,
    lastActive: formatLastActive(item.last_login_at),
    lastActiveAt: item.last_login_at ?? null,
    initials: initials(item.full_name),
  };
}

/* ═════════════════════════ Trang ═════════════════════════ */

export function EmployeesManager({ embedded = false, permissions = [] }: { embedded?: boolean; permissions?: string[] }) {
  const navigate = useNavigate();
  const canManageRoles = permissions.includes("*") || permissions.includes("role.manage");
  const canStaffManage = permissions.includes("*") || permissions.includes("staff.manage");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>(fallbackRoles);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("Tất cả vai trò");
  const [status, setStatus] = useState(statusFilters[0]!);
  const [channel, setChannel] = useState("Tất cả kênh");
  const [dateOpen, setDateOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", work_email: "", phone: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [roleEmployee, setRoleEmployee] = useState<Employee | null>(null);
  const [selectedRoleCode, setSelectedRoleCode] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: "", work_email: "", phone: "", role_code: "ops_manager", password: "Trang1234@" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try { const response = await adminApi.staff(); setEmployees(response.items.map(mapEmployee)); setError(null); }
    catch (err) { setError(err instanceof Error ? adminErrorMessage(err) : "Không tải được danh sách nhân viên"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void loadEmployees();
    if (canManageRoles) void adminApi.roles().then((response) => { const options = response.items.map((item) => ({ code: item.code, name: item.name })); setRoleOptions(options); setCreateForm((current) => ({ ...current, role_code: options.find((item) => item.code === current.role_code)?.code ?? options[0]?.code ?? current.role_code })); }).catch(() => undefined);
  }, [canManageRoles, loadEmployees]);

  useEffect(() => { setPage(1); }, [query, role, status, channel, dateFrom, dateTo, pageSize]);

  // Đóng menu thao tác khi cuộn / đổi kích thước cửa sổ (menu dùng vị trí fixed).
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [menu]);

  const roleFilters = useMemo(() => ["Tất cả vai trò", ...Array.from(new Set(employees.map((employee) => employee.role).filter(Boolean)))], [employees]);
  const filtered = useMemo(() => employees.filter((employee) => {
    const haystack = `${employee.name} ${employee.email} ${employee.role}`.toLowerCase();
    const joinedTime = employee.joinedAt ? new Date(employee.joinedAt).getTime() : Number.NaN;
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    const channelMatches = channel === "Tất cả kênh" || employee.channel === channel || employee.channels.some((item) => item.includes(channel.toLowerCase()));
    return haystack.includes(query.toLowerCase()) && (role === "Tất cả vai trò" || employee.role === role) && (status === statusFilters[0] || statusLabel[employee.status] === status) && channelMatches && (!Number.isNaN(joinedTime) && joinedTime >= fromTime && joinedTime <= toTime || !dateFrom && !dateTo);
  }), [employees, query, role, status, channel, dateFrom, dateTo]);
  const stats = useMemo(() => ({ total: employees.length, active: employees.filter((employee) => employee.status === "active").length, locked: employees.filter((employee) => employee.status === "locked").length, left: employees.filter((employee) => employee.status === "left").length }), [employees]);
  const newThisMonth = useMemo(() => employees.filter((employee) => employee.joinedAt && Date.now() >= new Date(employee.joinedAt).getTime() && Date.now() - new Date(employee.joinedAt).getTime() < 30 * 24 * 3600 * 1000).length, [employees]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allSelected = pageItems.length > 0 && pageItems.every((employee) => selectedIds.has(employee.id));

  const pct = (value: number) => (stats.total ? Math.round((value / stats.total) * 100) : 0);

  const toggleSelected = (id: string) => setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAllSelected = () => setSelectedIds((current) => { const next = new Set(current); if (allSelected) pageItems.forEach((employee) => next.delete(employee.id)); else pageItems.forEach((employee) => next.add(employee.id)); return next; });

  const openMenu = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    if (menu?.id === id) return setMenu(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 6 * 36 + 12;
    const top = rect.bottom + 3 + menuHeight > window.innerHeight ? Math.max(8, rect.top - 3 - menuHeight) : rect.bottom + 3;
    // Menu lệch ra ngoài mép phải nút ba chấm một đoạn như design.
    const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right + 36 - menuWidth));
    setMenu({ id, top, left });
  };

  const updateStatus = async (employee: Employee) => {
    if (employee.status === "left") return;
    const nextStatus: EmployeeStatus = employee.status === "active" ? "locked" : "active";
    setActionId(employee.id);
    try { await adminApi.updateStaff(employee.id, nextStatus); setEmployees((current) => current.map((item) => item.id === employee.id ? { ...item, status: nextStatus } : item)); toast.success(nextStatus === "locked" ? `Đã tạm khóa ${employee.name}` : `Đã mở khóa ${employee.name}`); }
    catch (err) { toast.error(err instanceof Error ? adminErrorMessage(err) : "Không cập nhật được trạng thái nhân viên"); }
    finally { setActionId(null); setMenu(null); }
  };

  const saveRole = async () => {
    if (!canManageRoles || !roleEmployee || !selectedRoleCode) return;
    setActionId(roleEmployee.id);
    try { await adminApi.updateStaffRoles(roleEmployee.id, [selectedRoleCode]); const nextRole = roleOptions.find((item) => item.code === selectedRoleCode); setEmployees((current) => current.map((item) => item.id === roleEmployee.id ? { ...item, roleCode: selectedRoleCode, roleCodes: [selectedRoleCode], role: nextRole?.name ?? item.role, channel: channelFor(selectedRoleCode), channels: [] } : item)); toast.success(`Đã đổi vai trò cho ${roleEmployee.name}`); setRoleEmployee(null); }
    catch (err) { toast.error(err instanceof Error ? adminErrorMessage(err) : "Không cập nhật được vai trò"); }
    finally { setActionId(null); }
  };

  const createEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setCreateSaving(true);
    try { const payload: Parameters<typeof adminApi.createStaff>[0] = { full_name: createForm.full_name, work_email: createForm.work_email, role_code: createForm.role_code, password: createForm.password }; if (createForm.phone) payload.phone = createForm.phone; await adminApi.createStaff(payload); toast.success("Đã thêm nhân viên mới"); setCreateOpen(false); setCreateForm((current) => ({ ...current, full_name: "", work_email: "", phone: "" })); await loadEmployees(); }
    catch (err) { toast.error(err instanceof Error ? adminErrorMessage(err) : "Không thể thêm nhân viên"); }
    finally { setCreateSaving(false); }
  };

  const openEdit = (employee: Employee) => {
    setMenu(null);
    navigate({ to: `/phanquyen/nhanvien/sua/${employee.id}` });
  };

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editEmployee) return;
    setEditSaving(true);
    try {
      await adminApi.updateStaffProfile(editEmployee.id, { full_name: editForm.full_name, work_email: editForm.work_email, phone: editForm.phone || null });
      setEmployees((current) => current.map((item) => item.id === editEmployee.id ? { ...item, name: editForm.full_name, email: editForm.work_email, phone: editForm.phone } : item));
      toast.success(`Đã cập nhật thông tin ${editForm.full_name}`);
      setEditEmployee(null);
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Không cập nhật được thông tin nhân viên");
    } finally {
      setEditSaving(false);
    }
  };

  const resetPassword = async (employee: Employee) => {
    if (!window.confirm(`Đặt lại mật khẩu của ${employee.name} về Trang1234@?`)) return;
    setActionId(employee.id);
    try {
      await adminApi.resetStaffPassword(employee.id);
      toast.success(`Đã đặt lại mật khẩu cho ${employee.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Không đặt lại được mật khẩu");
    } finally {
      setActionId(null);
      setMenu(null);
    }
  };

  const retireEmployee = async (employee: Employee) => {
    if (!window.confirm(`Xác nhận cho ${employee.name} nghỉ việc? Tài khoản sẽ bị khóa.`)) return;
    setActionId(employee.id);
    try {
      await adminApi.updateStaff(employee.id, "left");
      setEmployees((current) => current.map((item) => item.id === employee.id ? { ...item, status: "left" } : item));
      toast.success(`Đã cập nhật ${employee.name} thành đã nghỉ việc`);
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Không cập nhật được nhân viên");
    } finally {
      setActionId(null);
      setMenu(null);
    }
  };

  const menuEmployee = menu ? employees.find((employee) => employee.id === menu.id) : undefined;

  const addButton = (
    <Button onClick={() => navigate({ to: "/phanquyen/nhanvien/them" })} className={cn(primaryBtn, "gap-2")}>
      <Plus className="size-4" strokeWidth={1.75} /> Thêm nhân viên
    </Button>
  );

  return <div className="space-y-3.5 pb-6">
    {/* ───────── HEADER ───────── */}
    {!embedded && <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-start gap-[25px]">
        <button type="button" className="ml-[15px] mt-[9px] grid size-[18px] place-items-center text-[#0b0c24] hover:opacity-70" aria-label="Quay lại">
          <ArrowLeft className="size-[18px]" strokeWidth={1.75} />
        </button>
        <div>
          <h1 className="text-3xl font-bold leading-9 tracking-tight text-[#00000b]">Nhân viên</h1>
          <p className={cn("mt-1 text-sm", MUTED)}>Quản lý tài khoản nhân viên, vai trò và quyền truy cập vào hệ thống ÉLANE.</p>
        </div>
      </div>
      <div className="mt-1.5 flex gap-3">
        <Button variant="outline" className={cn("h-9 gap-2 px-3.5 text-sm", outlineBtn)}><History className="size-4" strokeWidth={1.75} /> Nhật ký hoạt động</Button>
        {canStaffManage && addButton}
      </div>
    </div>}
    {/* ───────── THỐNG KÊ ───────── */}
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Users}
        tone="brand"
        active={status === statusFilters[0]}
        onClick={() => setStatus(statusFilters[0]!)}
        value={String(stats.total)}
        label="Tổng nhân viên"
        note={<span className="inline-flex items-center gap-1.5"><span className="inline-flex items-center gap-1 font-medium text-emerald-700"><ArrowUp className="size-3.5" strokeWidth={2} />{newThisMonth} mới</span><span>trong 30 ngày qua</span></span>}
      />
      <StatCard icon={UserRound} tone="success" active={status === statusLabel.active} onClick={() => setStatus(statusLabel.active)} value={String(stats.active)} label="Đang hoạt động" note={<><b className="font-semibold text-emerald-700">{pct(stats.active)}%</b> tổng nhân viên</>} />
      <StatCard icon={Lock} tone="warning" active={status === statusLabel.locked} onClick={() => setStatus(statusLabel.locked)} value={String(stats.locked)} label="Tạm khóa" note={<><b className="font-semibold text-amber-700">{pct(stats.locked)}%</b> tổng nhân viên</>} />
      <StatCard icon={UserRoundX} tone="danger" active={status === statusLabel.left} onClick={() => setStatus(statusLabel.left)} value={String(stats.left)} label="Đã nghỉ việc" note={<><b className="font-semibold text-rose-700">{pct(stats.left)}%</b> tổng nhân viên</>} />
    </div>

    {/* ───────── BẢNG NHÂN VIÊN ───────── */}
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm theo tên, email, số điện thoại..." className="h-9 rounded-xs border-slate-200 bg-white pl-10 text-sm shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#243B53]" />
        </div>
        <FilterSelect className="w-[179px]" value={role} options={roleFilters} onChange={setRole} />
        <FilterSelect className="w-[187px]" value={status} options={statusFilters} onChange={setStatus} />
        <FilterSelect className="w-[242px]" value={channel} options={["Tất cả kênh", "Kênh bán hàng", "Instagram", "Facebook", "TikTok", "Shopee", "Website"]} onChange={setChannel} />
      <Button variant="outline" onClick={() => setDateOpen(true)} className={cn("h-9 w-[230px] justify-start gap-2.5 px-3.5 text-sm font-normal", outlineBtn)}>
          <CalendarDays className="size-4" strokeWidth={1.75} /> {dateFrom || dateTo ? `${dateFrom || "..."} – ${dateTo || "..."}` : "Chọn khoảng thời gian"}
        </Button>
      </div>

      {error && <div className="rounded-xs border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error} <button type="button" className="ml-2 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500" onClick={() => void loadEmployees()}>Thử lại</button></div>}

      <AnimatedPanel transitionKey={`${status}:${role}`} className="admin-table-frame rounded-xs border border-slate-200 bg-white">
        <div className="overflow-x-auto">
        <table className="admin-data-table w-full min-w-[1180px] table-fixed text-left text-sm">
          <colgroup><col style={{ width: "4%" }} /><col style={{ width: "20%" }} /><col style={{ width: "15%" }} /><col style={{ width: "13%" }} /><col style={{ width: "12%" }} /><col style={{ width: "11%" }} /><col style={{ width: "12%" }} /><col style={{ width: "13%" }} /></colgroup>
          <thead className="border-b border-slate-200 bg-white text-xs font-medium text-slate-500">
            <tr>
              <th className="w-11 px-3 py-2.5"><Checkbox checked={allSelected} onChange={toggleAllSelected} label="Chọn tất cả" /></th>
              <th className="px-3 py-2.5 font-medium">Nhân viên</th>
              <th className="px-3 py-2.5 font-medium">Vai trò</th>
              <th className="px-3 py-2.5 font-medium">Kênh phụ trách</th>
              <th className="px-3 py-2.5 font-medium">Trạng thái</th>
              <th className="px-3 py-2.5 font-medium">Ngày tham gia</th>
              <th className="px-3 py-2.5 font-medium">Hoạt động cuối</th>
              <th className="px-3 py-2.5 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading
              ? <tr><td colSpan={8} className={cn("px-6 py-12 text-center", MUTED)}>Đang tải danh sách nhân viên...</td></tr>
              : pageItems.length === 0
                ? <tr><td colSpan={8} className={cn("px-6 py-12 text-center", MUTED)}>Không tìm thấy nhân viên phù hợp.</td></tr>
                : pageItems.map((employee) => {
                  const style = roleStyle[employee.roleCode];
                  const RoleIcon = style?.icon ?? UserRound;
                  return <tr key={employee.id} className={cn("transition-colors hover:bg-slate-50/80", selectedIds.has(employee.id) && "bg-slate-50")}>
                    <td className="px-3 py-2.5"><Checkbox checked={selectedIds.has(employee.id)} onChange={() => toggleSelected(employee.id)} label={`Chọn ${employee.name}`} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        {employee.avatarUrl
                          ? <img src={employee.avatarUrl} alt={employee.name} className="size-10 shrink-0 rounded-full object-cover" />
                          : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{employee.initials}</span>}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold leading-5 text-slate-900">{employee.name}</p>
                          <p className="truncate text-xs leading-5 text-slate-500">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <RoleIcon className={cn("size-4 shrink-0", style?.color ?? "text-slate-400")} strokeWidth={1.75} />
                        <span className="truncate">{employee.role}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {employee.channels.length > 0
                        ? <div className="flex items-center gap-[11px]">
                          {employee.channels.slice(0, 3).map((code) => <ChannelIcon key={code} code={code} />)}
                          {employee.channels.length > 3 && <span className="grid h-6 place-items-center rounded-md bg-[#f2f4fa] px-2 text-[13px] text-[#5a6a8e]">+{employee.channels.length - 3}</span>}
                        </div>
                        : employee.channel === "—"
                          ? <span className="block h-px w-3.5 bg-[#5a6a8e]" />
                          : <span className={cn("text-sm", MUTED)}>{employee.channel}</span>}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={employee.status} /></td>
                    <td className="px-3 py-2.5 text-sm tabular-nums text-slate-500">{employee.joined}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-500">
                      <span className="flex items-center gap-2">
                        <span className={cn("size-1.5 shrink-0 rounded-full", isRecent(employee.lastActiveAt) ? "bg-emerald-500" : "bg-slate-400")} />
                        {employee.lastActive}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" className={cn("h-8 px-3 text-xs", outlineBtn)} onClick={() => openEdit(employee)}>Chỉnh sửa</Button>
                        <Button
                          variant="outline"
                          aria-label="Thao tác khác"
                          aria-expanded={menu?.id === employee.id}
                          onClick={(event) => openMenu(event, employee.id)}
                          className={cn("size-8 rounded-xs border-slate-200 bg-white p-0 text-slate-600 shadow-none transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#243B53] focus-visible:ring-offset-2", menu?.id === employee.id && "border-slate-300 bg-slate-100 text-slate-900")}
                        >
                          <MoreHorizontal className="size-4" strokeWidth={1.75} />
                        </Button>
                      </div>
                    </td>
                  </tr>;
                })}
          </tbody>
        </table>
        </div>
      </AnimatedPanel>

      {/* ───────── PHÂN TRANG ───────── */}
      <AdminPagination
        count={filtered.length}
        page={currentPage}
        pageSize={pageSize}
        noun="nhân viên"
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </section>

    {/* ───────── MENU THAO TÁC ───────── */}
    {menu && menuEmployee && createPortal(
      <>
        <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
        <div role="menu" style={{ top: menu.top, left: menu.left }} className="fixed z-50 w-[180px] overflow-hidden rounded-xs border border-[#eceff5] bg-white py-1.5 shadow-[0_12px_32px_-8px_rgba(16,24,40,0.2)]">
          <MenuItem icon={Eye} label="Xem chi tiết" onClick={() => { setDetailEmployee(menuEmployee); setMenu(null); }} />
          <MenuItem icon={Pencil} label="Chỉnh sửa" onClick={() => openEdit(menuEmployee)} />
          {canManageRoles && <MenuItem icon={Users} label="Đổi vai trò" onClick={() => { setRoleEmployee(menuEmployee); setSelectedRoleCode(menuEmployee.roleCode || roleOptions[0]?.code || ""); setMenu(null); }} />}
          <MenuItem
            icon={menuEmployee.status === "locked" ? Unlock : Lock}
            label={menuEmployee.status === "active" ? "Tạm khóa" : menuEmployee.status === "locked" ? "Mở khóa" : "Đã nghỉ việc"}
            disabled={menuEmployee.status === "left" || actionId === menuEmployee.id}
            onClick={() => void updateStatus(menuEmployee)}
          />
          <MenuItem icon={KeyRound} label="Đặt lại mật khẩu" onClick={() => void resetPassword(menuEmployee)} />
          <MenuItem icon={Trash2} label="Xóa nhân viên" danger disabled={menuEmployee.status === "left" || actionId === menuEmployee.id} onClick={() => void retireEmployee(menuEmployee)} />
        </div>
      </>,
      document.body,
    )}

    <Dialog open={Boolean(editEmployee)} onOpenChange={(open) => { if (!open) setEditEmployee(null); }}>
      <DialogContent className="rounded-xs">
        <DialogHeader><DialogTitle>Chỉnh sửa nhân viên</DialogTitle><DialogDescription>Cập nhật thông tin hồ sơ nhân viên trong hệ thống.</DialogDescription></DialogHeader>
        <form onSubmit={saveEdit} className="space-y-3">
          <Input required placeholder="Họ và tên" value={editForm.full_name} onChange={(event) => setEditForm((current) => ({ ...current, full_name: event.target.value }))} />
          <Input required type="email" placeholder="Email công việc" value={editForm.work_email} onChange={(event) => setEditForm((current) => ({ ...current, work_email: event.target.value }))} />
          <Input placeholder="Số điện thoại" value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} />
          <DialogFooter><Button type="button" variant="outline" className={outlineBtn} onClick={() => setEditEmployee(null)}>Hủy</Button><Button type="submit" disabled={editSaving} className={primaryBtn}>{editSaving ? "Đang lưu..." : "Lưu thay đổi"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={dateOpen} onOpenChange={setDateOpen}>
      <DialogContent className="rounded-xs sm:max-w-md">
        <DialogHeader><DialogTitle>Lọc theo ngày tham gia</DialogTitle><DialogDescription>Chọn khoảng thời gian để lọc danh sách nhân viên.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-slate-700"><span>Từ ngày</span><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700"><span>Đến ngày</span><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        </div>
        <DialogFooter><Button variant="outline" className={outlineBtn} onClick={() => { setDateFrom(""); setDateTo(""); setDateOpen(false); }}>Xóa lọc</Button><Button className={primaryBtn} onClick={() => setDateOpen(false)}>Áp dụng</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(detailEmployee)} onOpenChange={(open) => { if (!open) setDetailEmployee(null); }}><DialogContent className="rounded-xs"><DialogHeader><DialogTitle>Chi tiết nhân viên</DialogTitle><DialogDescription>Thông tin được tải từ tài khoản nhân viên trong hệ thống.</DialogDescription></DialogHeader>{detailEmployee && <div className="space-y-4"><div className="flex items-center gap-3">{detailEmployee.avatarUrl ? <img src={detailEmployee.avatarUrl} alt={detailEmployee.name} className="size-14 rounded-full object-cover" /> : <span className="grid size-14 place-items-center rounded-full bg-slate-100 font-semibold text-slate-700">{detailEmployee.initials}</span>}<div><p className="font-semibold text-slate-900">{detailEmployee.name}</p><p className="text-sm text-slate-500">{detailEmployee.email}</p></div></div><div className="grid grid-cols-2 gap-3 text-sm"><Info label="Vai trò" value={detailEmployee.role} /><Info label="Trạng thái" value={statusLabel[detailEmployee.status]} /><Info label="Ngày tham gia" value={detailEmployee.joined} /><Info label="Hoạt động cuối" value={detailEmployee.lastActive} /></div></div>}</DialogContent></Dialog>
    <Dialog open={Boolean(roleEmployee)} onOpenChange={(open) => { if (!open) setRoleEmployee(null); }}><DialogContent className="rounded-xs"><DialogHeader><DialogTitle>Đổi vai trò</DialogTitle><DialogDescription>Vai trò mới sẽ được áp dụng ngay cho nhân viên.</DialogDescription></DialogHeader><select value={selectedRoleCode} onChange={(event) => setSelectedRoleCode(event.target.value)} className="h-9 rounded-xs border border-slate-200 bg-white px-3 text-sm focus:border-[#243B53] focus:outline-none focus:ring-1 focus:ring-[#243B53]">{roleOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><DialogFooter><Button variant="outline" className={outlineBtn} onClick={() => setRoleEmployee(null)}>Hủy</Button><Button onClick={() => void saveRole()} disabled={!selectedRoleCode || actionId === roleEmployee?.id} className={primaryBtn}>Lưu thay đổi</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="rounded-xs"><DialogHeader><DialogTitle>Thêm nhân viên</DialogTitle><DialogDescription>Tạo tài khoản và gán vai trò ngay từ trang phân quyền.</DialogDescription></DialogHeader><form onSubmit={createEmployee} className="space-y-3"><Input required className="h-9 rounded-xs" placeholder="Họ và tên" value={createForm.full_name} onChange={(event) => setCreateForm((current) => ({ ...current, full_name: event.target.value }))} /><Input required className="h-9 rounded-xs" type="email" placeholder="Email công việc" value={createForm.work_email} onChange={(event) => setCreateForm((current) => ({ ...current, work_email: event.target.value }))} /><Input className="h-9 rounded-xs" placeholder="Số điện thoại" value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} /><select value={createForm.role_code} onChange={(event) => setCreateForm((current) => ({ ...current, role_code: event.target.value }))} className="h-9 w-full rounded-xs border border-slate-200 bg-white px-3 text-sm focus:border-[#243B53] focus:outline-none focus:ring-1 focus:ring-[#243B53]">{roleOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><Input required minLength={8} className="h-9 rounded-xs" type="password" placeholder="Mật khẩu tạm thời" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} /><DialogFooter><Button type="button" variant="outline" className={outlineBtn} onClick={() => setCreateOpen(false)}>Hủy</Button><Button type="submit" disabled={createSaving} className={primaryBtn}>{createSaving ? "Đang tạo..." : "Tạo nhân viên"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}

/* ═════════════════════════ Thành phần nhỏ ═════════════════════════ */

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-medium text-slate-800">{value}</p></div>; }

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      style={checked ? { backgroundColor: BRAND, borderColor: BRAND } : undefined}
      className={cn("grid size-4 shrink-0 place-items-center rounded-xs border text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#243B53] focus-visible:ring-offset-2", !checked && "border-slate-300 bg-white")}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}

function StatCard({ icon: Icon, tone, active, onClick, value, label, note }: { icon: IconType; tone: keyof typeof metricTone; active: boolean; onClick: () => void; value: string; label: string; note: ReactNode }) {
  const colors = metricTone[tone];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("w-full rounded-xs border border-slate-200 border-t-2 p-4 text-left transition duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#243B53] focus-visible:ring-offset-2", colors.border, active && cn("ring-1", colors.selected))}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <Icon className={cn("size-4 shrink-0", colors.icon)} strokeWidth={1.75} />
      </div>
      <p className={cn("mt-2 text-2xl font-semibold leading-8 tracking-tight tabular-nums", colors.value)}>{value}</p>
      <div className="mt-2 min-h-5 text-xs leading-5 text-slate-500">{note}</div>
    </button>
  );
}

function FilterSelect({ value, options, onChange = () => undefined, className }: { value: string; options: string[]; onChange?: (value: string) => void; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full appearance-none rounded-xs border border-slate-200 bg-white pl-3.5 pr-10 text-sm text-slate-800 outline-none transition-colors focus:border-[#243B53] focus:ring-1 focus:ring-[#243B53]"
      >
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#0b0c24]" strokeWidth={1.75} />
    </div>
  );
}

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const tone = {
    active: { text: "text-emerald-700", bg: "border-emerald-200/80 bg-emerald-50", dot: "bg-emerald-500" },
    locked: { text: "text-amber-700", bg: "border-amber-200/80 bg-amber-50", dot: "bg-amber-500" },
    left: { text: "text-rose-700", bg: "border-rose-200/80 bg-rose-50", dot: "bg-rose-500" },
  }[status];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", tone.text, tone.bg)}>
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {statusLabel[status]}
    </span>
  );
}

function MenuItem({ icon: Icon, label, danger = false, disabled = false, onClick }: { icon: IconType; label: string; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn("flex h-9 w-full items-center gap-3 px-3 text-left text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#243B53] disabled:cursor-not-allowed disabled:opacity-50", danger ? "text-rose-700 hover:bg-rose-50" : "text-slate-700")}
    >
      <Icon className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
      {label}
    </button>
  );
}

/** Logo kênh bán hàng / mạng xã hội dạng ô vuông bo góc 24px (vẽ bằng CSS, không phụ thuộc icon thương hiệu). */
function ChannelIcon({ code }: { code: string }) {
  const base = "grid size-6 shrink-0 place-items-center rounded-md text-[13px] font-bold text-white";
  if (code.includes("insta")) {
    return (
      <span className={base} style={{ backgroundColor: "#c13584" }} title="Instagram">
        <span className="relative block size-3.5 rounded-[4px] border-[1.5px] border-white">
          <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-white" />
        </span>
      </span>
    );
  }
  if (code.includes("face")) return <span className={base} style={{ backgroundColor: "#1877f2" }} title="Facebook">f</span>;
  if (code.includes("tik")) return <span className={base} style={{ backgroundColor: "#000" }} title="TikTok"><Music2 className="size-4" strokeWidth={2} /></span>;
  if (code.includes("shopee")) return <span className={base} style={{ backgroundColor: "#ee4d2d" }} title="Shopee">S</span>;
  if (code.includes("web")) return <span className={cn(base, "rounded-full")} style={{ backgroundColor: "#243B53" }} title="Website"><Globe className="size-4" strokeWidth={1.75} /></span>;
  return <span className={cn(base, "bg-slate-400")} title={code}>{code.slice(0, 1).toUpperCase()}</span>;
}
