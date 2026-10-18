import { useId } from "react";

/** Đường xu hướng nhỏ trong thẻ KPI. */
export function Sparkline({ data, color, className }: { data: number[]; color: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const w = 100, h = 40;
  const min = Math.min(...data), span = Math.max(...data) - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 5 - ((v - min) / span) * (h - 10)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Cột doanh thu + đường số đơn theo kênh. */
export function RevenueOrdersChart({ items }: { items: { label: string; revenue: number; orders: number }[] }) {
  const id = useId().replace(/:/g, "");
  const W = 640, H = 250, L = 46, R = 12, T = 12, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const maxRev = Math.max(2000, Math.ceil(Math.max(...items.map((i) => i.revenue)) / 2000) * 2000);
  const maxOrd = Math.max(1, ...items.map((i) => i.orders)) * 1.15;
  const step = iw / items.length, bw = step * 0.42;
  const ticks = Array.from({ length: 6 }, (_, i) => (maxRev / 5) * i);
  const y = (v: number) => T + ih - (v / maxRev) * ih;
  const pts = items.map((it, i) => [L + step * (i + 0.5), T + ih - (it.orders / maxOrd) * ih]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Doanh thu và số đơn hàng theo kênh">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c4b5fd" /><stop offset="1" stopColor="#ddd6fe" /></linearGradient></defs>
      {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray="3 3" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">{t.toLocaleString("en-US")}</text></g>)}
      {items.map((it, i) => <g key={it.label}>
        <rect x={L + step * i + (step - bw) / 2} y={y(it.revenue)} width={bw} height={T + ih - y(it.revenue)} rx="3" fill={`url(#${id})`} />
        <text x={L + step * (i + 0.5)} y={H - 8} textAnchor="middle" fontSize="12" fill="#475569">{it.label}</text>
      </g>)}
      <path d={pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ")} fill="none" stroke="#6941c6" strokeWidth="2" />
      {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r="4" fill="#fff" stroke="#6941c6" strokeWidth="2" />)}
    </svg>
  );
}

/** Donut tỷ lệ chuyển đổi. */
export function Donut({ items, value, label }: { items: { label: string; value: number; color: string }[]; value: string; label: string }) {
  const r = 70, C = 2 * Math.PI * r, total = items.reduce((s, i) => s + i.value, 0) || 1;
  let acc = 0;
  return (
    <svg viewBox="0 0 200 200" className="size-44 shrink-0" role="img" aria-label="Tỷ lệ chuyển đổi theo kênh">
      <g transform="rotate(-90 100 100)">
        {items.map((it) => {
          const len = (it.value / total) * C; const el = <circle key={it.label} cx="100" cy="100" r={r} fill="none" stroke={it.color} strokeWidth="22" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} />;
          acc += len; return el;
        })}
      </g>
      <text x="100" y="102" textAnchor="middle" fontSize="26" fontWeight="700" fill="#0f172a">{value}</text>
      <text x="100" y="120" textAnchor="middle" fontSize="10" fill="#64748b">{label}</text>
    </svg>
  );
}
