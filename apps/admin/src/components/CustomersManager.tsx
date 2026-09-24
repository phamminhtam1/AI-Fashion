import { ChevronLeft, Package, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { adminApi, type Customer, type CustomerSegment } from "@/lib/api";

const SEGMENTS: Array<{ id: CustomerSegment | "all"; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "new", label: "Mới" },
  { id: "loyal", label: "Thân thiết" },
  { id: "vip", label: "VIP" },
];

const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  new: "Mới",
  loyal: "Thân thiết",
  vip: "VIP",
};

const switchClass =
  "h-7 w-12 border-0 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-zinc-300 [&>span]:h-6 [&>span]:w-6 data-[state=checked]:[&>span]:translate-x-5";

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "₫";
}

function formatAddress(a: {
  address_line: string;
  administrative_units: Record<string, string>;
}) {
  const city = a.administrative_units?.city;
  return [a.address_line, city].filter(Boolean).join(" · ");
}

export function CustomersManager() {
  const [items, setItems] = useState<Customer[]>([]);
  const [metricItems, setMetricItems] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<CustomerSegment | "all">("all");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.customers({
        segment: segment === "all" ? undefined : segment,
        q: query.trim() || undefined,
      });
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được khách hàng");
    } finally {
      setLoading(false);
    }
  }, [segment, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    adminApi
      .customers()
      .then((r) => setMetricItems(r.items))
      .catch(() => undefined);
  }, [items]);

  const globalMetrics = useMemo(
    () => ({
      total: metricItems.length,
      vip: metricItems.filter((c) => c.segment === "vip").length,
      loyal: metricItems.filter((c) => c.segment === "loyal").length,
      newCount: metricItems.filter((c) => c.segment === "new").length,
    }),
    [metricItems],
  );

  const segmentSeries = useMemo(() => {
    const keys: CustomerSegment[] = ["new", "loyal", "vip"];
    return keys.map((key) => ({
      key,
      label: SEGMENT_LABEL[key],
      count: metricItems.filter((c) => c.segment === key).length,
    }));
  }, [metricItems]);

  const maxSeg = Math.max(1, ...segmentSeries.map((s) => s.count));

  async function openDetail(c: Customer) {
    setDetailLoading(true);
    setDetail(c);
    try {
      const full = await adminApi.customer(c.id);
      setDetail(full);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được chi tiết");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleStatus(c: Customer, active: boolean) {
    const next = active ? "active" : "blocked";
    setItems((list) => list.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    setMetricItems((list) => list.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    setDetail((d) => (d && d.id === c.id ? { ...d, status: next } : d));
    try {
      await adminApi.updateCustomer(c.id, { status: next });
      toast.success(active ? "Đã mở hoạt động" : "Đã khóa khách hàng");
    } catch (e) {
      setItems((list) => list.map((x) => (x.id === c.id ? { ...x, status: c.status } : x)));
      setMetricItems((list) => list.map((x) => (x.id === c.id ? { ...x, status: c.status } : x)));
      setDetail((d) => (d && d.id === c.id ? { ...d, status: c.status } : d));
      toast.error(e instanceof Error ? e.message : "Không đổi được trạng thái");
    }
  }

  if (detail) {
    const orders = detail.orders ?? [];
    const addresses = detail.addresses ?? [];
    return (
      <>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setDetail(null)}>
              <ChevronLeft className="size-4" /> Quay lại danh sách
            </Button>
            <h2 className="mt-2 font-serif text-2xl">{detail.full_name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Phân khúc theo đã chi · chỉ xem hồ sơ
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border px-4 py-3">
            <Switch
              checked={detail.status === "active"}
              onCheckedChange={(on) => void toggleStatus(detail, on)}
              aria-label="Trạng thái khách hàng"
              className={switchClass}
            />
            <span className="text-sm font-medium">
              {detail.status === "active" ? "Đang hoạt động" : "Đã khóa"}
            </span>
          </div>
        </div>

        {detailLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Đang tải chi tiết…</p>
        ) : (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-md border border-border p-5">
              <p className="section-label">Hồ sơ</p>
              <dl className="mt-4 space-y-3 text-sm">
                {(
                  [
                    ["Họ tên", detail.full_name],
                    ["Điện thoại", detail.phone || "—"],
                    ["Email", detail.email || "—"],
                    ["Đã chi", formatVnd(detail.total_spent_vnd ?? 0)],
                    ["Phân khúc", SEGMENT_LABEL[detail.segment] ?? detail.segment],
                    [
                      "Ngày tạo",
                      detail.created_at
                        ? new Date(detail.created_at).toLocaleString("vi-VN")
                        : "—",
                    ],
                    ["Ghi chú nội bộ", detail.internal_note?.trim() || "—"],
                  ] as Array<[string, string]>
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-6 border-b border-border/70 pb-3 last:border-0"
                  >
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="max-w-[60%] text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[11px] text-muted-foreground">
                &lt;15tr Mới · 15–50tr Thân thiết · &gt;50tr VIP
              </p>
            </article>

            <article className="rounded-md border border-border p-5">
              <p className="section-label">Địa chỉ giao hàng</p>
              {addresses.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Khách chưa lưu địa chỉ.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {addresses.map((a) => (
                    <li key={a.id} className="rounded-md border border-border/80 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{a.recipient_name}</p>
                        {a.is_default ? (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                            Mặc định
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-muted-foreground">{a.phone}</p>
                      <p className="mt-1">{formatAddress(a)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="col-span-full rounded-md border border-border p-5">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-muted-foreground" />
                <p className="section-label !mt-0">Đơn hàng đã mua</p>
              </div>
              {orders.length === 0 ? (
                <div className="mt-6 grid place-items-center rounded-md border border-dashed border-border py-12 text-center">
                  <p className="text-sm font-medium">Chưa có đơn hàng</p>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Khi có module đơn, tổng đã chi và phân khúc sẽ cập nhật theo đơn hoàn tất.
                  </p>
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-secondary/55">
                      <tr>
                        {["Mã đơn", "Ngày đặt", "Trạng thái", "Tổng tiền"].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} className="border-t border-border">
                          <td className="px-3 py-3 font-medium">{o.order_number}</td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {new Date(o.placed_at).toLocaleString("vi-VN")}
                          </td>
                          <td className="px-3 py-3">{o.status}</td>
                          <td className="px-3 py-3">{formatVnd(o.grand_total_vnd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <div className="mt-7">
        <p className="section-label text-primary">Quan hệ khách hàng</p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Phân khúc tự động theo đã chi (&lt;15tr Mới · 15–50tr Thân thiết · &gt;50tr VIP). Bấm dòng để xem
          chi tiết.
        </p>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Tổng khách", value: globalMetrics.total, note: "Trong hệ thống" },
          { label: "VIP", value: globalMetrics.vip, note: "> 50 triệu" },
          { label: "Thân thiết", value: globalMetrics.loyal, note: "15–50 triệu" },
          { label: "Mới", value: globalMetrics.newCount, note: "< 15 triệu" },
        ].map((m, i) => (
          <div
            key={m.label}
            className={cn("rounded-md border p-5", i === 0 ? "border-accent bg-accent/25" : "border-border")}
          >
            <p className="section-label">{m.label}</p>
            <p className="mt-3 font-serif text-3xl">{m.value}</p>
            <p className={cn("mt-1 text-xs", i === 0 ? "text-primary" : "text-muted-foreground")}>
              {m.note}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-md border border-border p-5">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="font-serif text-xl">Phân bố phân khúc</h2>
        </div>
        <div className="mt-4 space-y-3">
          {segmentSeries.map((s) => (
            <div key={s.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground">{s.count}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${(s.count / maxSeg) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {SEGMENTS.map((t) => (
              <Button
                key={t.id}
                variant={segment === t.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setSegment(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              placeholder="Tìm tên, SĐT, email…"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-secondary/55">
              <tr>
                {["Khách hàng", "Phân khúc", "Đã chi", "Liên hệ", "Địa chỉ", "Trạng thái"].map((c) => (
                  <th
                    key={c}
                    className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Đang tải…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Không có khách hàng.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-secondary/35"
                    onClick={() => void openDetail(c)}
                  >
                    <td className="px-4 py-3.5 font-medium">{c.full_name}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {SEGMENT_LABEL[c.segment] ?? c.segment}
                    </td>
                    <td className="px-4 py-3.5 font-medium tabular-nums">
                      {formatVnd(c.total_spent_vnd ?? 0)}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      <div>{c.phone || "—"}</div>
                      {c.email ? <div className="text-xs">{c.email}</div> : null}
                    </td>
                    <td className="max-w-xs px-4 py-3.5 text-muted-foreground">
                      {c.default_address || "—"}
                    </td>
                    <td
                      className="px-4 py-3.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={c.status === "active"}
                          onCheckedChange={(on) => void toggleStatus(c, on)}
                          aria-label={`Trạng thái ${c.full_name}`}
                          className={switchClass}
                        />
                        <span className="text-xs text-muted-foreground">
                          {c.status === "active" ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Hiển thị {items.length} mục · bấm dòng để xem chi tiết
        </div>
      </section>
    </>
  );
}
