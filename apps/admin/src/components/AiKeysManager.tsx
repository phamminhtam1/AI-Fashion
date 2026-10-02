import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { adminApi, type AiApiKey, type CreateAiKeyInput } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AiKeysManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [keys, setKeys] = useState<AiApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAiKeyInput>({
    provider: "kie",
    label: "",
    rawKey: "",
    priority: 1,
  });
  const [showRawKey, setShowRawKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    credits?: number;
    error?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.aiKeys();
      setKeys(res.items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Không thể tải danh sách AI Key: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Handle Refresh Credits for single key
  const handleRefreshKey = async (id: string) => {
    try {
      setRefreshingId(id);
      const updated = await adminApi.refreshAiKeyCredits(id);
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, ...updated } : k)));
      toast.success(
        `Đã cập nhật số dư cho '${updated.label}': ${updated.creditsRemaining ?? 0} credits`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Không thể kiểm tra số dư: " + msg);
    } finally {
      setRefreshingId(null);
    }
  };

  // Handle Refresh All Credits
  const handleRefreshAll = async () => {
    try {
      setRefreshingAll(true);
      const res = await adminApi.refreshAllAiKeyCredits();
      if (res.items) {
        setKeys(res.items);
      } else {
        await fetchKeys();
      }
      toast.success("Đã đồng bộ số dư tất cả AI Key!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Không thể đồng bộ số dư: " + msg);
    } finally {
      setRefreshingAll(false);
    }
  };

  // Handle Quick Status Toggle
  const handleToggleStatus = async (key: AiApiKey) => {
    const nextStatus = key.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      const updated = await adminApi.updateAiKey(key.id, { status: nextStatus });
      setKeys((prev) => prev.map((k) => (k.id === key.id ? { ...k, ...updated } : k)));
      toast.success(
        nextStatus === "ACTIVE"
          ? `Đã kích hoạt key '${key.label}'`
          : `Đã tạm dừng key '${key.label}'`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Không thể đổi trạng thái: " + msg);
    }
  };

  // Handle Test Key inside Modal
  const handleTestRawKey = async () => {
    if (!createForm.rawKey.trim()) {
      toast.error("Vui lòng dán chuỗi API Key vào ô trước khi kiểm tra");
      return;
    }
    try {
      setTestingKey(true);
      setTestResult(null);
      const res = await adminApi.testAiKey(createForm.rawKey.trim());
      setTestResult({
        tested: true,
        ok: res.ok,
        credits: res.credits,
        error: res.error,
      });
      if (res.ok) {
        toast.success(`Key hợp lệ! Số dư hiện tại: ${res.credits ?? 0} credits`);
      } else {
        toast.error(res.error || "Key không hợp lệ");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        tested: true,
        ok: false,
        error: msg,
      });
      toast.error("Lỗi kiểm tra key: " + msg);
    } finally {
      setTestingKey(false);
    }
  };

  // Handle Create Key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.label.trim()) {
      toast.error("Vui lòng nhập tên/nhãn gợi nhớ cho Key");
      return;
    }
    if (!createForm.rawKey.trim()) {
      toast.error("Vui lòng nhập chuỗi API Key");
      return;
    }

    try {
      setSubmitting(true);
      const created = await adminApi.createAiKey({
        provider: createForm.provider,
        label: createForm.label.trim(),
        rawKey: createForm.rawKey.trim(),
        priority: Number(createForm.priority || 1),
      });

      setKeys((prev) => [created, ...prev]);
      toast.success(`Thêm key '${created.label}' thành công!`);
      setCreateOpen(false);
      setCreateForm({ provider: "kie", label: "", rawKey: "", priority: 1 });
      setTestResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Lỗi khi thêm key: " + msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Key with confirm dialog
  const handleDeleteKey = async (id: string, label: string) => {
    const ok = await confirm({
      title: "Xác nhận xóa API Key",
      description: `Bạn có chắc chắn muốn xóa API Key "${label}" khỏi hệ thống? Khóa này sẽ không thể dùng để xoay vòng nữa.`,
      destructive: true,
      confirmLabel: "Xóa khóa",
      cancelLabel: "Hủy",
    });
    if (!ok) return;

    try {
      await adminApi.deleteAiKey(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("Đã xóa API Key");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Không thể xóa key: " + msg);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = keys.length;
    const active = keys.filter((k) => k.status === "ACTIVE").length;
    const exhausted = keys.filter((k) => k.status === "EXHAUSTED").length;
    const rateLimited = keys.filter((k) => k.status === "RATE_LIMITED").length;
    const totalCredits = keys
      .filter((k) => k.status === "ACTIVE")
      .reduce((sum, k) => sum + (k.creditsRemaining ?? 0), 0);

    return { total, active, exhausted, rateLimited, totalCredits };
  }, [keys]);

  // Filtered keys
  const filteredKeys = useMemo(() => {
    return keys.filter((k) => {
      const matchSearch =
        k.label.toLowerCase().includes(search.toLowerCase()) ||
        k.maskedKey.toLowerCase().includes(search.toLowerCase()) ||
        k.provider.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "all" || k.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [keys, search, statusFilter]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã sao chép vào bộ nhớ tạm");
  };

  return (
    <div className="space-y-6 mt-6">

      {/* Metric Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Tổng số Key",
            value: String(metrics.total),
            note: "Đã cấu hình trong DB",
            accent: true,
          },
          {
            label: "Đang hoạt động",
            value: String(metrics.active),
            note: "Sẵn sàng phục vụ khách",
            accent: false,
          },
          {
            label: "Credit khả dụng",
            value: String(metrics.totalCredits),
            note: "Trên các key ACTIVE",
            accent: false,
          },
          {
            label: "Hết lượt / Cần nạp",
            value: String(metrics.exhausted),
            note: metrics.exhausted > 0 ? "Cần đăng ký thêm tài khoản" : "Tất cả đều ổn",
            accent: false,
          },
        ].map((m, i) => (
          <div
            key={m.label}
            className={cn(
              "rounded-md border p-5",
              m.accent || i === 0 ? "border-accent bg-accent/25" : "border-border",
            )}
          >
            <p className="section-label">{m.label}</p>
            <p className="mt-3 font-serif text-3xl font-normal">{m.value}</p>
            <p
              className={cn(
                "mt-1 text-xs",
                m.accent || i === 0 ? "text-primary" : "text-muted-foreground",
              )}
            >
              {m.note}
            </p>
          </div>
        ))}
      </section>

      {/* Action Bar & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên tài khoản hoặc key..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Lọc trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="ACTIVE">Hoạt động (Active)</SelectItem>
              <SelectItem value="RATE_LIMITED">Nghẽn (429)</SelectItem>
              <SelectItem value="EXHAUSTED">Hết credit</SelectItem>
              <SelectItem value="REVOKED">Key sai / Lỗi</SelectItem>
              <SelectItem value="DISABLED">Đã tắt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={refreshingAll || loading}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={cn("size-3.5", refreshingAll && "animate-spin")} />
            Đồng bộ số dư tất cả
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setCreateForm({ provider: "kie", label: "", rawKey: "", priority: 1 });
              setTestResult(null);
              setCreateOpen(true);
            }}
            className="h-9 gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            Thêm API Key mới
          </Button>
        </div>
      </div>

      {/* Table Content */}
      <div className="rounded-lg border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-sm text-muted-foreground gap-3">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span>Đang tải danh sách AI Key từ cơ sở dữ liệu...</span>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground gap-2">
            <Bot className="size-8 text-muted-foreground/60 mb-1" />
            <p className="font-medium text-foreground">Chưa có API Key nào</p>
            <p className="text-xs max-w-sm">
              Bạn có thể thêm các API Key Kie.ai (hoặc AI Provider khác) để hệ thống tự động xoay
              vòng phục vụ tính năng Thử đồ ảo.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="mt-3 gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              Thêm khóa đầu tiên
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tài khoản / Nhà cung cấp</th>
                  <th className="py-3 px-4">API Key (Đã mã hóa & Masked)</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-center">Credit còn lại</th>
                  <th className="py-3 px-4 text-center">Ưu tiên</th>
                  <th className="py-3 px-4 text-center">Thành công</th>
                  <th className="py-3 px-4">Lần cuối dùng</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredKeys.map((key) => {
                  const isRefreshing = refreshingId === key.id;
                  const isExhausted = key.status === "EXHAUSTED" || (key.creditsRemaining ?? 1) <= 0;

                  return (
                    <tr
                      key={key.id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        key.status === "DISABLED" && "opacity-60",
                      )}
                    >
                      {/* Name & Provider */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground flex items-center gap-1.5">
                          <span>{key.label}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="uppercase font-semibold tracking-wider text-primary">
                            {key.provider}
                          </span>
                          <span>•</span>
                          <span>{new Date(key.createdAt).toLocaleDateString("vi-VN")}</span>
                        </div>
                      </td>

                      {/* Masked Key */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 border border-border/40">
                          <span>{key.maskedKey}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(key.maskedKey)}
                            title="Sao chép gợi ý key"
                            className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                        {key.lastErrorMessage && (
                          <p
                            className="mt-1 text-[10px] text-rose-500 max-w-xs truncate"
                            title={key.lastErrorMessage}
                          >
                            Lỗi: {key.lastErrorMessage}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {key.status === "ACTIVE" ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-[10px] font-medium"
                          >
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Đang dùng
                          </Badge>
                        ) : key.status === "RATE_LIMITED" ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 text-[10px] font-medium"
                          >
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            Nghẽn 429 (Chờ)
                          </Badge>
                        ) : key.status === "EXHAUSTED" ? (
                          <Badge
                            variant="outline"
                            className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 gap-1 text-[10px] font-medium"
                          >
                            <span className="size-1.5 rounded-full bg-rose-500" />
                            Hết credit (0)
                          </Badge>
                        ) : key.status === "REVOKED" ? (
                          <Badge
                            variant="outline"
                            className="border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 gap-1 text-[10px] font-medium"
                          >
                            Key bị sai / Khóa
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-zinc-500/30 bg-zinc-500/10 text-zinc-500 gap-1 text-[10px] font-medium"
                          >
                            Tạm tắt
                          </Badge>
                        )}
                      </td>

                      {/* Credits Remaining with quick refresh */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {key.creditsRemaining !== null ? (
                            <span
                              className={cn(
                                "font-mono font-semibold text-xs px-2 py-0.5 rounded",
                                isExhausted
                                  ? "bg-rose-500/10 text-rose-600"
                                  : key.creditsRemaining < 15
                                    ? "bg-amber-500/10 text-amber-600"
                                    : "bg-emerald-500/10 text-emerald-600",
                              )}
                            >
                              {key.creditsRemaining}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRefreshKey(key.id)}
                            disabled={isRefreshing}
                            title="Kiểm tra lại số dư từ Kie.ai"
                            className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-muted"
                          >
                            <RefreshCw
                              className={cn("size-3", isRefreshing && "animate-spin text-primary")}
                            />
                          </button>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono text-muted-foreground">P{key.priority}</span>
                      </td>

                      {/* Success Count */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-foreground">{key.successCount}</span>
                        {key.errorCount > 0 && (
                          <span className="text-[10px] text-rose-500 ml-1">
                            ({key.errorCount} lỗi)
                          </span>
                        )}
                      </td>

                      {/* Last Used At */}
                      <td className="py-3 px-4 text-muted-foreground text-[11px]">
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })
                          : "Chưa dùng"}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Reset to ACTIVE if EXHAUSTED */}
                          {key.status !== "ACTIVE" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(key)}
                              className="h-7 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              Bật lại
                            </Button>
                          )}

                          {key.status === "ACTIVE" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(key)}
                              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              Tắt
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteKey(key.id, key.label)}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                            title="Xóa Key này"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security Best Practices Callout */}


      {/* Modal: Thêm API Key Mới */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleCreateKey}>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Thêm AI API Key Mới</DialogTitle>
              <DialogDescription className="text-xs">
                Key sẽ được kiểm tra kết nối với Kie.ai và mã hóa AES-256 trước khi lưu.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Provider */}
              <div className="space-y-1.5">
                <Label htmlFor="provider" className="text-xs font-medium">
                  Nhà cung cấp AI
                </Label>
                <Select
                  value={createForm.provider}
                  onValueChange={(val) => setCreateForm((prev) => ({ ...prev, provider: val }))}
                >
                  <SelectTrigger id="provider" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kie">Kie.ai (GPT Image 2.5 Sunburst Try-On)</SelectItem>
                    <SelectItem value="openai">OpenAI (Vision Classification)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Label */}
              <div className="space-y-1.5">
                <Label htmlFor="label" className="text-xs font-medium">
                  Tên gợi nhớ / Tài khoản
                </Label>
                <Input
                  id="label"
                  placeholder="Ví dụ: Kie Free 01 (tam@gmail.com)"
                  value={createForm.label}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, label: e.target.value }))}
                  required
                  className="h-9 text-xs"
                />
              </div>

              {/* Raw API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rawKey" className="text-xs font-medium">
                    Chuỗi API Key
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowRawKey(!showRawKey)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showRawKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    <span>{showRawKey ? "Ẩn" : "Hiện"}</span>
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="rawKey"
                    type={showRawKey ? "text" : "password"}
                    placeholder="Dán chuỗi API Key của bạn vào đây..."
                    value={createForm.rawKey}
                    onChange={(e) => {
                      setCreateForm((prev) => ({ ...prev, rawKey: e.target.value }));
                      setTestResult(null);
                    }}
                    required
                    className="h-9 text-xs font-mono pr-20"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleTestRawKey}
                    disabled={testingKey || !createForm.rawKey.trim()}
                    className="absolute right-1 top-1 h-7 text-[10px] px-2"
                  >
                    {testingKey ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      "Check số dư"
                    )}
                  </Button>
                </div>

                {/* Inline Test Result Box */}
                {testResult?.tested && (
                  <div
                    className={cn(
                      "mt-2 rounded p-2.5 text-xs flex items-start gap-2 border",
                      testResult.ok
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300",
                    )}
                  >
                    {testResult.ok ? (
                      <>
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                        <div>
                          <p className="font-medium">Khóa API hợp lệ!</p>
                          <p className="text-[11px] mt-0.5 opacity-90">
                            Số dư khả dụng hiện tại:{" "}
                            <strong>{testResult.credits ?? 0} credits</strong>. Hệ thống sẽ kích
                            hoạt key này ngay sau khi lưu.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
                        <div>
                          <p className="font-medium">Kiểm tra thất bại</p>
                          <p className="text-[11px] mt-0.5 opacity-90">
                            {testResult.error || "Key không hợp lệ hoặc đã bị khóa."}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-xs font-medium">
                  Độ ưu tiên (Priority)
                </Label>
                <Input
                  id="priority"
                  type="number"
                  min="1"
                  max="10"
                  value={createForm.priority}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, priority: Number(e.target.value) }))
                  }
                  className="h-9 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Số càng lớn càng được ưu tiên bốc ra sử dụng trước (Mặc định: 1).
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="h-9 text-xs"
              >
                Hủy
              </Button>
              <Button type="submit" disabled={submitting} className="h-9 text-xs gap-1.5">
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                Lưu và Kích hoạt
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      {confirmDialog}
    </div>
  );
}
