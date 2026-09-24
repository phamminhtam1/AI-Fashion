import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminApi,
  type InventoryDocumentDetail,
  type InventoryDocumentListItem,
  type InventoryItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "all" | "low" | "out" | "docs";
type View = "list" | "form";
type DocType = "receipt" | "issue" | "adjustment";

type CatalogVariant = {
  id: string;
  color: string;
  size: string;
  sku: string;
  available: number;
};

type CatalogProduct = {
  id: string;
  name: string;
  variants: CatalogVariant[];
};

type LineDraft = {
  product_id: string;
  variant_id: string;
  qty: string;
  direction: "in" | "out";
};

function isLow(row: InventoryItem) {
  return row.available <= row.reorder_point;
}
function isOut(row: InventoryItem) {
  return row.available === 0;
}

function matrixAxes(product: CatalogProduct) {
  const colors: string[] = [];
  const sizes: string[] = [];
  for (const v of product.variants) {
    if (!colors.includes(v.color)) colors.push(v.color);
    if (!sizes.includes(v.size)) sizes.push(v.size);
  }
  colors.sort((a, b) => a.localeCompare(b, "vi"));
  sizes.sort((a, b) => a.localeCompare(b, "vi"));
  const byKey = new Map(product.variants.map((v) => [`${v.color}||${v.size}`, v]));
  return { colors, sizes, byKey };
}

const TYPE_LABEL: Record<DocType, string> = {
  receipt: "Nhập kho",
  issue: "Xuất kho",
  adjustment: "Điều chỉnh",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  approved: "Đã duyệt",
  posted: "Đã ghi sổ",
  void: "Đã hủy",
};

