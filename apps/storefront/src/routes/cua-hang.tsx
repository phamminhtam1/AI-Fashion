import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, MapPin, Phone } from "lucide-react";
import { stores } from "@/lib/content";
import { PageHeader, seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/cua-hang")({
  head: () => seo("Hệ thống cửa hàng — ÉLANE", "Tìm cửa hàng ÉLANE gần bạn tại Hà Nội, TP. Hồ Chí Minh và Đà Nẵng."),
  component: Stores,
});

function Stores() {
  const cities = ["Tất cả", ...new Set(stores.map((s) => s.city))];
  const [city, setCity] = useState("Tất cả");
  const list = city === "Tất cả" ? stores : stores.filter((s) => s.city === city);
  return (
    <>
      <PageHeader title="Hệ thống cửa hàng" eyebrow="Store locator">Ghé thăm ÉLANE để được stylist tư vấn trực tiếp.</PageHeader>
      <div className="mx-auto max-w-[1440px] px-6 py-10 md:px-8">
        <div className="flex flex-wrap gap-2">
          {cities.map((c) => (
            <button key={c} onClick={() => setCity(c)} className={`border px-5 py-2 text-xs uppercase tracking-widest ${city === c ? "border-foreground bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>{c}</button>
          ))}
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <div key={s.name} className="border border-border p-8">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{s.city}</p>
              <h2 className="mt-2 text-2xl">{s.name}</h2>
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                <p className="flex gap-3"><MapPin className="h-4 w-4 shrink-0" strokeWidth={1.5} />{s.address}</p>
                <p className="flex gap-3"><Clock className="h-4 w-4" strokeWidth={1.5} />{s.hours}</p>
                <p className="flex gap-3"><Phone className="h-4 w-4" strokeWidth={1.5} />{s.phone}</p>
              </div>
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(s.address)}`} target="_blank" rel="noreferrer" className="mt-6 inline-block border-b border-foreground pb-1 text-xs uppercase tracking-widest">Chỉ đường</a>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
