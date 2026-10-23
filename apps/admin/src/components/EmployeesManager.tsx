import { CalendarDays, ChevronDown, Clock3, MoreHorizontal, Plus, Search, UserRound, Users, UserRoundCheck, UserRoundX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adminErrorMessage } from "@/lib/admin-language";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type EmployeeStatus = "active" | "locked" | "left";
type Employee = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roleCode: string;
  role: string;
  channel: string;
  status: EmployeeStatus;
  joined: string;
  lastActive: string;
  initials: string;
};
type RoleOption = { code: string; name: string };

const statusFilters = ["Tất cả trạng thái", "Đang hoạt động", "Tạm khóa", "Đã nghỉ việc"];
const roleTone: Record<string, string> = { system_owner: "text-violet-600", ops_manager: "text-blue-600", content_editor: "text-pink-600", sales_staff: "text-orange-500", warehouse_staff: "text-blue-600" };
const statusLabel: Record<EmployeeStatus, string> = { active: "Đang hoạt động", locked: "Tạm khóa", left: "Đã nghỉ việc" };
const fallbackRoles: RoleOption[] = [
  { code: "system_owner", name: "Admin" },
  { code: "ops_manager", name: "Quản lý" },
  { code: "sales_staff", name: "Nhân viên bán hàng" },
  { code: "content_editor", name: "Nhân viên content" },
  { code: "warehouse_staff", name: "Nhân viên kho" },
];

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "NV"; }
function formatDate(value: string | null | undefined) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN"); }
function formatLastActive(value: string | null | undefined) { if (!value) return "Chưa đăng nhập"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Chưa đăng nhập" : date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function channelFor(roleCode: string) { if (roleCode === "system_owner" || roleCode === "ops_manager") return "Tất cả kênh"; if (roleCode === "sales_staff") return "Kênh bán hàng"; return "—"; }

function mapEmployee(item: Awaited<ReturnType<typeof adminApi.staff>>["items"][number]): Employee {
  const role = item.role;
  const status = item.status === "locked" || item.status === "left" ? item.status : "active";
  return { id: item.id, name: item.full_name, email: item.work_email ?? "", avatarUrl: item.avatar_url, roleCode: role?.role_code ?? "", role: role?.role_name ?? "Chưa gán vai trò", channel: channelFor(role?.role_code ?? ""), status, joined: formatDate(item.joined_on), lastActive: formatLastActive(item.last_login_at), initials: initials(item.full_name) };
}

export function EmployeesManager({ embedded = false, permissions = [] }: { embedded?: boolean; permissions?: string[] }) {
  const canManageRoles = permissions.includes("*") || permissions.includes("role.manage");
  const canStaffManage = permissions.includes("*") || permissions.includes("staff.manage");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>(fallbackRoles);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("Tất cả vai trò");
  const [status, setStatus] = useState(statusFilters[0]!);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [roleEmployee, setRoleEmployee] = useState<Employee | null>(null);
  const [selectedRoleCode, setSelectedRoleCode] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: "", work_email: "", phone: "", role_code: "ops_manager", password: "Trang1234@" });

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

  const roleFilters = useMemo(() => ["Tất cả vai trò", ...Array.from(new Set(employees.map((employee) => employee.role).filter(Boolean)))], [employees]);
  const filtered = useMemo(() => employees.filter((employee) => { const haystack = `${employee.name} ${employee.email} ${employee.role}`.toLowerCase(); return haystack.includes(query.toLowerCase()) && (role === "Tất cả vai trò" || employee.role === role) && (status === statusFilters[0] || statusLabel[employee.status] === status); }), [employees, query, role, status]);
  const stats = useMemo(() => ({ total: employees.length, active: employees.filter((employee) => employee.status === "active").length, locked: employees.filter((employee) => employee.status === "locked").length, left: employees.filter((employee) => employee.status === "left").length }), [employees]);

  const updateStatus = async (employee: Employee) => {
    if (employee.status === "left") return;
    const nextStatus: EmployeeStatus = employee.status === "active" ? "locked" : "active";
    setActionId(employee.id);
    try { await adminApi.updateStaff(employee.id, nextStatus); setEmployees((current) => current.map((item) => item.id === employee.id ? { ...item, status: nextStatus } : item)); toast.success(nextStatus === "locked" ? `Đã tạm khóa ${employee.name}` : `Đã mở khóa ${employee.name}`); }
    catch (err) { toast.error(err instanceof Error ? adminErrorMessage(err) : "Không cập nhật được trạng thái nhân viên"); }
    finally { setActionId(null); setOpenMenu(null); }
  };

  const saveRole = async () => {
    if (!canManageRoles || !roleEmployee || !selectedRoleCode) return;
    setActionId(roleEmployee.id);
    try { await adminApi.updateStaffRoles(roleEmployee.id, [selectedRoleCode]); const nextRole = roleOptions.find((item) => item.code === selectedRoleCode); setEmployees((current) => current.map((item) => item.id === roleEmployee.id ? { ...item, roleCode: selectedRoleCode, role: nextRole?.name ?? item.role, channel: channelFor(selectedRoleCode) } : item)); toast.success(`Đã đổi vai trò cho ${roleEmployee.name}`); setRoleEmployee(null); }
    catch (err) { toast.error(err instanceof Error ? adminErrorMessage(err) : "Không cập nhật được vai trò"); }
    finally { setActionId(null); }
  };

  const createEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setCreateSaving(true);
    try { const payload: Parameters<typeof adminApi.createStaff>[0] = { full_name: createForm.full_name, work_email: createForm.work_email, role_code: createForm.role_code, password: createForm.password }; if (createForm.phone) payload.phone = createForm.phone; await adminApi.createStaff(payload); toast.success("Đã thêm nhân viên mới"); setCreateOpen(false); setCreateForm((current) => ({ ...current, full_name: "", work_email: "", phone: "" })); await loadEmployees(); }
    catch (err) { toast.error(err instanceof Error ? adminErrorMessage(err) : "Không thể thêm nhân viên"); }
    finally { setCreateSaving(false); }
  };

  return <div className="space-y-5 pb-6">
    {!embedded && <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-4"><button type="button" className="mt-1 grid size-9 place-items-center rounded-lg border border-slate-200 text-xl text-slate-600 hover:bg-slate-50">←</button><div><h1 className="admin-page-title">Nhân viên</h1><p className="mt-1 text-sm text-slate-500">Quản lý tài khoản nhân viên, vai trò và quyền truy cập vào hệ thống ÉLANE.</p></div></div><div className="flex gap-2"><Button variant="outline" className="h-10 rounded-lg"><Clock3 className="mr-2 size-4" /> Nhật ký hoạt động</Button>{canStaffManage && <Button onClick={() => setCreateOpen(true)} className="h-10 rounded-lg bg-violet-600 hover:bg-violet-700"><Plus className="mr-2 size-4" /> Thêm nhân viên</Button>}</div></div>}
    {embedded && canStaffManage && <div className="flex justify-end"><Button onClick={() => setCreateOpen(true)} className="h-10 rounded-lg bg-violet-600 hover:bg-violet-700"><Plus className="mr-2 size-4" /> Thêm nhân viên</Button></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={Users} value={String(stats.total)} label="Tổng nhân viên" note="Dữ liệu từ hệ thống" tone="purple" /><StatCard icon={UserRoundCheck} value={String(stats.active)} label="Đang hoạt động" note={stats.total ? `${Math.round(stats.active / stats.total * 100)}% tổng nhân viên` : "0% tổng nhân viên"} tone="green" /><StatCard icon={UserRound} value={String(stats.locked)} label="Tạm khóa" note={stats.total ? `${Math.round(stats.locked / stats.total * 100)}% tổng nhân viên` : "0% tổng nhân viên"} tone="slate" /><StatCard icon={UserRoundX} value={String(stats.left)} label="Đã nghỉ việc" note={stats.total ? `${Math.round(stats.left / stats.total * 100)}% tổng nhân viên` : "0% tổng nhân viên"} tone="red" /></div>
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"><div className="flex flex-wrap gap-3 border-b border-slate-100 p-4"><div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm theo tên, email, mã nhân viên..." className="h-10 pl-9" /></div><FilterSelect value={role} options={roleFilters} onChange={setRole} /><FilterSelect value={status} options={statusFilters} onChange={setStatus} /><FilterSelect value="Tất cả kênh" options={["Tất cả kênh", "Instagram", "Facebook", "TikTok", "Shopee", "Website"]} /><Button variant="outline" className="h-10 min-w-[170px] justify-between rounded-lg font-normal text-slate-500"><CalendarDays className="size-4" /> Chọn khoảng thời gian <ChevronDown className="size-4" /></Button></div>{error && <div className="m-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error} <button type="button" className="ml-2 font-semibold underline" onClick={() => void loadEmployees()}>Thử lại</button></div>}<div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead className="bg-slate-50/70 text-xs text-slate-500"><tr><th className="w-10 px-4 py-3"><input type="checkbox" className="size-4 accent-violet-600" aria-label="Chọn tất cả" /></th><th className="px-3 py-3 text-left font-semibold">Nhân viên</th><th className="px-3 py-3 text-left font-semibold">Vai trò</th><th className="px-3 py-3 text-left font-semibold">Kênh phụ trách</th><th className="px-3 py-3 text-left font-semibold">Trạng thái</th><th className="px-3 py-3 text-left font-semibold">Ngày tham gia</th><th className="px-3 py-3 text-left font-semibold">Hoạt động cuối</th><th className="px-3 py-3 text-left font-semibold">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">Đang tải danh sách nhân viên...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">Không tìm thấy nhân viên phù hợp.</td></tr> : filtered.map((employee) => <tr key={employee.id} className="hover:bg-slate-50/70"><td className="px-4 py-3"><input type="checkbox" className="size-4 accent-violet-600" aria-label={`Chọn ${employee.name}`} /></td><td className="px-3 py-3"><div className="flex items-center gap-3">{employee.avatarUrl ? <img src={employee.avatarUrl} alt={employee.name} className="size-10 rounded-full object-cover" /> : <span className="grid size-10 place-items-center rounded-full bg-violet-50 text-xs font-semibold text-violet-600">{employee.initials}</span>}<div><p className="font-semibold text-slate-800">{employee.name}</p><p className="text-xs text-slate-500">{employee.email}</p></div></div></td><td className={cn("px-3 py-3 font-medium", roleTone[employee.roleCode] ?? "text-slate-600")}>{employee.role}</td><td className="max-w-[180px] px-3 py-3 text-xs text-slate-500">{employee.channel}</td><td className="px-3 py-3"><StatusBadge status={employee.status} /></td><td className="px-3 py-3 text-slate-500">{employee.joined}</td><td className="px-3 py-3 text-slate-500"><span className={cn("mr-2 inline-block size-2 rounded-full", employee.status === "active" ? "bg-emerald-500" : "bg-slate-400")} />{employee.lastActive}</td><td className="relative px-3 py-3"><div className="flex items-center gap-2"><Button variant="outline" size="sm" className="rounded-lg" onClick={() => setDetailEmployee(employee)}>Xem chi tiết</Button><Button variant="outline" size="icon" className="size-9 rounded-lg" onClick={() => setOpenMenu(openMenu === employee.id ? null : employee.id)}><MoreHorizontal className="size-4" /></Button></div>{openMenu === employee.id && <div className="absolute right-3 top-12 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"><MenuItem label="Xem chi tiết" onClick={() => { setDetailEmployee(employee); setOpenMenu(null); }} /><MenuItem label="Đổi vai trò" onClick={() => { setRoleEmployee(employee); setSelectedRoleCode(employee.roleCode || roleOptions[0]?.code || ""); setOpenMenu(null); }} /><MenuItem label={employee.status === "active" ? "Tạm khóa" : employee.status === "locked" ? "Mở khóa" : "Đã nghỉ việc"} disabled={employee.status === "left" || actionId === employee.id} onClick={() => void updateStatus(employee)} /><MenuItem label="Đặt lại mật khẩu" onClick={() => toast.message("Tính năng đặt lại mật khẩu sẽ được bổ sung trong bước tiếp theo.")} /><MenuItem label="Xóa nhân viên" danger onClick={() => toast.message("Xóa nhân viên cần được xác nhận trong quy trình quản trị.")} /></div>}</td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500"><span>Hiển thị {filtered.length ? 1 : 0} - {filtered.length} trong tổng {employees.length} nhân viên</span><div className="flex items-center gap-2"><span>Số dòng mỗi trang</span><Button variant="outline" size="sm" className="rounded-lg">10 <ChevronDown className="ml-2 size-3" /></Button><Button variant="outline" size="icon" className="size-9 rounded-full">‹</Button><Button size="icon" className="size-9 rounded-full bg-violet-600">1</Button><Button variant="outline" size="icon" className="size-9 rounded-full">2</Button><Button variant="outline" size="icon" className="size-9 rounded-full">›</Button></div></div></section>
    <Dialog open={Boolean(detailEmployee)} onOpenChange={(open) => { if (!open) setDetailEmployee(null); }}><DialogContent><DialogHeader><DialogTitle>Chi tiết nhân viên</DialogTitle><DialogDescription>Thông tin được tải từ tài khoản nhân viên trong hệ thống.</DialogDescription></DialogHeader>{detailEmployee && <div className="space-y-4"><div className="flex items-center gap-3">{detailEmployee.avatarUrl ? <img src={detailEmployee.avatarUrl} alt={detailEmployee.name} className="size-14 rounded-full object-cover" /> : <span className="grid size-14 place-items-center rounded-full bg-violet-50 font-semibold text-violet-600">{detailEmployee.initials}</span>}<div><p className="font-semibold text-slate-900">{detailEmployee.name}</p><p className="text-sm text-slate-500">{detailEmployee.email}</p></div></div><div className="grid grid-cols-2 gap-3 text-sm"><Info label="Vai trò" value={detailEmployee.role} /><Info label="Trạng thái" value={statusLabel[detailEmployee.status]} /><Info label="Ngày tham gia" value={detailEmployee.joined} /><Info label="Hoạt động cuối" value={detailEmployee.lastActive} /></div></div>}</DialogContent></Dialog>
    <Dialog open={Boolean(roleEmployee)} onOpenChange={(open) => { if (!open) setRoleEmployee(null); }}><DialogContent><DialogHeader><DialogTitle>Đổi vai trò</DialogTitle><DialogDescription>Vai trò mới sẽ được áp dụng ngay cho nhân viên.</DialogDescription></DialogHeader><select value={selectedRoleCode} onChange={(event) => setSelectedRoleCode(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">{roleOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><DialogFooter><Button variant="outline" onClick={() => setRoleEmployee(null)}>Hủy</Button><Button onClick={() => void saveRole()} disabled={!selectedRoleCode || actionId === roleEmployee?.id} className="bg-violet-600 hover:bg-violet-700">Lưu thay đổi</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Thêm nhân viên</DialogTitle><DialogDescription>Tạo tài khoản và gán vai trò ngay từ trang phân quyền.</DialogDescription></DialogHeader><form onSubmit={createEmployee} className="space-y-3"><Input required placeholder="Họ và tên" value={createForm.full_name} onChange={(event) => setCreateForm((current) => ({ ...current, full_name: event.target.value }))} /><Input required type="email" placeholder="Email công việc" value={createForm.work_email} onChange={(event) => setCreateForm((current) => ({ ...current, work_email: event.target.value }))} /><Input placeholder="Số điện thoại" value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} /><select value={createForm.role_code} onChange={(event) => setCreateForm((current) => ({ ...current, role_code: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{roleOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><Input required minLength={8} type="password" placeholder="Mật khẩu tạm thời" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} /><DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button><Button type="submit" disabled={createSaving} className="bg-violet-600 hover:bg-violet-700">{createSaving ? "Đang tạo..." : "Tạo nhân viên"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-medium text-slate-800">{value}</p></div>; }
function StatCard({ icon: Icon, value, label, note, tone }: { icon: typeof Users; value: string; label: string; note: string; tone: "purple" | "green" | "slate" | "red" }) { const colors = { purple: "bg-violet-100 text-violet-600", green: "bg-emerald-100 text-emerald-600", slate: "bg-slate-100 text-slate-500", red: "bg-red-100 text-red-500" }; return <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center gap-4"><span className={cn("grid size-11 place-items-center rounded-xl", colors[tone])}><Icon className="size-6" /></span><div><p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p><p className="text-sm text-slate-500">{label}</p></div></div><p className="mt-4 text-xs font-medium text-slate-500">{note}</p></div>; }
function FilterSelect({ value, options, onChange = () => undefined }: { value: string; options: string[]; onChange?: (value: string) => void }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-[155px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400">{options.map((option) => <option key={option}>{option}</option>)}</select>; }
function StatusBadge({ status }: { status: EmployeeStatus }) { const styles = status === "active" ? "bg-emerald-50 text-emerald-600" : status === "locked" ? "bg-orange-50 text-orange-600" : "bg-red-50 text-red-600"; return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", styles)}><span className={cn("size-2 rounded-full", status === "active" ? "bg-emerald-500" : status === "locked" ? "bg-orange-500" : "bg-red-500")} />{statusLabel[status]}</span>; }
function MenuItem({ label, danger = false, disabled = false, onClick }: { label: string; danger?: boolean; disabled?: boolean; onClick: () => void }) { return <button type="button" disabled={disabled} onClick={onClick} className={cn("flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50", danger ? "text-red-600" : "text-slate-700")}>{label}</button>; }
