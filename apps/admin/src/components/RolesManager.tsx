import {
  ArrowLeft,
  Box,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Crown,
  FileText,
  Gift,
  Home,
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
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AnimatedPanel } from "@/components/ui/AnimatedPanel";
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
import { EmployeeFormPage } from "@/components/EmployeeFormPage";
import { adminApi } from "@/lib/api";

/* ═════════════════════════ Design tokens (đo từ design) ═════════════════════════ */

const BRAND = "#6941c6"; // màu nhấn dùng chung trong admin
const ACCENT = "#6941c6"; // checkbox, chữ active, link

const INK = "text-slate-900"; // tiêu đề / chữ đậm
const BODY = "text-slate-700"; // chữ nội dung (nhãn quyền, menu)
const MUTED = "text-slate-500"; // mô tả
const LINE = "border-slate-200";

const panel = "rounded-xs border border-slate-200 bg-white";
const outlineBtn = "rounded-xs border-slate-200 bg-white font-medium text-slate-700 shadow-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#6941c6] focus-visible:ring-offset-2";
const primaryBtn = "h-9 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white shadow-none transition-colors hover:bg-[#53389e] focus-visible:ring-2 focus-visible:ring-[#6941c6] focus-visible:ring-offset-2";
const inputCls = "rounded-xs border-slate-200 bg-white pl-9 text-sm shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#6941c6]";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

/* ═════════════════════════ Dữ liệu ═════════════════════════ */

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
  icon: IconType;
  system?: boolean;
  createdAt: string;
  updatedAt: string;
};

function buildRoleCode(name: string) {
  let code = name
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!code) return "";
  if (!/^[a-z]/.test(code)) code = `role_${code}`;
  if (code.length < 3) code = `${code}_role`;
  return code.slice(0, 49).replace(/_+$/g, "");
}

const roles: Role[] = [
  { id: "admin", code: "system_owner", name: "Admin", description: "Toàn quyền quản trị hệ thống.", longDescription: "Toàn quyền quản trị hệ thống, bao gồm tất cả các chức năng.", members: 3, icon: Crown, system: true, createdAt: "01/01/2024 10:00", updatedAt: "15/06/2024 14:30" },
  { id: "manager", code: "ops_manager", name: "Quản lý", description: "Quản lý vận hành, đơn hàng, nội dung.", members: 5, icon: UserCog, createdAt: "01/01/2024 10:00", updatedAt: "15/06/2024 14:30" },
  { id: "sales", code: "sales_staff", name: "Nhân viên bán hàng", description: "Tạo đơn, quản lý khách hàng, tư vấn.", members: 8, icon: ShoppingCart, createdAt: "02/01/2024 09:30", updatedAt: "12/06/2024 11:20" },
  { id: "content", code: "content_editor", name: "Nhân viên content", description: "Tạo và quản lý nội dung.", members: 4, icon: PenLine, createdAt: "02/01/2024 09:30", updatedAt: "10/06/2024 16:10" },
  { id: "warehouse", code: "warehouse_staff", name: "Nhân viên kho", description: "Quản lý tồn kho, kiểm hàng.", members: 3, icon: Box, createdAt: "03/01/2024 08:30", updatedAt: "14/06/2024 09:45" },
];

const roleAccent: Record<string, { foreground: string; background: string; selectedBackground: string }> = {
  system_owner: { foreground: "#6941c6", background: "#f1edff", selectedBackground: "#f7f4ff" },
  ops_manager: { foreground: "#2878c7", background: "#edf6ff", selectedBackground: "#f5faff" },
  sales_staff: { foreground: "#16886b", background: "#eaf8f3", selectedBackground: "#f3fbf7" },
  content_editor: { foreground: "#c44575", background: "#fff0f5", selectedBackground: "#fff7fa" },
  warehouse_staff: { foreground: "#c47b20", background: "#fff5e7", selectedBackground: "#fffbf4" },
};

const fallbackRoleAccent = { foreground: "#64748b", background: "#f1f5f9", selectedBackground: "#f8fafc" };

const permissionGroupMeta: Array<{ id: string; title: string; description: string; icon: IconType; codes: string[] }> = [
  { id: "overview", title: "Tổng quan", description: "Truy cập dashboard và số liệu tổng quan.", icon: Home, codes: ["dashboard.read", "audit.read"] },
  { id: "reports", title: "Báo cáo", description: "Xem và xuất các báo cáo vận hành.", icon: PieChart, codes: ["report.read", "report.export"] },
  { id: "products", title: "Sản phẩm", description: "Quản lý danh mục và thông tin sản phẩm.", icon: Box, codes: ["product.read", "product.write", "product.publish", "product.delete", "price.write", "cost.read", "category.read", "category.write"] },
  { id: "orders", title: "Đơn hàng", description: "Quản lý đơn hàng và xử lý giao vận.", icon: FileText, codes: ["order.read", "order.write", "order.customer.read", "order.update", "order.cancel", "order.export"] },
  { id: "customers", title: "Khách hàng", description: "Quản lý hồ sơ và chăm sóc khách hàng.", icon: Users, codes: ["customer.read", "customer.write"] },
  { id: "inventory", title: "Kho hàng", description: "Nhập, xuất và điều chỉnh tồn kho.", icon: Box, codes: ["inventory.read", "inventory.receive", "inventory.issue", "inventory.adjust.request", "inventory.adjust.approve"] },
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

type Member = {
  id?: string;
  name: string;
  email: string;
  initials: string;
  owner?: boolean;
  color: string;
  avatarUrl: string | null;
};

type AvailableMember = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
  roleCodes: string[];
  roleNames: string[];
};

