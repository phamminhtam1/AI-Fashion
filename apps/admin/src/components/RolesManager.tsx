import {
  ArrowLeft,
  Box,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Crown,
  FileText,
  Gift,
  Home,
  MoreHorizontal,
  PenLine,
  Pencil,
  PieChart,
  Plus,
  RotateCw,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmployeesManager } from "@/components/EmployeesManager";
import { adminApi } from "@/lib/api";

/* ═════════════════════════ Design tokens (đo từ design) ═════════════════════════ */

const BRAND = "#693ae5"; // nút chính
const BRAND_HOVER = "#5b2fd0";
const ACCENT = "#5f2ee3"; // checkbox, chữ active, link

const INK = "text-[#0b0c24]"; // tiêu đề / chữ đậm
const BODY = "text-[#3a4d72]"; // chữ nội dung (nhãn quyền, menu)
const MUTED = "text-[#5a6a8e]"; // mô tả
const LINE = "border-[#eceff5]";

const panel = "rounded-xl border border-[#eceff5] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const outlineBtn = "rounded-lg border-[#e5e8f0] bg-white font-medium text-[#0b0c24] shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-slate-50";
const inputCls = "rounded-lg border-[#e5e8f0] bg-white pl-9 text-sm shadow-none placeholder:text-[#8a97b3]";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

/* ═════════════════════════ Dữ liệu ═════════════════════════ */

type Tone = "purple" | "blue";
type PermissionItem = { id: string; code: string; description: string };
type PermissionDependencyPrompt = {
  roleId: string;
  permissionCode: string;
  permissionLabel: string;
  required: PermissionItem[];
  nextCodes: string[];
};

type Role = {
  id: string;
  code: string;
  name: string;
  description: string;
  longDescription?: string;
  members: number;
  tone: Tone;
  icon: IconType;
  /** Icon to ở thẻ vai trò có tô đặc (fill) hay chỉ viền. */
  filled?: boolean;
  system?: boolean;
  createdAt: string;
  updatedAt: string;
};

const roles: Role[] = [
  { id: "admin", code: "system_owner", name: "Admin", description: "Toàn quyền quản trị hệ thống.", longDescription: "Toàn quyền quản trị hệ thống, bao gồm tất cả các chức năng.", members: 3, tone: "purple", icon: Crown, filled: true, system: true, createdAt: "01/01/2024 10:00", updatedAt: "15/06/2024 14:30" },
  { id: "manager", code: "ops_manager", name: "Quản lý", description: "Quản lý vận hành, đơn hàng, nội dung.", members: 5, tone: "blue", icon: UserCog, createdAt: "01/01/2024 10:00", updatedAt: "15/06/2024 14:30" },
  { id: "sales", code: "sales_staff", name: "Nhân viên bán hàng", description: "Tạo đơn, quản lý khách hàng, tư vấn.", members: 8, tone: "blue", icon: ShoppingCart, filled: true, createdAt: "02/01/2024 09:30", updatedAt: "12/06/2024 11:20" },
  { id: "content", code: "content_editor", name: "Nhân viên content", description: "Tạo và quản lý nội dung.", members: 4, tone: "purple", icon: PenLine, createdAt: "02/01/2024 09:30", updatedAt: "10/06/2024 16:10" },
  { id: "warehouse", code: "warehouse_staff", name: "Nhân viên kho", description: "Quản lý tồn kho, kiểm hàng.", members: 3, tone: "blue", icon: Box, filled: true, createdAt: "03/01/2024 08:30", updatedAt: "14/06/2024 09:45" },
];

const permissionGroupMeta: Array<{ id: string; title: string; description: string; icon: IconType; filled?: boolean; codes: string[] }> = [
  { id: "overview", title: "Tổng quan", description: "Truy cập dashboard và số liệu tổng quan.", icon: Home, filled: true, codes: ["dashboard.read", "audit.read"] },
  { id: "reports", title: "Báo cáo", description: "Xem và xuất các báo cáo vận hành.", icon: PieChart, codes: ["report.read", "report.export"] },
  { id: "products", title: "Sản phẩm", description: "Quản lý danh mục và thông tin sản phẩm.", icon: Box, filled: true, codes: ["product.read", "product.write", "product.publish", "product.delete", "price.write", "cost.read", "category.read", "category.write"] },
  { id: "orders", title: "Đơn hàng", description: "Quản lý đơn hàng và xử lý giao vận.", icon: FileText, codes: ["order.read", "order.write", "order.customer.read", "order.update", "order.cancel", "order.export"] },
  { id: "customers", title: "Khách hàng", description: "Quản lý hồ sơ và chăm sóc khách hàng.", icon: Users, codes: ["customer.read", "customer.write"] },
  { id: "inventory", title: "Kho hàng", description: "Nhập, xuất và điều chỉnh tồn kho.", icon: Box, filled: true, codes: ["inventory.read", "inventory.receive", "inventory.issue", "inventory.adjust.request", "inventory.adjust.approve"] },
  { id: "content", title: "Content Studio", description: "Tạo, chỉnh sửa và xuất bản nội dung.", icon: PenLine, codes: ["content.read", "content.write", "content.publish"] },
  { id: "sales", title: "Kênh bán hàng", description: "Quản lý kết nối và nội dung trên các kênh bán hàng.", icon: Users, codes: ["channel.read", "channel.write", "channel.publish"] },
  { id: "promotions", title: "Khuyến mãi", description: "Quản lý mã giảm giá và chương trình ưu đãi.", icon: Gift, codes: ["promotion.read", "promotion.write"] },
  { id: "staff", title: "Nhân sự & vai trò", description: "Quản lý thành viên và cấu hình quyền.", icon: UserCog, codes: ["staff.manage", "role.manage"] },
  { id: "settings", title: "Cài đặt", description: "Quản lý cấu hình hệ thống.", icon: Settings, codes: ["settings.read", "settings.write"] },
];

const permissionLabelByCode: Record<string, string> = {
  "dashboard.read": "Xem dashboard", "report.read": "Xem báo cáo tổng quan", "report.export": "Xuất báo cáo", "audit.read": "Xem nhật ký hoạt động",
  "product.read": "Xem danh sách sản phẩm", "product.write": "Chỉnh sửa sản phẩm", "product.publish": "Xuất bản sản phẩm", "product.delete": "Xóa sản phẩm", "price.write": "Quản lý giá", "cost.read": "Xem giá vốn", "category.read": "Xem danh mục", "category.write": "Quản lý danh mục",
  "order.read": "Xem danh sách đơn hàng", "order.write": "Tạo đơn hàng", "order.customer.read": "Tìm và chọn khách hàng khi tạo đơn", "order.update": "Cập nhật trạng thái đơn hàng", "order.cancel": "Hủy đơn hàng", "order.export": "Xuất danh sách đơn hàng",
  "customer.read": "Xem khách hàng", "customer.write": "Sửa khách hàng", "inventory.read": "Xem tồn kho", "inventory.receive": "Nhập kho", "inventory.issue": "Xuất kho", "inventory.adjust.request": "Yêu cầu điều chỉnh kho", "inventory.adjust.approve": "Duyệt điều chỉnh kho",
  "content.read": "Xem nội dung", "content.write": "Chỉnh sửa nội dung", "content.publish": "Xuất bản nội dung", "channel.read": "Xem kênh bán hàng", "channel.write": "Quản lý kênh bán hàng", "channel.publish": "Xuất bản lên kênh bán hàng", "promotion.read": "Xem mã giảm giá", "promotion.write": "Sửa mã giảm giá", "staff.manage": "Quản lý nhân viên", "role.manage": "Quản lý vai trò", "settings.read": "Xem cài đặt", "settings.write": "Chỉnh sửa cài đặt",
};

const fallbackPermissionCatalog: PermissionItem[] = permissionGroupMeta.flatMap((group) => group.codes.map((code) => ({ id: code, code, description: permissionLabelByCode[code] ?? code })));

const members = [
  { name: "Sophia Carter", email: "sophia@elane.vn", initials: "SC", owner: true, color: "bg-amber-100 text-amber-700", avatarUrl: null as string | null },
  { name: "James Wilson", email: "james@elane.vn", initials: "JW", color: "bg-sky-100 text-sky-700", avatarUrl: null as string | null },
  { name: "Emily Nguyen", email: "emily@elane.vn", initials: "EN", color: "bg-rose-100 text-rose-700", avatarUrl: null as string | null },
];

type NavItem = {
  id: string;
  targetId?: string;
  label: string;
  icon: IconType;
  filled?: boolean;
  chevron?: boolean;
  children?: string[];
  /** Các mục sau nhóm "Kênh bán hàng" có chiều cao lớn hơn trong design. */
  tall?: boolean;
};

const navItems: NavItem[] = [
  { id: "overview", label: "Tổng quan", icon: Home, filled: true },
  { id: "products", label: "Sản phẩm", icon: Tag, filled: true },
  { id: "orders", label: "Đơn hàng", icon: FileText },
  { id: "customers", label: "Khách hàng", icon: Users, filled: true },
  { id: "sales", label: "Kênh bán hàng", icon: Users, filled: true, children: ["Facebook", "TikTok Shop", "Shopee", "Website", "Zalo OA"] },
  { id: "content", label: "Content Studio", icon: PenLine, tall: true },
  { id: "warehouse", targetId: "inventory", label: "Kho hàng", icon: Box, filled: true, chevron: true, tall: true },
  { id: "reports", targetId: "reports", label: "Báo cáo", icon: Store, filled: true, chevron: true, tall: true },
  { id: "promotions", label: "Khuyến mãi", icon: Gift, chevron: true, tall: true },
  { id: "settings", label: "Cài đặt", icon: Settings, tall: true },
];

const toneIcon: Record<Tone, string> = {
  purple: "text-[#693ae5]",
  blue: "text-[#2f7bff]",
};

/** Màu icon + nền ở khối "Thông tin vai trò" (Admin dùng vương miện cam). */
function detailStyle(role: Role) {
  if (role.id === "admin") return { fg: "text-[#f5a524]", bg: "bg-[#fff8ef]" };
  return role.tone === "purple"
    ? { fg: "text-[#693ae5]", bg: "bg-[#f6f4fe]" }
    : { fg: "text-[#2f7bff]", bg: "bg-[#f0f6ff]" };
}

/* ═════════════════════════ Thành phần nhỏ ═════════════════════════ */

function Checkbox({ checked, onChange, label, large = false }: { checked: boolean; onChange: () => void; label: string; large?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      style={checked ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
      className={cn(
        "grid shrink-0 place-items-center rounded-[5px] border text-white transition-colors",
        large ? "size-5" : "size-[18px]",
        !checked && "border-[#cdd3e1] bg-white",
      )}
    >
      {checked && <Check className={large ? "size-3.5" : "size-3"} strokeWidth={3} />}
    </button>
  );
}

/** Nút "···" vuông nhỏ, nền trắng, viền nhạt. */
function DotsBox({ className }: { className?: string }) {
  return (
    <span className={cn("grid place-items-center rounded-md border border-[#eceff5] bg-white text-[#0b0c24] shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>
      <MoreHorizontal className="size-3.5" />
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: IconType; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[46px_minmax(0,1fr)] items-start">
      <Icon className="ml-[9px] mt-0.5 size-4 text-[#66769a]" strokeWidth={1.75} />
      <div>
        <p className={cn("text-[13px] leading-4", MUTED)}>{label}</p>
        <p className="mt-1 text-sm font-medium leading-5 text-[#43557c]">{value}</p>
      </div>
    </div>
  );
}

/* ═════════════════════════ Trang ═════════════════════════ */

export function RolesManager({ permissions = [], onPermissionsChanged }: { permissions?: string[]; onPermissionsChanged?: () => Promise<void> | void }) {
  const canRoleManage = permissions.includes("*") || permissions.includes("role.manage");
  const canStaffManage = permissions.includes("*") || permissions.includes("staff.manage");
  const [selectedId, setSelectedId] = useState("admin");
  const [roleItems, setRoleItems] = useState<Role[]>(roles);
  const [activeTab, setActiveTab] = useState<"roles" | "employees">(canRoleManage ? "roles" : "employees");
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sales: true });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const permissionGroupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    () => new Set(members.filter((m) => m.owner).map((m) => m.email)),
  );
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionItem[]>(fallbackPermissionCatalog);
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [roleMembers, setRoleMembers] = useState<typeof members>(members);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [dependencyPrompt, setDependencyPrompt] = useState<PermissionDependencyPrompt | null>(null);
  const permissionCodesRef = useRef<string[]>([]);
  const permissionSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestPermissionRequestRef = useRef(0);

  useEffect(() => {
    if (!canRoleManage) return;
    void adminApi.permissions().then((response) => {
      if (response.items.length) setPermissionCatalog(response.items);
    }).catch(() => undefined);
    void adminApi.roles().then((response) => {
      const next = response.items.map((item) => {
        const fallback = roles.find((role) => role.code === item.code) ?? roles[0]!;
        return { ...fallback, id: item.id, code: item.code, name: item.name, description: item.description, members: item.members, system: item.is_system, createdAt: new Date(item.created_at).toLocaleString("vi-VN"), updatedAt: new Date(item.updated_at).toLocaleString("vi-VN") };
      });
      if (next.length) {
        setRoleItems(next);
        setSelectedId((current) => next.find((role) => role.code === "system_owner")?.id ?? current);
      }
    }).catch(() => undefined);
  }, [canRoleManage]);

  useEffect(() => {
    if (!canRoleManage) return;
    const selectedRole = roleItems.find((role) => role.id === selectedId);
    if (!selectedRole || selectedRole.id === "admin") return;
    void adminApi.role(selectedRole.id).then((detail) => {
      const codes = detail.permissions.map((permission) => permission.code);
      setPermissionCodes(codes);
      permissionCodesRef.current = codes;
      setRoleMembers(detail.members.map((member, index) => ({ name: String(member.full_name ?? ""), email: String(member.work_email ?? ""), initials: String(member.full_name ?? "").split(/\s+/).slice(-2).map((word) => word[0]).join("").toUpperCase(), avatarUrl: typeof member.avatar_url === "string" ? member.avatar_url : null, owner: index === 0 && selectedRole.code === "system_owner", color: index % 2 ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700" })));
    }).catch(() => undefined);
  }, [canRoleManage, permissionCatalog, roleItems, selectedId]);

  useEffect(() => {
    if (!canRoleManage && canStaffManage) setActiveTab("employees");
    if (canRoleManage && !canStaffManage) setActiveTab("roles");
  }, [canRoleManage, canStaffManage]);

  const selected = roleItems.find((role) => role.id === selectedId) ?? roleItems[0]!;
  const selectedDetail = detailStyle(selected);
  const SelectedIcon = selected.icon;
  const filteredRoles = useMemo(
    () => roleItems.filter((role) => role.name.toLowerCase().includes(query.toLowerCase())),
    [query, roleItems],
  );

  const allChecked = permissionCatalog.length > 0 && permissionCatalog.every((permission) => permissionCodes.includes(permission.code));
  const visiblePermissionGroups = activeSection === "overview"
    ? permissionGroupMeta.filter((group) => ["overview", "products", "orders"].includes(group.id))
    : permissionGroupMeta.filter((group) => group.id === activeSection);

  const persistPermissionCodes = (roleId: string, nextCodes: string[]) => {
    const requestId = ++latestPermissionRequestRef.current;
    permissionCodesRef.current = nextCodes;
    setPermissionCodes(nextCodes);
    setPermissionSaving(true);

    const save = async () => {
      try {
        const response = await adminApi.updateRolePermissions(roleId, nextCodes);
        if (requestId !== latestPermissionRequestRef.current) return;
        permissionCodesRef.current = response.permission_codes;
        setPermissionCodes(response.permission_codes);
        await onPermissionsChanged?.();
      } catch {
        if (requestId !== latestPermissionRequestRef.current) return;
        toast.error("Không lưu được quyền. Đang tải lại quyền từ hệ thống.");
        try {
          const detail = await adminApi.role(roleId);
          const codes = detail.permissions.map((permission) => permission.code);
          permissionCodesRef.current = codes;
          setPermissionCodes(codes);
        } catch {
          // Keep the last confirmed state if the recovery request also fails.
        }
      } finally {
        if (requestId === latestPermissionRequestRef.current) setPermissionSaving(false);
      }
    };

    permissionSaveQueueRef.current = permissionSaveQueueRef.current.then(save, save);
  };

  const togglePermission = (groupId: string, code: string) => {
    const group = permissionGroupMeta.find((item) => item.id === groupId);
    if (!group || !code || selected.id === "admin") return;
    const currentCodes = permissionCodesRef.current;
    if (code === "order.customer.read" && currentCodes.includes("order.write")) {
      toast.error("Muốn tắt quyền này, hãy tắt Tạo đơn hàng trước");
      return;
    }
    const turningOn = !currentCodes.includes(code);
    if (turningOn && code === "order.write" && !currentCodes.includes("order.customer.read")) {
      const dependency = permissionCatalog.find((permission) => permission.code === "order.customer.read")
        ?? { id: "order.customer.read", code: "order.customer.read", description: permissionLabelByCode["order.customer.read"] };
      setDependencyPrompt({
        roleId: selected.id,
        permissionCode: code,
        permissionLabel: permissionLabelByCode[code] ?? code,
        required: [dependency],
        nextCodes: [...currentCodes, code, dependency.code],
      });
      return;
    }
    const nextCodes = turningOn ? [...currentCodes, code] : currentCodes.filter((item) => item !== code);
    persistPermissionCodes(selected.id, nextCodes);
  };

  const toggleAll = () => {
    if (selected.id === "admin") return;
    const currentCodes = permissionCodesRef.current;
    const next = !permissionCatalog.every((permission) => currentCodes.includes(permission.code));
    const visibleCodes = permissionCatalog.map((permission) => permission.code);
    const nextCodes = [...currentCodes.filter((code) => !visibleCodes.includes(code)), ...(next ? visibleCodes : [])];
    persistPermissionCodes(selected.id, nextCodes);
  };

  const toggleMember = (email: string) => {
    setSelectedMembers((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const activateSection = (sectionId: string) => {
    setActiveSection(sectionId);
    window.requestAnimationFrame(() => permissionGroupRefs.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="space-y-[18px] pb-6">
      {/* ───────── HEADER ───────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-[23px]">
          <button type="button" className="ml-2.5 mt-[9px] grid size-[18px] place-items-center text-[#0b0c24] hover:opacity-70" aria-label="Quay lại">
            <ArrowLeft className="size-[18px]" strokeWidth={1.75} />
          </button>
          <div>
            <h1 className="text-3xl font-bold leading-9 tracking-tight text-[#00000b]">Phân quyền</h1>
            <p className={cn("mt-1 text-sm", MUTED)}>Quản lý vai trò và quyền truy cập của nhân viên trong hệ thống ÉLANE.</p>
          </div>
        </div>
        <div className="mt-1.5 flex gap-3">
          <Button variant="outline" className={cn("h-10 gap-2 px-4 text-sm", outlineBtn)}>
            <Clock className="size-[18px]" strokeWidth={1.75} /> Nhật ký phân quyền
          </Button>
          {canRoleManage && <Button
              style={{ backgroundColor: BRAND }}
              className="h-10 gap-2 rounded-lg px-4 text-sm font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] hover:opacity-90"
            >
              <Plus className="size-[18px]" strokeWidth={1.75} /> Tạo vai trò mới
            </Button>}
        </div>
      </div>

      {/* ───────── TABS ───────── */}
      <div className={cn("mb-1 flex border-b pt-[13px]", LINE)}>
        {([...(canRoleManage ? [["roles", "Vai trò"]] as const : []), ...(canStaffManage ? [["employees", "Nhân viên"]] as const : [])] as const).map(([id, label]) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              style={active ? { color: ACCENT, borderColor: ACCENT } : undefined}
              className={cn(
                "-mb-px border-b-2 px-[30px] pb-2.5 pt-3 text-sm transition-colors",
                active ? "font-semibold" : "border-transparent font-medium text-[#0b0c24] hover:text-slate-600",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "employees" && canStaffManage ? <EmployeesManager embedded permissions={permissions} /> : canRoleManage ? <>
        {/* ───────── DANH SÁCH VAI TRÒ ───────── */}
        <section className={cn(panel, "p-[19px]")}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={cn("text-[17px] font-semibold leading-6", INK)}>Vai trò ({roleItems.length})</h2>
              <p className={cn("text-sm leading-5", MUTED)}>Tạo và quản lý các vai trò, phân quyền truy cập hệ thống.</p>
            </div>
            <div className="relative -mt-1 w-[267px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#66769a]" strokeWidth={1.75} />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm vai trò..." className={cn("h-[38px]", inputCls)} />
            </div>
          </div>

          <div className="mt-[15px] grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            {filteredRoles.map((role) => {
              const RoleIcon = role.icon;
              const isSelected = selectedId === role.id;
              return (
                <div
                  key={role.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(role.id)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(role.id); } }}
                  className={cn(
                    "relative flex min-h-[121px] cursor-pointer gap-[18px] rounded-lg border py-[18px] pl-[19px] pr-3.5 text-left transition hover:border-violet-300",
                    isSelected ? "border-violet-300 bg-[#f6f4fe]" : "border-[#e8ebf2] bg-white",
                  )}
                >
                  <span className="mt-2.5 grid size-10 shrink-0 place-items-center">
                    <RoleIcon className={cn("size-7", toneIcon[role.tone], role.filled && "fill-current")} strokeWidth={1.75} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className={cn("truncate pr-7 text-sm font-semibold leading-5", INK)}>{role.name}</p>
                    <p className={cn("mt-1.5 line-clamp-2 text-[12.5px] leading-[17px]", MUTED)}>{role.description}</p>
                    <p className={cn("mt-auto pt-2.5 text-[12.5px] leading-4", MUTED)}>{role.members} nhân viên</p>
                  </div>
                  <DotsBox className="absolute right-3.5 top-4 size-[22px]" />
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,472fr)_minmax(0,910fr)]">
          {/* ───────── THÔNG TIN VAI TRÒ ───────── */}
          <section className={cn(panel, "p-5")}>
            <div className="flex items-start justify-between gap-3">
              <h2 className={cn("pt-1 text-[17px] font-semibold leading-6", INK)}>Thông tin vai trò</h2>
              <Button variant="outline" className={cn("h-9 gap-2 px-4 text-[13px] font-medium", outlineBtn)} style={{ color: ACCENT }}>
                <Pencil className="size-4" strokeWidth={1.75} /> Chỉnh sửa
              </Button>
            </div>

            <div className="mt-3 flex items-start gap-5">
              <span className={cn("grid size-14 shrink-0 place-items-center rounded-xl", selectedDetail.bg)}>
                <SelectedIcon className={cn("size-8", selectedDetail.fg, selected.filled && "fill-current")} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 className={cn("text-[17px] font-semibold leading-[26px]", INK)}>{selected.name}</h3>
                <p className={cn("mt-0.5 text-sm leading-5", MUTED)}>{selected.longDescription ?? selected.description}</p>
              </div>
            </div>

            <div className={cn("mt-[18px] space-y-[14px] border-b pb-11", LINE)}>
              <InfoRow icon={Users} label="Số nhân viên" value={String(selected.members)} />
              <InfoRow icon={Calendar} label="Ngày tạo" value={selected.createdAt} />
              <InfoRow icon={PieChart} label="Cập nhật lần cuối" value={selected.updatedAt} />
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <h3 className={cn("text-[17px] font-semibold leading-6", INK)}>Nhân viên thuộc vai trò ({selected.members})</h3>
              <Button variant="outline" className={cn("h-9 gap-2 px-4 text-[13px] font-medium", outlineBtn)} style={{ color: ACCENT }}>
                <Plus className="size-4" strokeWidth={1.75} /> Thêm nhân viên
              </Button>
            </div>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#66769a]" strokeWidth={1.75} />
              <Input placeholder="Tìm kiếm nhân viên..." className={cn("h-9", inputCls)} />
            </div>

            <div className="mt-2.5">
              {roleMembers.map((member, index) => (
                <div key={member.email} className={cn("flex items-center gap-[26px] py-1.5 pl-2.5 pr-2", index > 0 && "border-t", LINE)}>
                  <Checkbox checked={selectedMembers.has(member.email)} onChange={() => toggleMember(member.email)} label={`Chọn ${member.name}`} />
                  <div className="flex min-w-0 flex-1 items-center gap-5">
                    {member.avatarUrl
                      ? <img src={member.avatarUrl} alt={member.name} className="size-[50px] shrink-0 rounded-full object-cover" />
                      : <span className={cn("grid size-[50px] shrink-0 place-items-center rounded-full text-sm font-semibold", member.color)}>{member.initials}</span>}
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-semibold leading-5", INK)}>{member.name}</p>
                      <p className={cn("truncate text-[13px] leading-[18px]", MUTED)}>{member.email}</p>
                    </div>
                  </div>
                  {member.owner
                    ? <span className="rounded-md bg-[#f4f1fe] px-3.5 py-1.5 text-xs font-medium leading-4" style={{ color: ACCENT }}>Chủ cửa hàng</span>
                    : <DotsBox className="size-[26px]" />}
                </div>
              ))}
            </div>
          </section>

          {/* ───────── THIẾT LẬP QUYỀN ───────── */}
          <section className={cn(panel, "p-5")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={cn("text-[17px] font-semibold leading-6", INK)}>Thiết lập quyền</h2>
                  {permissionSaving && <span className="text-xs font-medium text-violet-600">Đang lưu…</span>}
                </div>
                <p className={cn("mt-0.5 text-sm leading-5", MUTED)}>Chọn các quyền mà vai trò này được phép truy cập và thực hiện.</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className={cn("h-9 gap-2 px-4 text-[13px]", outlineBtn)}>
                  <Copy className="size-4" strokeWidth={1.75} /> Sao chép quyền từ
                </Button>
                <Button variant="outline" className={cn("h-9 gap-2 px-4 text-[13px]", outlineBtn)}>
                  <RotateCw className="size-4" strokeWidth={1.75} /> Đặt lại
                </Button>
              </div>
            </div>

            <div className="-ml-[5px] mt-3 grid gap-0 lg:grid-cols-[203px_minmax(0,1fr)]">
              {/* Menu nhóm quyền */}
              <div className={cn("border-r pr-[5px]", LINE)}>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const targetId = item.targetId ?? item.id;
                  const isActive = activeSection === targetId;
                  const isOpen = Boolean(item.children) && expanded[item.id];
                  return (
                    <div key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          activateSection(targetId);
                          if (item.children) setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }));
                        }}
                        style={isActive ? { color: ACCENT } : undefined}
                        className={cn(
                          "flex w-full items-center gap-5 rounded-lg px-[15px] text-left text-sm",
                          item.tall ? "h-[42px]" : "h-[37px]",
                          isActive ? "bg-[#f2effd] font-semibold" : cn("font-medium hover:bg-slate-50", BODY),
                        )}
                      >
                        <Icon className={cn("size-[18px] shrink-0", isActive ? "" : "text-[#66769a]", item.filled && "fill-current")} strokeWidth={1.75} />
                        {item.label}
                        {(item.children || item.chevron) && (
                          isOpen
                            ? <ChevronUp className="ml-auto size-3.5 text-[#66769a]" />
                            : <ChevronDown className="ml-auto size-3.5 text-[#66769a]" />
                        )}
                      </button>
                      {isOpen && item.children && (
                        <div className="relative -mt-1 mb-1">
                          <span className="absolute bottom-1 left-6 top-1 w-px bg-[#e6e9f1]" />
                          {item.children.map((child) => (
                            <button key={child} type="button" onClick={() => activateSection("sales")} className={cn("flex h-7 w-full items-center pl-14 text-left text-sm hover:text-violet-600", BODY)}>{child}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Danh sách quyền */}
              <div className="min-w-0 pl-4">
                <div className={cn("mb-0.5 flex items-center justify-between gap-3 rounded-lg border px-[18px] py-[10px]", LINE)}>
                  <div className="flex items-center gap-4">
                    <Checkbox large checked={allChecked} onChange={toggleAll} label="Chọn tất cả quyền" />
                    <span className={cn("text-sm font-medium", INK)}>Chọn tất cả quyền</span>
                  </div>
                  <div className="relative w-[246px]">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#66769a]" strokeWidth={1.75} />
                    <Input placeholder="Tìm kiếm quyền..." className={cn("h-9", inputCls)} />
                  </div>
                </div>

                <div className="space-y-[9px]">
                  {visiblePermissionGroups.map((group) => {
                    const groupPermissions = permissionCatalog.filter((permission) => group.codes.includes(permission.code));
                    if (!groupPermissions.length) return null;
                    const Icon = group.icon;
                    return (
                      <div key={group.id} ref={(node) => { permissionGroupRefs.current[group.id] = node; }} id={`permission-group-${group.id}`} className={cn("scroll-mt-4 rounded-lg border px-[18px] pb-5 pt-3", LINE)}>
                        <button type="button" onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !(current[group.id] ?? true) }))} className="flex w-full items-center gap-[19px] text-left">
                          <Icon className={cn("size-6 shrink-0 text-[#66769a]", group.filled && "fill-current")} strokeWidth={1.6} />
                          <div className="min-w-0 flex-1">
                            <h3 className={cn("text-sm font-semibold leading-5", INK)}>{group.title}</h3>
                            <p className={cn("text-[13px] leading-5", MUTED)}>{group.description}</p>
                          </div>
                          {(expandedGroups[group.id] ?? true) ? <ChevronUp className="size-4 shrink-0 text-[#0b0c24]" strokeWidth={1.75} /> : <ChevronDown className="size-4 shrink-0 text-[#0b0c24]" strokeWidth={1.75} />}
                        </button>
                        {(expandedGroups[group.id] ?? true) && <div className="mt-[19px] grid gap-x-0 gap-y-2 pl-[62px] sm:[grid-template-columns:minmax(0,280px)_minmax(0,1fr)]">
                          {groupPermissions.map((permission) => {
                            const isOn = permissionCodes.includes(permission.code);
                            return (
                              <button
                                key={permission.code}
                                type="button"
                                role="checkbox"
                                aria-checked={isOn}
                                onClick={() => togglePermission(group.id, permission.code)}
                                className={cn("flex items-center gap-[14px] text-left text-sm leading-5", BODY)}
                              >
                                <span
                                  style={isOn ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
                                  className={cn("grid size-[18px] shrink-0 place-items-center rounded-[5px] border text-white transition-colors", !isOn && "border-[#cdd3e1] bg-white")}
                                >
                                  {isOn && <Check className="size-3" strokeWidth={3} />}
                                </span>
                                {permission.description || permissionLabelByCode[permission.code] || permission.code}
                              </button>
                            );
                          })}
                        </div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </> : <div />}
      <Dialog open={Boolean(dependencyPrompt)} onOpenChange={(open) => { if (!open) setDependencyPrompt(null); }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Cần cấp thêm quyền phụ thuộc</DialogTitle>
            <DialogDescription>
              Để bật quyền <strong>{dependencyPrompt?.permissionLabel}</strong>, vai trò này cần thêm các quyền sau:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-violet-100 bg-violet-50/60 p-3">
            {dependencyPrompt?.required.map((permission) => (
              <div key={permission.code} className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <span className="grid size-5 place-items-center rounded-full bg-violet-600 text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span>{permission.description || permissionLabelByCode[permission.code] || permission.code}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDependencyPrompt(null)}>Hủy</Button>
            <Button
              className="bg-[#693ae5] text-white hover:bg-[#5b2fd0]"
              onClick={() => {
                if (!dependencyPrompt) return;
                const { roleId, nextCodes } = dependencyPrompt;
                setDependencyPrompt(null);
                persistPermissionCodes(roleId, nextCodes);
              }}
            >
              Đồng ý & cấp quyền
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
