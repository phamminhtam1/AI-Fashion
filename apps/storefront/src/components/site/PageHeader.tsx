import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function PageHeader({ title, eyebrow, crumb, children }: { title: string; eyebrow?: string; crumb?: string; children?: ReactNode }) {
  return (
    <header className="mx-auto max-w-[1440px] px-6 pt-10 md:px-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Trang chủ</Link> / <span className="text-foreground">{crumb ?? title}</span>
      </nav>
      {eyebrow && <p className="mt-8 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</p>}
      <h1 className={`${eyebrow ? "mt-2" : "mt-8"} text-4xl md:text-5xl`}>{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-muted-foreground">{children}</div>}
    </header>
  );
}

export const seo = (title: string, description: string, extra: Record<string, string>[] = []) => ({
  meta: [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...extra,
  ],
});

export const inputCls = "w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground";
export const btnCls = "bg-primary px-10 py-4 text-xs uppercase tracking-widest text-primary-foreground transition hover:opacity-90";