const members: Member[] = [
  { name: "Sophia Carter", email: "sophia@elane.vn", initials: "SC", owner: true, color: "bg-amber-100 text-amber-700", avatarUrl: null as string | null },
  { name: "James Wilson", email: "james@elane.vn", initials: "JW", color: "bg-sky-100 text-sky-700", avatarUrl: null as string | null },
  { name: "Emily Nguyen", email: "emily@elane.vn", initials: "EN", color: "bg-rose-100 text-rose-700", avatarUrl: null as string | null },
];

type NavItem = {
  id: string;
  targetId?: string;
  label: string;
  icon: IconType;
  chevron?: boolean;
  children?: string[];
  /** Các mục sau nhóm "Kênh bán hàng" có chiều cao lớn hơn trong design. */
  tall?: boolean;
};

const navItems: NavItem[] = [
  { id: "overview", label: "Tổng quan", icon: Home },
  { id: "products", label: "Sản phẩm", icon: Tag },
  { id: "orders", label: "Đơn hàng", icon: FileText },
  { id: "customers", label: "Khách hàng", icon: Users },
  { id: "sales", label: "Kênh bán hàng", icon: Users, children: ["Facebook", "TikTok Shop", "Shopee", "Website", "Zalo OA"] },
  { id: "content", label: "Content Studio", icon: PenLine, tall: true },
  { id: "warehouse", targetId: "inventory", label: "Kho hàng", icon: Box, chevron: true, tall: true },
  { id: "reports", targetId: "reports", label: "Báo cáo", icon: Store, chevron: true, tall: true },
  { id: "promotions", label: "Khuyến mãi", icon: Gift, chevron: true, tall: true },
  { id: "settings", label: "Cài đặt", icon: Settings, tall: true },
];

