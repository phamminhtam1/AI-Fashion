import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Facebook, Globe, Heart, Instagram, Music2, ShoppingBag, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChannelId } from "./types";

export const BRAND = "#6941c6";
export const card = "rounded-lg border border-slate-200 bg-white";
export const inputCls = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#6941c6]";
export const areaCls = "w-full rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#6941c6]";
export const fmt = (n: number) => n.toLocaleString("en-US");
export const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ---------- Logo kênh ---------- */
const LOGOS: Record<ChannelId, { bg: string; icon: (c: string) => ReactNode }> = {
  facebook: { bg: "#1877f2", icon: (c) => <Facebook className={cn(c, "fill-white")} /> },
  instagram: { bg: "linear-gradient(45deg,#f9ce34,#ee2a7b 55%,#6228d7)", icon: (c) => <Instagram className={c} /> },
  tiktok: { bg: "#0b0b0f", icon: (c) => <Music2 className={c} /> },
  shopee: { bg: "#ee4d2d", icon: (c) => <ShoppingBag className={c} /> },
  website: { bg: BRAND, icon: (c) => <Globe className={c} /> },
  zalo: { bg: "#0068ff", icon: () => <span className="text-[0.62em] font-extrabold tracking-tight">Zalo</span> },
  lazada: { bg: "linear-gradient(135deg,#ff6a00,#e6007a)", icon: (c) => <Heart className={cn(c, "fill-white")} /> },
  youtube: { bg: "#ff0000", icon: (c) => <Youtube className={c} /> },
};
const SIZES = { xs: ["size-5 rounded", "size-3 text-[10px]"], sm: ["size-8 rounded-md", "size-4 text-xs"], md: ["size-10 rounded-lg", "size-5 text-sm"], lg: ["size-12 rounded-xl", "size-6 text-base"] };
export function ChannelLogo({ id, size = "md" }: { id: ChannelId; size?: keyof typeof SIZES }) {
  const [box, ic] = SIZES[size];
  return <span className={cn("grid shrink-0 place-items-center text-white", box)} style={{ background: LOGOS[id].bg }}>{LOGOS[id].icon(ic)}</span>;
}

/* ---------- Nhỏ lẻ ---------- */
export function Delta({ value, className }: { value: number; className?: string }) {
  const up = value >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", up ? "text-emerald-600" : "text-rose-600", className)}><Icon className="size-3" />{Math.abs(value).toFixed(1)}%</span>;
}
export function Pill({ tone, children }: { tone: "green" | "amber" | "slate" | "rose" | "violet"; children: ReactNode }) {
  const t = { green: "bg-emerald-50 text-emerald-700", amber: "bg-orange-50 text-orange-600", slate: "bg-slate-100 text-slate-600", rose: "bg-rose-50 text-rose-700", violet: "bg-violet-50 text-violet-700" }[tone];
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", t)}>{children}</span>;
}
export const Dot = ({ className }: { className?: string }) => <span className={cn("size-1.5 rounded-full bg-current", className)} />;

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6941c6]", checked ? "bg-[#6941c6]" : "bg-slate-300")}>
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function Avatar({ label = "É", src, className }: { label?: string; src?: string | null; className?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={cn("size-10 shrink-0 rounded-full object-cover border border-slate-200", className)}
        onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
      />
    );
  }
  return <span className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-stone-100 font-serif text-sm font-semibold text-slate-700", className)}>{label}</span>;
}

export function PageHeader({ title, desc, actions, onBack }: { title: ReactNode; desc?: string; actions?: ReactNode; onBack?: () => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {onBack && <button onClick={onBack} aria-label="Quay lại" className="mt-1 grid size-8 place-items-center rounded-md hover:bg-slate-100"><ArrowLeft className="size-5" /></button>}
        <div><h1 className="admin-page-title flex flex-wrap items-center gap-2">{title}</h1>{desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}</div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: { title: string; desc?: string }[]; current: number }) {
  return (
    <div className={cn(card, "grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4")}>
      {steps.map((s, i) => {
        const n = i + 1; const done = n < current; const on = n === current;
        return (
          <div key={s.title} className={cn("flex items-center gap-3 rounded-md px-3 py-2", on && "bg-violet-50")}>
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold", on || done ? "bg-[#6941c6] text-white" : "bg-violet-100 text-[#6941c6]")}>{done ? <Check className="size-4" /> : n}</span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{s.title}</p>{s.desc && <p className="truncate text-xs text-slate-500">{s.desc}</p>}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return <div><div className="flex items-center justify-between"><label className="text-sm font-semibold">{label}</label>{hint}</div><div className="mt-2">{children}</div></div>;
}

export function Modal({ open, onClose, children, maxW = "max-w-2xl" }: { open: boolean; onClose: () => void; children: ReactNode; maxW?: string }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className={cn("max-h-[92vh] w-full overflow-y-auto rounded-lg bg-white p-6", maxW)}>{children}</div>
    </div>, document.body);
}

export function Section({ title, desc, action, children, className }: { title: string; desc?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn(card, "p-5", className)}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold">{title}</h2>{desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}</div>{action}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="p-8 text-center text-sm text-slate-400">{children}</p>;
