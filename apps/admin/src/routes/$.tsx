import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/AdminShell";

export const Route = createFileRoute("/$")({
  head: () => ({
    meta: [
      { title: "Quản trị ÉLANE — Trung tâm vận hành" },
      { name: "description", content: "Giao diện quản trị vận hành thương mại điện tử ÉLANE." },
      { property: "og:title", content: "Quản trị ÉLANE — Trung tâm vận hành" },
      { property: "og:description", content: "Quản lý sản phẩm, đơn hàng, nội dung và chiến dịch của ÉLANE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthGate,
});