/* ═════════════════════════ Thành phần nhỏ ═════════════════════════ */

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      style={checked ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
      className={cn(
        "grid shrink-0 place-items-center rounded-xs border text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6] focus-visible:ring-offset-2",
        "size-4",
        !checked && "border-slate-300 bg-white",
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: IconType; label: string; value: string }) {
  return (
      <div className="grid grid-cols-[32px_minmax(0,1fr)] items-start">
      <Icon className="mt-0.5 size-4 text-slate-400" strokeWidth={1.75} />
      <div>
        <p className={cn("text-[13px] leading-4", MUTED)}>{label}</p>
        <p className="mt-1 text-sm font-medium leading-5 text-slate-700">{value}</p>
      </div>
    </div>
  );
}

/* ═════════════════════════ Trang ═════════════════════════ */

export function RolesManager({ permissions = [], onPermissionsChanged }: { permissions?: string[]; onPermissionsChanged?: () => Promise<void> | void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const canRoleManage = permissions.includes("*") || permissions.includes("role.manage");
  const canStaffManage = permissions.includes("*") || permissions.includes("staff.manage");
  const employeeFormMatch = location.pathname.match(/^\/phanquyen\/nhanvien\/(them|create|sua|edit)(?:\/([^/]+))?\/?$/i);
  const employeeFormMode = employeeFormMatch ? (/^(them|create)$/i.test(employeeFormMatch[1] ?? "") ? "create" : "edit") : null;
  const employeeFormId = employeeFormMatch?.[2] ?? null;
  const [selectedId, setSelectedId] = useState("admin");
  const [roleItems, setRoleItems] = useState<Role[]>(roles);
  const [activeTab, setActiveTab] = useState<"roles" | "employees">(canRoleManage ? "roles" : "employees");
  const [roleCreateOpen, setRoleCreateOpen] = useState(false);
  const [roleCreateName, setRoleCreateName] = useState("");
  const [roleCreateCode, setRoleCreateCode] = useState("");
  const [roleCreateDescription, setRoleCreateDescription] = useState("");
  const [roleCreating, setRoleCreating] = useState(false);
  const [roleEditOpen, setRoleEditOpen] = useState(false);
  const [roleEditName, setRoleEditName] = useState("");
  const [roleEditDescription, setRoleEditDescription] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleDeleteOpen, setRoleDeleteOpen] = useState(false);
  const [roleDeleting, setRoleDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sales: true });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    () => new Set(members.filter((m) => m.owner).map((m) => m.email)),
  );
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionItem[]>(fallbackPermissionCatalog);
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [roleMembers, setRoleMembers] = useState<Member[]>(members);
  const [memberQuery, setMemberQuery] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([]);
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [membersToAdd, setMembersToAdd] = useState<Set<string>>(new Set());
  const [memberSaving, setMemberSaving] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [dependencyPrompt, setDependencyPrompt] = useState<PermissionDependencyPrompt | null>(null);
  const permissionCodesRef = useRef<string[]>([]);
  const permissionSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestPermissionRequestRef = useRef(0);

  useEffect(() => {
    if (!canRoleManage || employeeFormMode) return;
    void adminApi.permissions().then((response) => {
      if (response.items.length) setPermissionCatalog(response.items);
    }).catch(() => undefined);
    void adminApi.roles().then((response) => {
      const next = response.items.map((item) => {
        const roleTemplate = roles.find((role) => role.code === item.code);
        const fallback = roleTemplate ?? roles[0]!;
        const description = item.description || roleTemplate?.longDescription || roleTemplate?.description || "Vai trò tùy chỉnh.";
        return {
          ...fallback,
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description || roleTemplate?.description || "Vai trò tùy chỉnh.",
          longDescription: description,
          members: item.members,
          system: item.is_system,
          createdAt: new Date(item.created_at).toLocaleString("vi-VN"),
          updatedAt: new Date(item.updated_at).toLocaleString("vi-VN"),
        };
      });
      if (next.length) {
        setRoleItems(next);
        setSelectedId((current) => next.find((role) => role.code === "system_owner")?.id ?? current);
      }
    }).catch(() => undefined);
  }, [canRoleManage, employeeFormMode]);

  useEffect(() => {
    if (!canRoleManage || employeeFormMode) return;
    const selectedRole = roleItems.find((role) => role.id === selectedId);
    if (!selectedRole || selectedRole.id === "admin") return;
    void adminApi.role(selectedRole.id).then((detail) => {
      const codes = detail.permissions.map((permission) => permission.code);
      setPermissionCodes(codes);
      permissionCodesRef.current = codes;
      const nextMembers = detail.members.map((member, index) => ({ id: String(member.id ?? member.work_email ?? ""), name: String(member.full_name ?? ""), email: String(member.work_email ?? ""), initials: String(member.full_name ?? "").split(/\s+/).slice(-2).map((word) => word[0]).join("").toUpperCase(), avatarUrl: typeof member.avatar_url === "string" ? member.avatar_url : null, owner: index === 0 && selectedRole.code === "system_owner", color: index % 2 ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700" }));
      setRoleMembers(nextMembers);
      setSelectedMembers(new Set(nextMembers.map((member) => member.email)));
    }).catch(() => undefined);
  }, [canRoleManage, employeeFormMode, permissionCatalog, roleItems, selectedId]);

  useEffect(() => {
    if (!canRoleManage && canStaffManage) setActiveTab("employees");
    if (canRoleManage && !canStaffManage) setActiveTab("roles");
  }, [canRoleManage, canStaffManage]);

  const selected = roleItems.find((role) => role.id === selectedId) ?? roleItems[0]!;
  const selectedRoleIsPersisted = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selected.id);
  const SelectedIcon = selected.icon;
  const selectedAccent = roleAccent[selected.code] ?? fallbackRoleAccent;
  const filteredRoles = useMemo(
    () => roleItems.filter((role) => role.name.toLowerCase().includes(query.toLowerCase())),
    [query, roleItems],
  );
  const permissionTabs: Array<{ id: "roles" | "employees"; label: string; icon: IconType }> = [
    ...(canRoleManage ? [{ id: "roles" as const, label: "Vai trò", icon: UserCog }] : []),
    ...(canStaffManage ? [{ id: "employees" as const, label: "Nhân viên", icon: Users }] : []),
  ];

  const allChecked = permissionCatalog.length > 0 && permissionCatalog.every((permission) => permissionCodes.includes(permission.code));
  const visiblePermissionGroups = activeSection === "overview"
    ? permissionGroupMeta.filter((group) => ["overview", "products", "orders"].includes(group.id))
    : permissionGroupMeta.filter((group) => group.id === activeSection);
  const filteredRoleMembers = roleMembers.filter((member) => {
    const value = `${member.name} ${member.email}`.toLowerCase();
    return value.includes(memberQuery.toLowerCase());
  });
  const filteredAvailableMembers = availableMembers.filter((member) => {
    const value = `${member.name} ${member.email} ${member.roleNames.join(" ")}`.toLowerCase();
    return value.includes(addMemberQuery.toLowerCase());
  });

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

  const openAddMember = async () => {
    if (!canRoleManage || selected.id === "admin") {
      toast.error("Chưa tải được vai trò từ hệ thống");
      return;
    }
    setAddMemberQuery("");
    setMembersToAdd(new Set());
    setAddMemberOpen(true);
    try {
      const response = await adminApi.roleAvailableMembers(selected.id);
      setAvailableMembers(response.items.map((member) => ({
        id: member.id,
        name: member.full_name,
        email: member.work_email ?? "Chưa có email",
        initials: member.full_name.split(/\s+/).slice(-2).map((word) => word[0]).join("").toUpperCase(),
        avatarUrl: member.avatar_url,
        roleCodes: member.roles.map((role) => role.role_code),
        roleNames: member.roles.map((role) => role.role_name),
      })));
    } catch (error) {
      setAddMemberOpen(false);
      toast.error(error instanceof Error ? error.message : "Không tải được danh sách nhân viên");
    }
  };

  const saveAddedMembers = async () => {
    if (!selected || membersToAdd.size === 0) return;
    const employeeIds = Array.from(membersToAdd);
    setMemberSaving(true);
    try {
      await adminApi.addRoleMembers(selected.id, employeeIds);
      const [detail, roleResponse] = await Promise.all([adminApi.role(selected.id), adminApi.roles()]);
      const nextMembers = detail.members.map((member, index) => ({
        id: String(member.id ?? member.work_email ?? ""),
        name: String(member.full_name ?? ""),
        email: String(member.work_email ?? ""),
        initials: String(member.full_name ?? "").split(/\s+/).slice(-2).map((word) => word[0]).join("").toUpperCase(),
        avatarUrl: typeof member.avatar_url === "string" ? member.avatar_url : null,
        owner: index === 0 && selected.code === "system_owner",
        color: index % 2 ? "bg-sky-100 text-sky-700" : "bg-rose-100 text-rose-700",
      }));
      setRoleMembers(nextMembers);
      setSelectedMembers(new Set(nextMembers.map((member) => member.email)));
      setRoleItems(roleResponse.items.map((item) => {
        const fallback = roles.find((role) => role.code === item.code) ?? roles[0]!;
        return { ...fallback, id: item.id, code: item.code, name: item.name, description: item.description, members: item.members, system: item.is_system, createdAt: new Date(item.created_at).toLocaleString("vi-VN"), updatedAt: new Date(item.updated_at).toLocaleString("vi-VN") };
      }));
      setAddMemberOpen(false);
      setMembersToAdd(new Set());
      toast.success(`Đã thêm ${employeeIds.length} nhân viên vào vai trò ${selected.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Thêm nhân viên thất bại");
    } finally {
      setMemberSaving(false);
    }
  };

  const activateSection = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const openRoleCreator = () => {
    setRoleCreateName("");
    setRoleCreateCode("");
    setRoleCreateDescription("");
    setRoleCreateOpen(true);
  };

  const saveNewRole = async () => {
    const name = roleCreateName.trim();
    const code = roleCreateCode.trim();
    const description = roleCreateDescription.trim();
    if (name.length < 2 || name.length > 80) {
      toast.error("Tên vai trò cần có từ 2 đến 80 ký tự");
      return;
    }
    if (!/^[a-z][a-z0-9_]{2,48}$/.test(code)) {
      toast.error("Mã vai trò tự động tạo chưa hợp lệ");
      return;
    }
    if (description.length > 240) {
      toast.error("Mô tả vai trò không được vượt quá 240 ký tự");
      return;
    }

    setRoleCreating(true);
    try {
      const response = await adminApi.createRole({ code, name, description, permission_codes: [] });
      const createdAt = new Date(response.created_at).toLocaleString("vi-VN");
      const newRole: Role = {
        id: response.id,
        code: response.code,
        name: response.name,
        description: response.description,
        longDescription: response.description || "Vai trò tùy chỉnh.",
        members: 0,
        icon: UserCog,
        system: response.is_system,
        createdAt,
        updatedAt: new Date(response.updated_at).toLocaleString("vi-VN"),
      };
      setRoleItems((current) => [...current, newRole].sort((a, b) => a.name.localeCompare(b.name, "vi")));
      permissionCodesRef.current = [];
      setPermissionCodes([]);
      setRoleMembers([]);
      setSelectedMembers(new Set());
      setSelectedId(newRole.id);
      setActiveSection("overview");
      setExpandedGroups({});
      setActiveTab("roles");
      setRoleCreateOpen(false);
      toast.success(`Đã tạo vai trò ${newRole.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tạo được vai trò");
    } finally {
      setRoleCreating(false);
    }
  };

  const openRoleEditor = () => {
    if (!selectedRoleIsPersisted) {
      toast.error("Đang tải dữ liệu vai trò, vui lòng thử lại sau");
      return;
    }
    setRoleEditName(selected.name);
    setRoleEditDescription(selected.longDescription ?? selected.description);
    setRoleEditOpen(true);
  };

  const saveRole = async () => {
    const name = roleEditName.trim();
    const description = roleEditDescription.trim();
    if (name.length < 2 || name.length > 80) {
      toast.error("Tên vai trò cần có từ 2 đến 80 ký tự");
      return;
    }
    if (description.length > 240) {
      toast.error("Mô tả vai trò không được vượt quá 240 ký tự");
      return;
    }

    setRoleSaving(true);
    try {
      const response = await adminApi.updateRole(selected.id, { name, description });
      const updatedAt = new Date(response.role.updated_at).toLocaleString("vi-VN");
      setRoleItems((current) => current.map((role) => role.id === response.role.id
        ? { ...role, name: response.role.name, description: response.role.description, longDescription: response.role.description, updatedAt }
        : role));
      void Promise.resolve(onPermissionsChanged?.()).catch(() => undefined);
      setRoleEditOpen(false);
      toast.success("Đã cập nhật thông tin vai trò");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không cập nhật được vai trò");
    } finally {
      setRoleSaving(false);
    }
  };

  const deleteSelectedRole = async () => {
    if (selected.system || !selectedRoleIsPersisted) return;
    if (selected.members > 0) {
      toast.error("Hãy gỡ tất cả nhân viên khỏi vai trò trước khi xóa");
      return;
    }

    setRoleDeleting(true);
    try {
      await adminApi.deleteRole(selected.id);
      const remainingRoles = roleItems.filter((role) => role.id !== selected.id);
      const nextRole = remainingRoles[0];
      setRoleItems(remainingRoles);
      permissionCodesRef.current = [];
      setPermissionCodes([]);
      setRoleMembers([]);
      setSelectedMembers(new Set());
      setSelectedId(nextRole?.id ?? "admin");
      setActiveSection("overview");
      setExpandedGroups({});
      setRoleDeleteOpen(false);
      toast.success(`Đã xóa vai trò ${selected.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không xóa được vai trò");
    } finally {
      setRoleDeleting(false);
    }
  };

  if (employeeFormMode) {
    return <EmployeeFormPage mode={employeeFormMode} employeeId={employeeFormId} permissions={permissions} onBack={() => navigate({ to: "/phanquyen" })} />;
  }

  return (
    <div className="space-y-[18px] pb-6">
      {/* ───────── HEADER ───────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-[23px]">
          <button type="button" className="ml-2.5 mt-[9px] grid size-8 place-items-center rounded-xs text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6]" aria-label="Quay lại">
            <ArrowLeft className="size-4" strokeWidth={1.75} />
          </button>
          <div>
            <h1 className="text-3xl font-bold leading-9 tracking-tight text-[#00000b]">Phân quyền</h1>
            <p className={cn("text-sm leading-5", MUTED)}>Tạo và quản lý các vai trò, phân quyền truy cập hệ thống.</p>
          </div>
        </div>
        <div className="mt-1.5 flex gap-3">
          {activeTab === "employees" && canStaffManage ? <>
              <Button variant="outline" className={cn("h-9 gap-2 px-3.5 text-sm", outlineBtn)}>
              <Clock className="size-4" strokeWidth={1.75} /> Nhật ký hoạt động
            </Button>
            <Button
              onClick={() => navigate({ to: "/phanquyen/nhanvien/them" })}
              className={cn(primaryBtn, "gap-2")}
            >
              <Plus className="size-4" strokeWidth={1.75} /> Thêm nhân viên
            </Button>
          </> : <>
            <Button variant="outline" className={cn("h-9 gap-2 px-3.5 text-sm", outlineBtn)}>
              <Clock className="size-4" strokeWidth={1.75} /> Nhật ký phân quyền
            </Button>
            {canRoleManage && <Button
              onClick={openRoleCreator}
              className={cn(primaryBtn, "gap-2")}
            >
              <Plus className="size-4" strokeWidth={1.75} /> Tạo vai trò mới
            </Button>}
          </>}
        </div>
      </div>

      {/* ───────── TABS ───────── */}
      <div role="tablist" aria-label="Phân quyền" className="inline-flex w-fit items-center gap-1 rounded-xs border border-slate-200 bg-slate-100 p-1">
        {permissionTabs.map(({ id, label, icon: TabIcon }, index) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              id={`permission-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`permission-panel-${id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={(event) => {
                let nextIndex: number | null = null;
                if (event.key === "ArrowRight") nextIndex = (index + 1) % permissionTabs.length;
                if (event.key === "ArrowLeft") nextIndex = (index - 1 + permissionTabs.length) % permissionTabs.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = permissionTabs.length - 1;
                if (nextIndex === null) return;
                event.preventDefault();
                const nextTab = permissionTabs[nextIndex]!;
                setActiveTab(nextTab.id);
                document.getElementById(`permission-tab-${nextTab.id}`)?.focus();
              }}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-xs border px-4 text-sm font-medium transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6] focus-visible:ring-offset-2",
                active ? "border-slate-200 bg-white text-[#6941c6]" : "border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900",
              )}
            >
              <TabIcon className={cn("size-4", active ? "text-[#6941c6]" : "text-slate-400")} strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </div>

      <AnimatedPanel
        animationMode="page"
        transitionKey={activeTab}
        role="tabpanel"
        id={`permission-panel-${activeTab}`}
        aria-labelledby={`permission-tab-${activeTab}`}
        className="space-y-[18px]"
      >
      {activeTab === "employees" && canStaffManage ? <EmployeesManager embedded permissions={permissions} /> : canRoleManage ? <>
        {/* ───────── DANH SÁCH VAI TRÒ ───────── */}
        <section className={cn(panel, "p-4")}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={cn("text-[17px] font-semibold leading-6", INK)}>Vai trò ({roleItems.length})</h2>
              <p className={cn("text-sm leading-5", MUTED)}>Tạo và quản lý các vai trò, phân quyền truy cập hệ thống.</p>
            </div>
            <div className="relative -mt-1 w-[267px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm vai trò..." className={cn("h-9", inputCls)} />
            </div>
          </div>

          <div className="mt-[15px] grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            {filteredRoles.map((role) => {
              const RoleIcon = role.icon;
              const isSelected = selectedId === role.id;
              const accent = roleAccent[role.code] ?? fallbackRoleAccent;
              return (
                <button
                  key={role.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(role.id)}
                  className={cn(
                    "flex min-h-[112px] w-full items-start gap-3 rounded-xs border p-4 text-left transition duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6] focus-visible:ring-offset-2",
                    isSelected ? "border-[#6941c6]" : "border-slate-200 bg-white hover:border-slate-300",
                  )}
                  style={isSelected ? { backgroundColor: accent.selectedBackground } : undefined}
                >
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xs" style={{ backgroundColor: accent.background, color: accent.foreground }}>
                    <RoleIcon className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className={cn("truncate text-sm font-semibold leading-5", INK)}>{role.name}</p>
                    <p className={cn("mt-1.5 line-clamp-2 text-xs leading-5", MUTED)}>{role.description}</p>
                    <p className="mt-auto inline-flex items-center gap-1.5 pt-2.5 text-xs leading-4 text-slate-500">
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: accent.foreground }} />
                      {role.members} nhân viên
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,472fr)_minmax(0,910fr)]">
          {/* ───────── THÔNG TIN VAI TRÒ ───────── */}
          <section className={cn(panel, "p-4")}>
            <div className="flex items-start justify-between gap-3">
              <h2 className={cn("pt-1 text-[17px] font-semibold leading-6", INK)}>Thông tin vai trò</h2>
              <div className="flex items-center gap-2">
                {!selected.system && selectedRoleIsPersisted && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRoleDeleteOpen(true)}
                    className="h-9 gap-2 rounded-xs border-rose-200 bg-white px-3.5 text-sm font-medium text-rose-700 shadow-none transition-colors hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} /> Xóa
                  </Button>
                )}
                <Button variant="outline" onClick={openRoleEditor} className={cn("h-9 gap-2 px-3.5 text-sm", outlineBtn)}>
                  <Pencil className="size-4" strokeWidth={1.75} /> Chỉnh sửa
                </Button>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xs" style={{ backgroundColor: selectedAccent.background, color: selectedAccent.foreground }}>
                <SelectedIcon className="size-5" strokeWidth={1.75} />
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
              <Button variant="outline" onClick={() => void openAddMember()} className={cn("h-9 gap-2 px-3.5 text-sm", outlineBtn)}>
                <Plus className="size-4" strokeWidth={1.75} /> Thêm nhân viên
              </Button>
            </div>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#66769a]" strokeWidth={1.75} />
              <Input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Tìm kiếm nhân viên..." className={cn("h-9", inputCls)} />
            </div>

            <div className="mt-2.5">
              {filteredRoleMembers.map((member, index) => (
                <div key={member.email} className={cn("flex items-center gap-3 py-2.5", index > 0 && "border-t", LINE)}>
                  <Checkbox checked={selectedMembers.has(member.email)} onChange={() => toggleMember(member.email)} label={`Chọn ${member.name}`} />
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {member.avatarUrl
                      ? <img src={member.avatarUrl} alt={member.name} className="size-10 shrink-0 rounded-full object-cover" />
                      : <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold", member.color)}>{member.initials}</span>}
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-semibold leading-5", INK)}>{member.name}</p>
                      <p className="truncate text-xs leading-5 text-slate-500">{member.email}</p>
                    </div>
                  </div>
                  {member.owner
                    ? <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">Chủ cửa hàng</span>
                    : null}
                </div>
              ))}
            </div>
          </section>

          {/* ───────── THIẾT LẬP QUYỀN ───────── */}
          <section className={cn(panel, "p-4")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={cn("text-[17px] font-semibold leading-6", INK)}>Thiết lập quyền</h2>
                  {permissionSaving && <span className="text-xs font-medium text-[#6941c6]">Đang lưu…</span>}
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
                  const isOpen = Boolean(item.children) && Boolean(expanded[item.id]);
                  return (
                    <div key={item.id}>
                      <button
                        type="button"
                        aria-expanded={item.children ? isOpen : undefined}
                        aria-controls={item.children ? `permission-nav-group-${item.id}` : undefined}
                        onClick={() => {
                          activateSection(targetId);
                          if (item.children) setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }));
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xs px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6941c6]",
                          item.tall ? "h-[42px]" : "h-[37px]",
                          isActive ? "bg-[#f2edff] font-semibold text-[#6941c6]" : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", isActive ? "text-[#6941c6]" : "text-slate-400")} strokeWidth={1.75} />
                        {item.label}
                        {(item.children || item.chevron) && (
                          <ChevronDown className={cn("ml-auto size-3.5 text-[#66769a] transition-transform duration-300 ease-in-out", isOpen && "rotate-180")} />
                        )}
                      </button>
                      {item.children && (
                        <div
                          id={`permission-nav-group-${item.id}`}
                          aria-hidden={!isOpen}
                          className={cn(
                            "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                          )}
                        >
                          <div className="min-h-0 overflow-hidden" inert={!isOpen}>
                            <div className="relative -mt-1 mb-1">
                              <span className="absolute bottom-1 left-6 top-1 w-px bg-[#e6e9f1]" />
                              {item.children.map((child) => (
                                <button key={child} type="button" onClick={() => activateSection("sales")} className="flex h-7 w-full items-center pl-12 text-left text-sm text-slate-500 transition-colors duration-300 ease-in-out hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6941c6]">{child}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Danh sách quyền */}
              <div className="min-w-0 pl-4">
            <div className={cn("mb-0.5 flex items-center justify-between gap-3 rounded-xs border px-[18px] py-[10px]", LINE)}>
                  <div className="flex items-center gap-4">
                    <Checkbox checked={allChecked} onChange={toggleAll} label="Chọn tất cả quyền" />
                    <span className={cn("text-sm font-medium", INK)}>Chọn tất cả quyền</span>
                  </div>
                  <div className="relative w-[246px]">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#66769a]" strokeWidth={1.75} />
                    <Input placeholder="Tìm kiếm quyền..." className={cn("h-9", inputCls)} />
                  </div>
                </div>

                <AnimatedPanel transitionKey={activeSection} className="min-w-0">
                <div className="space-y-[9px]">
                  {visiblePermissionGroups.map((group) => {
                    const groupPermissions = permissionCatalog.filter((permission) => group.codes.includes(permission.code));
                    if (!groupPermissions.length) return null;
                    const Icon = group.icon;
                    const groupOpen = expandedGroups[group.id] ?? true;
                    return (
              <div key={group.id} id={`permission-group-${group.id}`} className={cn("rounded-xs border px-[18px] pb-5 pt-3", LINE)}>
                        <button type="button" aria-expanded={groupOpen} aria-controls={`permission-items-${group.id}`} onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !groupOpen }))} className="flex w-full items-center gap-3 text-left transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6] focus-visible:ring-offset-2">
                          <Icon className="size-4 shrink-0 text-[#6941c6]" strokeWidth={1.75} />
                          <div className="min-w-0 flex-1">
                            <h3 className={cn("text-sm font-semibold leading-5", INK)}>{group.title}</h3>
                            <p className={cn("text-[13px] leading-5", MUTED)}>{group.description}</p>
                          </div>
                          <ChevronDown className={cn("size-4 shrink-0 text-slate-500 transition-transform duration-300 ease-in-out", groupOpen && "rotate-180")} strokeWidth={1.75} />
                        </button>
                        <div
                          id={`permission-items-${group.id}`}
                          aria-hidden={!groupOpen}
                          className={cn(
                            "grid transition-[grid-template-rows,opacity,transform] duration-300 ease-in-out",
                            groupOpen ? "grid-rows-[1fr] translate-y-0 opacity-100" : "grid-rows-[0fr] -translate-y-1 opacity-0",
                          )}
                        >
                          <div className="min-h-0 overflow-hidden" inert={!groupOpen}>
                            <div className="mt-[19px] grid gap-x-0 gap-y-2 pl-[62px] sm:[grid-template-columns:minmax(0,280px)_minmax(0,1fr)]">
                          {groupPermissions.map((permission) => {
                            const isOn = permissionCodes.includes(permission.code);
                            return (
                              <button
                                key={permission.code}
                                type="button"
                                role="checkbox"
                                aria-checked={isOn}
                                onClick={() => togglePermission(group.id, permission.code)}
                                className={cn("flex items-center gap-3 rounded-xs py-1 text-left text-sm leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6] focus-visible:ring-offset-2", BODY)}
                              >
                                <span
                                  style={isOn ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
                                  className={cn("grid size-4 shrink-0 place-items-center rounded-xs border text-white transition-colors", !isOn && "border-slate-300 bg-white")}
                                >
                                  {isOn && <Check className="size-3" strokeWidth={3} />}
                                </span>
                                {permission.description || permissionLabelByCode[permission.code] || permission.code}
                              </button>
                            );
                          })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </AnimatedPanel>
              </div>
            </div>
          </section>
        </div>
      </> : <div />}
      </AnimatedPanel>
      <Dialog open={roleCreateOpen} onOpenChange={(open) => { if (!roleCreating) setRoleCreateOpen(open); }}>
        <DialogContent className="rounded-xs sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo vai trò mới</DialogTitle>
            <DialogDescription>Vai trò mới sẽ được tạo chưa có quyền. Bạn có thể cấp quyền ngay trong mục Thiết lập quyền sau khi lưu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="role-create-name" className="text-sm font-medium text-slate-700">Tên vai trò</label>
              <Input
                id="role-create-name"
                autoFocus
                maxLength={80}
                value={roleCreateName}
                onChange={(event) => {
                  setRoleCreateName(event.target.value);
                  setRoleCreateCode(buildRoleCode(event.target.value));
                }}
                placeholder="Ví dụ: Nhân viên chăm sóc khách hàng"
                className="h-10 rounded-xs border-slate-200 bg-white px-3 shadow-none focus-visible:ring-1 focus-visible:ring-[#6941c6]"
                disabled={roleCreating}
              />
              <p className="text-xs text-slate-500">Từ 2 đến 80 ký tự.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="role-create-code" className="text-sm font-medium text-slate-700">Mã vai trò</label>
              <Input
                id="role-create-code"
                value={roleCreateCode}
                readOnly
                placeholder="Mã sẽ được tạo từ tên vai trò"
                className="h-10 rounded-xs border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-600 shadow-none"
              />
              <p className="text-xs text-slate-500">Mã dùng để nhận diện vai trò trong hệ thống.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="role-create-description" className="text-sm font-medium text-slate-700">Mô tả</label>
              <textarea
                id="role-create-description"
                rows={3}
                maxLength={240}
                value={roleCreateDescription}
                onChange={(event) => setRoleCreateDescription(event.target.value)}
                placeholder="Mô tả trách nhiệm của vai trò này"
                className="w-full resize-y rounded-xs border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-800 shadow-none outline-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#6941c6] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={roleCreating}
              />
              <p className="text-right text-xs text-slate-500">{roleCreateDescription.length}/240</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className={outlineBtn} onClick={() => setRoleCreateOpen(false)} disabled={roleCreating}>Hủy</Button>
            <Button type="button" className={primaryBtn} onClick={() => void saveNewRole()} disabled={roleCreating || roleCreateName.trim().length < 2 || !/^[a-z][a-z0-9_]{2,48}$/.test(roleCreateCode)}>
              {roleCreating ? "Đang tạo..." : "Tạo vai trò"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={roleDeleteOpen} onOpenChange={(open) => { if (!roleDeleting) setRoleDeleteOpen(open); }}>
        <DialogContent className="rounded-xs sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa vai trò “{selected.name}”?</DialogTitle>
            <DialogDescription>
              {selected.members > 0
                ? `Vai trò đang được gán cho ${selected.members} nhân viên. Hãy gỡ họ khỏi vai trò trước khi xóa.`
                : "Thao tác này sẽ xóa cấu hình quyền của vai trò và không thể hoàn tác."}
            </DialogDescription>
          </DialogHeader>
          {selected.members === 0 && (
            <div className="rounded-xs border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
              Toàn bộ quyền cấu hình của vai trò sẽ bị xóa cùng vai trò.
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className={outlineBtn} onClick={() => setRoleDeleteOpen(false)} disabled={roleDeleting}>Hủy</Button>
            <Button
              type="button"
              className="h-9 rounded-xs bg-rose-600 px-4 text-sm font-medium text-white shadow-none transition-colors hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
              onClick={() => void deleteSelectedRole()}
              disabled={roleDeleting || selected.members > 0}
            >
              <Trash2 className="mr-2 size-4" strokeWidth={1.75} />
              {roleDeleting ? "Đang xóa..." : "Xóa vai trò"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={roleEditOpen} onOpenChange={(open) => { if (!roleSaving) setRoleEditOpen(open); }}>
        <DialogContent className="rounded-xs sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa vai trò</DialogTitle>
            <DialogDescription>Cập nhật tên và mô tả hiển thị của vai trò. Mã vai trò và quyền được gán sẽ được giữ nguyên.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="role-edit-name" className="text-sm font-medium text-slate-700">Tên vai trò</label>
              <Input
                id="role-edit-name"
                autoFocus
                maxLength={80}
                value={roleEditName}
                onChange={(event) => setRoleEditName(event.target.value)}
                className="h-10 rounded-xs border-slate-200 bg-white px-3 shadow-none focus-visible:ring-1 focus-visible:ring-[#6941c6]"
                disabled={roleSaving}
              />
              <p className="text-xs text-slate-500">Từ 2 đến 80 ký tự.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="role-edit-description" className="text-sm font-medium text-slate-700">Mô tả</label>
              <textarea
                id="role-edit-description"
                rows={4}
                maxLength={240}
                value={roleEditDescription}
                onChange={(event) => setRoleEditDescription(event.target.value)}
                className="w-full resize-y rounded-xs border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-800 shadow-none outline-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#6941c6] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={roleSaving}
              />
              <p className="text-right text-xs text-slate-500">{roleEditDescription.length}/240</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className={outlineBtn} onClick={() => setRoleEditOpen(false)} disabled={roleSaving}>Hủy</Button>
            <Button type="button" className={primaryBtn} onClick={() => void saveRole()} disabled={roleSaving || roleEditName.trim().length < 2}>
              {roleSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addMemberOpen} onOpenChange={(open) => { setAddMemberOpen(open); if (!open) setMembersToAdd(new Set()); }}>
            <DialogContent className="rounded-xs sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm nhân viên vào vai trò</DialogTitle>
            <DialogDescription>Chọn nhân viên cần gán vào vai trò {selected.name}.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#66769a]" strokeWidth={1.75} />
              <Input value={addMemberQuery} onChange={(event) => setAddMemberQuery(event.target.value)} placeholder="Tìm theo tên hoặc email..." className={cn("h-9", inputCls)} />
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {filteredAvailableMembers.map((member) => {
              const checked = membersToAdd.has(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setMembersToAdd((current) => {
                    const next = new Set(current);
                    if (next.has(member.id)) next.delete(member.id);
                    else next.add(member.id);
                    return next;
                  })}
                    className="flex w-full items-center gap-3 rounded-xs px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded-xs border text-white", checked ? "border-[#6941c6] bg-[#6941c6]" : "border-slate-300 bg-white")}>
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  {member.avatarUrl
                    ? <img src={member.avatarUrl} alt={member.name} className="size-10 shrink-0 rounded-full object-cover" />
                    : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">{member.initials}</span>}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-semibold", INK)}>{member.name}</span>
                    <span className={cn("block truncate text-xs", MUTED)}>{member.email}</span>
                  </span>
                  {member.roleNames.length > 0 && <span className="max-w-[150px] truncate text-xs text-slate-400">{member.roleNames.join(", ")}</span>}
                </button>
              );
            })}
            {!filteredAvailableMembers.length && <p className="py-8 text-center text-sm text-slate-500">Không còn nhân viên phù hợp để thêm.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className={outlineBtn} onClick={() => setAddMemberOpen(false)}>Hủy</Button>
            <Button disabled={memberSaving || membersToAdd.size === 0} className={primaryBtn} onClick={() => void saveAddedMembers()}>
              {memberSaving ? "Đang lưu..." : `Thêm ${membersToAdd.size ? `${membersToAdd.size} ` : ""}nhân viên`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(dependencyPrompt)} onOpenChange={(open) => { if (!open) setDependencyPrompt(null); }}>
            <DialogContent className="sm:max-w-md rounded-xs">
          <DialogHeader>
            <DialogTitle>Cần cấp thêm quyền phụ thuộc</DialogTitle>
            <DialogDescription>
              Để bật quyền <strong>{dependencyPrompt?.permissionLabel}</strong>, vai trò này cần thêm các quyền sau:
            </DialogDescription>
          </DialogHeader>
            <div className="space-y-2 rounded-xs border border-slate-200 bg-slate-50 p-3">
            {dependencyPrompt?.required.map((permission) => (
              <div key={permission.code} className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <span className="grid size-5 place-items-center rounded-full bg-[#6941c6] text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span>{permission.description || permissionLabelByCode[permission.code] || permission.code}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" className={outlineBtn} onClick={() => setDependencyPrompt(null)}>Hủy</Button>
            <Button
              className={primaryBtn}
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