export function InventoryManager({
  seedProduct,
  onSeedConsumed,
}: {
  seedProduct?: { productId: string; productName?: string } | null;
  onSeedConsumed?: () => void;
} = {}) {
  const [view, setView] = useState<View>("list");
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [docs, setDocs] = useState<InventoryDocumentListItem[]>([]);
  const [warehouseLabel, setWarehouseLabel] = useState("MAIN");
  const [loading, setLoading] = useState(true);

  const [compose, setCompose] = useState(true);
  const [editingDoc, setEditingDoc] = useState<InventoryDocumentDetail | null>(null);
  const [formType, setFormType] = useState<DocType>("receipt");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [matrixProductId, setMatrixProductId] = useState("");
  const [matrixQty, setMatrixQty] = useState<Record<string, string>>({});
  const [matrixDirection, setMatrixDirection] = useState<"in" | "out">("in");
  const [saving, setSaving] = useState(false);

  const loadStock = useCallback(async () => {
    const res = await adminApi.inventory();
    setItems(res.items);
    setWarehouseLabel(res.warehouse.code);
  }, []);

  const loadDocs = useCallback(async () => {
    const res = await adminApi.inventoryDocuments();
    setDocs(res.items);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadStock(), loadDocs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tải kho thất bại");
    } finally {
      setLoading(false);
    }
  }, [loadStock, loadDocs]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const metrics = useMemo(
    () => [
      { label: "SKU theo dõi", value: String(items.length), note: `Kho ${warehouseLabel}` },
      { label: "Sắp hết", value: String(items.filter(isLow).length), note: "≤ mức tồn tối thiểu" },
      {
        label: "Phiếu chờ",
        value: String(docs.filter((d) => d.status === "draft" || d.status === "approved").length),
        note: "Nháp hoặc đã duyệt",
      },
    ],
    [items, docs, warehouseLabel],
  );

  const filteredStock = useMemo(() => {
    let rows = items;
    if (tab === "low") rows = rows.filter(isLow);
    if (tab === "out") rows = rows.filter(isOut);
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.product_name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.color_name.toLowerCase().includes(q) ||
        r.size_label.toLowerCase().includes(q),
    );
  }, [items, tab, query]);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.code.toLowerCase().includes(q) ||
        d.reason.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q) ||
        d.status.toLowerCase().includes(q),
    );
  }, [docs, query]);

  function backToList() {
    setView("list");
    setEditingDoc(null);
    setCompose(true);
    setMatrixProductId("");
    setMatrixQty({});
  }

  const filteredCatalog = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.variants.some(
          (v) =>
            v.sku.toLowerCase().includes(q) ||
            v.color.toLowerCase().includes(q) ||
            v.size.toLowerCase().includes(q),
        ),
    );
  }, [catalog, productQuery]);

  const matrixProduct = useMemo(
    () => catalog.find((p) => p.id === matrixProductId) ?? null,
    [catalog, matrixProductId],
  );

  function selectMatrixProduct(id: string) {
    setMatrixProductId(id);
    setMatrixQty({});
  }

  function addMatrixToLines() {
    if (!matrixProduct) {
      toast.error("Chọn sản phẩm trước");
      return;
    }
    const dir =
      formType === "receipt" ? "in" : formType === "issue" ? "out" : matrixDirection;
    const additions: LineDraft[] = [];
    for (const v of matrixProduct.variants) {
      const raw = matrixQty[v.id]?.trim();
      if (!raw) continue;
      const qty = Number(raw);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      additions.push({
        product_id: matrixProduct.id,
        variant_id: v.id,
        qty: String(qty),
        direction: dir,
      });
    }
    if (!additions.length) {
      toast.error("Nhập số lượng ít nhất một ô màu × size");
      return;
    }
    setLines((prev) => {
      const next = [...prev];
      for (const a of additions) {
        const i = next.findIndex((l) => l.variant_id === a.variant_id);
        if (i >= 0) {
          next[i] = {
            ...next[i]!,
            qty: String(Number(next[i]!.qty || 0) + Number(a.qty)),
            direction: a.direction,
          };
        } else {
          next.push(a);
        }
      }
      return next;
    });
    setMatrixQty({});
    toast.success(`Đã thêm ${additions.length} SKU vào phiếu`);
  }

  async function openCreate(opts?: { productId?: string; productName?: string }) {
    setCompose(true);
    setEditingDoc(null);
    setFormType("receipt");
    setReason(opts?.productName ? `Nhập kho · ${opts.productName}` : "");
    setProductQuery(opts?.productName ?? "");
    setView("form");
    try {
      // Prefer stock rows (have color/size/available); merge products API for any SKU missing.
      const byProduct = new Map<string, CatalogProduct>();
      for (const row of items) {
        const p = byProduct.get(row.product_id) ?? {
          id: row.product_id,
          name: row.product_name,
          variants: [],
        };
        if (!p.variants.some((v) => v.id === row.variant_id)) {
          p.variants.push({
            id: row.variant_id,
            color: row.color_name,
            size: row.size_label,
            sku: row.sku,
            available: row.available,
          });
        }
        byProduct.set(row.product_id, p);
      }
      const prods = await adminApi.products();
      for (const p of prods.items) {
        const entry = byProduct.get(p.id) ?? { id: p.id, name: p.name, variants: [] };
        for (const v of p.variants ?? []) {
          if (v.status === "archived" || v.status === "inactive") continue;
          if (entry.variants.some((x) => x.id === v.id)) continue;
          entry.variants.push({
            id: v.id,
            color: v.color?.name ?? v.color_name ?? "—",
            size: v.size?.label ?? v.size_label ?? "—",
            sku: v.sku,
            available: v.available ?? 0,
          });
        }
        byProduct.set(p.id, entry);
      }
      const list = [...byProduct.values()]
        .filter((p) => p.variants.length)
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));
      for (const p of list) {
        p.variants.sort((a, b) =>
          `${a.color} ${a.size}`.localeCompare(`${b.color} ${b.size}`, "vi"),
        );
      }
      setCatalog(list);

      if (opts?.productId) {
        const target = list.find((p) => p.id === opts.productId);
        if (target) {
          setMatrixProductId(target.id);
          setProductQuery(target.name);
        } else {
          setMatrixProductId("");
        }
      } else {
        setMatrixProductId("");
      }
      setMatrixQty({});
      setLines([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được biến thể");
      setLines([]);
    }
  }

  useEffect(() => {
    if (!seedProduct?.productId || loading) return;
    void openCreate({
      productId: seedProduct.productId,
      productName: seedProduct.productName,
    }).finally(() => onSeedConsumed?.());
    // openCreate reads latest items after load; seed is one-shot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedProduct?.productId, loading]);

  async function openDoc(id: string) {
    try {
      const detail = await adminApi.inventoryDocument(id);
      setCompose(false);
      setEditingDoc(detail);
      setView("form");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không mở được phiếu");
    }
  }

  async function createDraft() {
    const bodyLines = lines
      .filter((l) => l.variant_id && Number(l.qty) > 0)
      .map((l) => ({
        variant_id: l.variant_id,
        qty: Number(l.qty),
        direction:
          formType === "receipt" ? ("in" as const) : formType === "issue" ? ("out" as const) : l.direction,
      }));
    if (!bodyLines.length) {
      toast.error("Cần ít nhất một dòng hợp lệ");
      return;
    }
    setSaving(true);
    try {
      const created = await adminApi.createDoc({ type: formType, reason, lines: bodyLines });
      toast.success(`Đã tạo ${created.code}`);
      const detail = await adminApi.inventoryDocument(created.id);
      setCompose(false);
      setEditingDoc(detail);
      await loadDocs();
      await loadStock();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tạo phiếu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!editingDoc) return;
    setSaving(true);
    try {
      await adminApi.approveDoc(editingDoc.id);
      toast.success("Đã duyệt phiếu");
      const detail = await adminApi.inventoryDocument(editingDoc.id);
      setEditingDoc(detail);
      await loadDocs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duyệt thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function post() {
    if (!editingDoc) return;
    setSaving(true);
    try {
      await adminApi.postDoc(editingDoc.id, crypto.randomUUID());
      toast.success("Đã ghi sổ");
      const detail = await adminApi.inventoryDocument(editingDoc.id);
      setEditingDoc(detail);
      await loadDocs();
      await loadStock();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ghi sổ thất bại");
    } finally {
      setSaving(false);
    }
  }

  if (view === "form") {
    const status = editingDoc?.status;
    return (
      <>
        <nav className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <button type="button" className="hover:text-foreground hover:underline" onClick={backToList}>
            Kho hàng
          </button>
          <span aria-hidden>›</span>
          <span className="text-foreground">
            {compose ? "Tạo phiếu" : editingDoc?.code ?? "Phiếu"}
          </span>
        </nav>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="section-label text-primary">{compose ? "Tạo mới" : STATUS_LABEL[status ?? ""] ?? status}</p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl">
              {compose ? "Tạo phiếu kho" : editingDoc?.code}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {compose
                ? "Chọn sản phẩm → nhập số lượng trên lưới màu × size → thêm vào phiếu (nhiều SP trong một phiếu)."
                : editingDoc
                  ? `${TYPE_LABEL[editingDoc.type as DocType] ?? editingDoc.type} · ${STATUS_LABEL[editingDoc.status] ?? editingDoc.status}`
                  : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={backToList}>
              Quay lại
            </Button>
            {compose ? (
              <Button disabled={saving} onClick={createDraft}>
                {saving ? "Đang lưu…" : "Tạo phiếu"}
              </Button>
            ) : status === "draft" ? (
              <Button disabled={saving} onClick={approve}>
                {saving ? "Đang duyệt…" : "Duyệt"}
              </Button>
            ) : status === "approved" ? (
              <Button disabled={saving} onClick={post}>
                {saving ? "Đang ghi sổ…" : "Ghi sổ"}
              </Button>
            ) : null}
          </div>
        </div>

        <section className="mt-8 grid gap-8 border-t border-border pt-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            {compose ? (
              <>
                <label className="block">
                  <span className="text-xs font-medium">Loại phiếu</span>
                  <select
                    className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as DocType)}
                  >
                    <option value="receipt">Nhập kho</option>
                    <option value="issue">Xuất kho</option>
                    <option value="adjustment">Điều chỉnh</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium">Lý do</span>
                  <Input
                    className="mt-2"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ví dụ: Nhập lô mới / kiểm kê lệch"
                  />
                </label>

                <div className="space-y-3 rounded-md border border-border p-4">
                  <p className="text-xs font-medium">Lưới màu × size</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      placeholder="Lọc sản phẩm / SKU…"
                    />
                  </div>
                  <label className="block">
                    <span className="text-[11px] text-muted-foreground">Sản phẩm</span>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      value={matrixProductId}
                      onChange={(e) => selectMatrixProduct(e.target.value)}
                    >
                      <option value="">Chọn sản phẩm…</option>
                      {filteredCatalog.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.variants.length} SKU)
                        </option>
                      ))}
                    </select>
                  </label>
                  {formType === "adjustment" ? (
                    <label className="block">
                      <span className="text-[11px] text-muted-foreground">Chiều (áp dụng khi thêm lưới)</span>
                      <select
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                        value={matrixDirection}
                        onChange={(e) => setMatrixDirection(e.target.value as "in" | "out")}
                      >
                        <option value="in">Nhập (+)</option>
                        <option value="out">Xuất (−)</option>
                      </select>
                    </label>
                  ) : null}

                  {matrixProduct ? (
                    (() => {
                      const { colors, sizes, byKey } = matrixAxes(matrixProduct);
                      return (
                        <div className="overflow-x-auto rounded-md border border-border">
                          <table className="w-full min-w-[420px] text-sm">
                            <thead className="bg-secondary/55">
                              <tr>
                                <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                  Màu \ Size
                                </th>
                                {sizes.map((sz) => (
                                  <th
                                    key={sz}
                                    className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                                  >
                                    {sz}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {colors.map((color) => (
                                <tr key={color} className="border-t border-border">
                                  <td className="px-2 py-2 font-medium">{color}</td>
                                  {sizes.map((sz) => {
                                    const v = byKey.get(`${color}||${sz}`);
                                    if (!v) {
                                      return (
                                        <td key={sz} className="bg-secondary/20 px-1 py-1 text-center text-muted-foreground">
                                          —
                                        </td>
                                      );
                                    }
                                    return (
                                      <td key={sz} className="px-1 py-1">
                                        <Input
                                          className="h-9 w-full min-w-[4rem] px-2 text-center tabular-nums"
                                          type="number"
                                          min={0}
                                          placeholder={formType === "issue" ? String(v.available) : "0"}
                                          title={
                                            formType === "issue"
                                              ? `${v.sku} · còn ${v.available}`
                                              : v.sku
                                          }
                                          value={matrixQty[v.id] ?? ""}
                                          onChange={(e) =>
                                            setMatrixQty((q) => ({ ...q, [v.id]: e.target.value }))
                                          }
                                        />
                                        {formType === "issue" ? (
                                          <p className="mt-0.5 text-center text-[10px] text-muted-foreground">
                                            còn {v.available}
                                          </p>
                                        ) : null}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-sm text-muted-foreground">Chọn sản phẩm để hiện lưới màu × size.</p>
                  )}

                  <Button type="button" variant="outline" disabled={!matrixProduct} onClick={addMatrixToLines}>
                    Thêm vào phiếu
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">Dòng trên phiếu ({lines.length})</p>
                    {lines.length ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setLines([])}>
                        Xóa hết
                      </Button>
                    ) : null}
                  </div>
                  {lines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có dòng — nhập lưới rồi bấm Thêm vào phiếu.</p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/55 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Sản phẩm</th>
                            <th className="px-3 py-2 text-left">SKU</th>
                            <th className="px-3 py-2 text-right">SL</th>
                            {formType === "adjustment" ? (
                              <th className="px-3 py-2 text-left">Chiều</th>
                            ) : null}
                            <th className="w-14" />
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line, idx) => {
                            const p = catalog.find((x) => x.id === line.product_id);
                            const v = p?.variants.find((x) => x.id === line.variant_id);
                            return (
                              <tr key={`${line.variant_id}-${idx}`} className="border-t border-border">
                                <td className="px-3 py-2">
                                  {p?.name ?? "—"}
                                  <span className="block text-[11px] text-muted-foreground">
                                    {v ? `${v.color} · ${v.size}` : ""}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">{v?.sku ?? "—"}</td>
                                <td className="px-3 py-2 text-right">
                                  <Input
                                    className="ml-auto h-8 w-20 text-right"
                                    type="number"
                                    min={1}
                                    value={line.qty}
                                    onChange={(e) =>
                                      setLines((ls) =>
                                        ls.map((l, i) => (i === idx ? { ...l, qty: e.target.value } : l)),
                                      )
                                    }
                                  />
                                </td>
                                {formType === "adjustment" ? (
                                  <td className="px-3 py-2">
                                    <select
                                      className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                                      value={line.direction}
                                      onChange={(e) =>
                                        setLines((ls) =>
                                          ls.map((l, i) =>
                                            i === idx
                                              ? { ...l, direction: e.target.value as "in" | "out" }
                                              : l,
                                          ),
                                        )
                                      }
                                    >
                                      <option value="in">Nhập</option>
                                      <option value="out">Xuất</option>
                                    </select>
                                  </td>
                                ) : null}
                                <td className="px-2 py-2 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                                  >
                                    Xóa
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : editingDoc ? (
              <>
                <div>
                  <p className="text-xs font-medium">Loại</p>
                  <p className="mt-1 text-sm">{TYPE_LABEL[editingDoc.type as DocType] ?? editingDoc.type}</p>
                </div>
                <div>
                  <p className="text-xs font-medium">Lý do</p>
                  <p className="mt-1 text-sm text-muted-foreground">{editingDoc.reason || "—"}</p>
                </div>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/55 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-left">Sản phẩm</th>
                        <th className="px-3 py-2 text-right">SL</th>
                        <th className="px-3 py-2 text-left">Chiều</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingDoc.lines.map((l) => (
                        <tr key={l.id} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{l.sku}</td>
                          <td className="px-3 py-2">
                            {l.product_name}
                            <span className="block text-[11px] text-muted-foreground">
                              {l.color_name} / {l.size_label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{l.qty}</td>
                          <td className="px-3 py-2">{l.direction === "out" ? "Xuất" : "Nhập"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-md border border-border p-5">
              <p className="section-label">Tóm tắt</p>
              <p className="mt-3 font-serif text-2xl">
                {compose ? TYPE_LABEL[formType] : TYPE_LABEL[editingDoc?.type as DocType] ?? "—"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {compose
                  ? `${lines.filter((l) => l.variant_id).length} dòng · kho ${warehouseLabel}`
                  : `${editingDoc?.lines.length ?? 0} dòng · ${STATUS_LABEL[editingDoc?.status ?? ""] ?? ""}`}
              </p>
              {!compose && editingDoc?.status === "posted" ? (
                <p className="mt-4 text-xs text-muted-foreground">Phiếu đã ghi sổ — chỉ xem.</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              {compose ? (
                <Button disabled={saving} onClick={createDraft}>
                  {saving ? "Đang lưu…" : "Tạo phiếu"}
                </Button>
              ) : status === "draft" ? (
                <Button disabled={saving} onClick={approve}>
                  Duyệt
                </Button>
              ) : status === "approved" ? (
                <Button disabled={saving} onClick={post}>
                  Ghi sổ
                </Button>
              ) : null}
              <Button variant="outline" onClick={backToList}>
                {compose ? "Hủy" : "Đóng"}
              </Button>
            </div>
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[11px] text-muted-foreground">
          <span>© 2026 ÉLANE · Modern Femininity</span>
          <span>Kho hàng · form</span>
        </footer>
      </>
    );
  }

  return (
    <>
      <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label text-primary">Kho vận</p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Tồn theo SKU kho {warehouseLabel}; nhập / xuất / điều chỉnh qua phiếu.
          </p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus /> Tạo phiếu
        </Button>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={cn("rounded-md border p-5", i === 0 ? "border-accent bg-accent/25" : "border-border")}
          >
            <p className="section-label">{m.label}</p>
            <p className="mt-3 font-serif text-3xl">{loading ? "…" : m.value}</p>
            <p className={cn("mt-1 text-xs", i === 0 ? "text-primary" : "text-muted-foreground")}>{m.note}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {(
              [
                ["all", "Tất cả"],
                ["low", "Sắp hết"],
                ["out", "Hết hàng"],
                ["docs", "Phiếu"],
              ] as const
            ).map(([id, label]) => (
              <Button key={id} variant={tab === id ? "default" : "ghost"} size="sm" onClick={() => setTab(id)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              placeholder={tab === "docs" ? "Tìm phiếu…" : "Tìm SKU / sản phẩm…"}
            />
          </div>
        </div>

        {tab === "docs" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-secondary/55 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Mã</th>
                  <th className="px-4 py-3 text-left">Loại</th>
                  <th className="px-4 py-3 text-left">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Dòng</th>
                  <th className="px-4 py-3 text-left">Ngày</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Chưa có phiếu.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((d) => (
                    <tr
                      key={d.id}
                      className="cursor-pointer border-t border-border hover:bg-secondary/40"
                      onClick={() => openDoc(d.id)}
                    >
                      <td className="px-4 py-3.5 font-medium">{d.code}</td>
                      <td className="px-4 py-3.5">{TYPE_LABEL[d.type as DocType] ?? d.type}</td>
                      <td className="px-4 py-3.5">{STATUS_LABEL[d.status] ?? d.status}</td>
                      <td className="px-4 py-3.5 text-right">{d.line_count}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {new Date(d.created_at).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/55 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Sản phẩm</th>
                  <th className="px-4 py-3 text-left">Biến thể</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-right">Thực có</th>
                  <th className="px-4 py-3 text-right">Đã giữ</th>
                  <th className="px-4 py-3 text-right">Khả dụng</th>
                  <th className="px-4 py-3 text-right">Mức</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {loading ? "Đang tải…" : "Không có dòng tồn."}
                    </td>
                  </tr>
                ) : (
                  filteredStock.map((r) => (
                    <tr key={r.variant_id} className="border-t border-border">
                      <td className="px-4 py-3.5 font-medium">{r.product_name}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {r.color_name} / {r.size_label}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">{r.sku}</td>
                      <td className="px-4 py-3.5 text-right">{r.on_hand}</td>
                      <td className="px-4 py-3.5 text-right">{r.reserved}</td>
                      <td
                        className={cn(
                          "px-4 py-3.5 text-right font-medium",
                          isOut(r) ? "text-destructive" : isLow(r) ? "text-primary" : "",
                        )}
                      >
                        {r.available}
                      </td>
                      <td className="px-4 py-3.5 text-right text-muted-foreground">{r.reorder_point}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[11px] text-muted-foreground">
        <span>© 2026 ÉLANE · Modern Femininity</span>
        <span>Kho hàng · list</span>
      </footer>
    </>
  );
}
