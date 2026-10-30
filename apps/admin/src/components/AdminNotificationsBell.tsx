import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Bell, CheckCheck, Clock3, CreditCard, LoaderCircle, Package, ShoppingBag } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { adminApi, type AdminNotification } from "@/lib/api";
import { cn } from "@/lib/utils";

const iconByKind = {
  new_order: ShoppingBag,
  payment_success: CreditCard,
  low_stock: Package,
} as const;

const toneByKind = {
  new_order: "bg-violet-50 text-violet-700",
  payment_success: "bg-emerald-50 text-emerald-700",
  low_stock: "bg-amber-50 text-amber-700",
} as const;

function timeAgo(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Vừa cập nhật";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return new Date(timestamp).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function readIds(storageKey: string) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function AdminNotificationsBell({ permissions, accountId }: { permissions: string[]; accountId: string }) {
  const canRead = permissions.includes("*") || permissions.includes("order.read") || permissions.includes("inventory.read");
  const storageKey = `admin-notifications-read:${accountId}`;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [read, setRead] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setRead(readIds(storageKey));
  }, [storageKey]);

  const refresh = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const response = await adminApi.notifications();
      setItems(response.items);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    if (!canRead) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [canRead, refresh]);

  const unread = useMemo(() => items.filter((item) => !read.has(item.id)), [items, read]);

  function markRead(id: string) {
    setRead((current) => {
      const next = new Set(current).add(id);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next].slice(-300)));
      } catch {
        // Keep this session's read state even if browser storage is unavailable.
      }
      return next;
    });
  }

  function markAllRead() {
    setRead((current) => {
      const next = new Set([...current, ...items.map((item) => item.id)]);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next].slice(-300)));
      } catch {
        // Keep this session's read state even if browser storage is unavailable.
      }
      return next;
    });
  }

  function openNotification(item: AdminNotification) {
    markRead(item.id);
    setOpen(false);
    if (item.order_number) {
      navigate({ to: `/donhang/${item.order_number}` });
    } else if (item.kind === "low_stock") {
      navigate({ to: "/khohang" });
    }
  }

  if (!canRead) return null;

  return (
    <DropdownMenu open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) void refresh();
    }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread.length ? `Thông báo, ${unread.length} chưa đọc` : "Thông báo"}
          className="relative flex size-9 items-center justify-center rounded-xs border border-slate-200/80 bg-white text-slate-600 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <Bell className="size-4" />
          {unread.length > 0 && (
            <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-sm border-slate-200 p-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Thông báo</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{unread.length ? `${unread.length} mục chưa đọc` : "Đã cập nhật gần đây"}</p>
          </div>
          <button
            type="button"
            disabled={!unread.length}
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-xs px-2 py-1.5 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:pointer-events-none disabled:opacity-40"
          >
            <CheckCheck className="size-3.5" /> Đánh dấu đã đọc
          </button>
        </div>
        <div className="max-h-[min(420px,65vh)] overflow-y-auto p-1.5">
          {loading && !items.length ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải thông báo…</div>
          ) : loadError && !items.length ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-slate-600">Không tải được thông báo.</p>
              <button type="button" onClick={() => void refresh()} className="mt-2 text-xs font-medium text-violet-700 hover:underline">Thử lại</button>
            </div>
          ) : items.length ? items.map((item) => {
            const Icon = iconByKind[item.kind];
            const isUnread = !read.has(item.id);
            return (
              <DropdownMenuItem
                key={item.id}
                onSelect={(event) => { event.preventDefault(); openNotification(item); }}
                className="flex cursor-pointer items-start gap-3 rounded-xs px-2.5 py-3 focus:bg-slate-50"
              >
                <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", toneByKind[item.kind])}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-800">{item.title}</span>
                    {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-violet-600" />}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">{item.message}</span>
                  <span className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400"><Clock3 className="size-3" />{timeAgo(item.created_at)}</span>
                </span>
              </DropdownMenuItem>
            );
          }) : (
            <div className="flex flex-col items-center px-5 py-9 text-center">
              <span className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-400"><AlertTriangle className="size-4" /></span>
              <p className="mt-3 text-xs font-medium text-slate-700">Chưa có thông báo mới</p>
              <p className="mt-1 text-[11px] text-slate-500">Đơn hàng mới và cảnh báo tồn kho sẽ xuất hiện ở đây.</p>
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">Tự động cập nhật mỗi phút</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
