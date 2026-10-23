import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Loader2, MoreHorizontal, PenLine, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AUDIENCES,
  CAMPAIGN_GOALS,
  CH_NAME,
  CTAS,
  GOALS,
  MOCK_PRODUCTS,
  MOCK_VARIANTS,
  SEGMENTS,
  STYLES,
  TINTS,
  TONES,
  AGES,
  type Collection,
  type Product,
  type Variant,
} from "../mock";
import type { AiPreset, ChannelId, SocialCtx } from "../types";
import { PageHeader, Stepper, card, vnd } from "../ui";
import {
  AiInputPanel,
  AiResultPanel,
  ManualComposer,
  type AiForm,
  type AiKeyInfo,
  type ManualForm,
} from "./ContentPanels";
import {
  formatFullCta,
  PreviewPanel,
  SchedulePanel,
  type Device,
  type Draft,
  type MediaItem,
  type PublishMode,
} from "./ContentPreview";
import {
  ProductBstPickerModal,
  DEFAULT_TAG_OPTIONS,
  type TagOptions,
} from "./ProductBstPickerModal";
import { buildSelectionPrompts } from "./contentPromptPresets";

type Method = "ai" | "manual";

const METHODS: { id: Method; icon: typeof Sparkles; title: string; desc: string }[] = [
  {
    id: "ai",
    icon: Sparkles,
    title: "AI tạo nội dung",
    desc: "Dựa trên sản phẩm, chủ đề, mục tiêu và phong cách thương hiệu.",
  },
  {
    id: "manual",
    icon: PenLine,
    title: "Người tự tạo nội dung",
    desc: "Tự viết caption, tải ảnh/video và thiết lập thông tin.",
  },
];
const STEPS: Record<Method, { title: string; desc: string }[]> = {
  ai: [
    { title: "Chọn phương thức", desc: "Chọn cách tạo content" },
    { title: "Tạo nội dung", desc: "AI tạo và gợi ý nội dung theo brief" },
    { title: "Xem trước & chỉnh sửa", desc: "Tùy chỉnh theo từng kênh" },
    { title: "Gửi duyệt & Lên lịch", desc: "Chọn thời gian và phê duyệt" },
  ],
  manual: [
    { title: "Chọn phương thức", desc: "Chọn phương thức tạo content" },
    { title: "Tạo nội dung", desc: "Soạn nội dung và media" },
    { title: "Xem trước & chỉnh sửa", desc: "Tùy chỉnh theo từng kênh" },
    { title: "Gửi duyệt & Lên lịch", desc: "Chọn thời gian và phê duyệt" },
  ],
};
const DESC: Record<Method, string> = {
  ai: "Tạo nội dung marketing bằng AI hoặc tự soạn, xem trước trên nhiều kênh và gửi duyệt để đăng bài.",
  manual: "Tạo nội dung marketing bằng cách tự soạn, tải media và tùy chỉnh theo từng kênh.",
};
const VERSION_COUNT = 3;

// Một số gateway trả JSON chứa ký tự escape "\\n" thay vì newline thật.
// Chuẩn hóa ở biên UI để textarea, preview và nội dung đăng đều xuống dòng đúng.
const normalizeAiText = (value: string) =>
  value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r");

/** Mặc định: 1 giờ nữa, làm tròn đầu giờ → [yyyy-mm-dd, hh:mm] theo giờ địa phương. */
const inHour = (): [string, string] => {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  const [date, time] = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
    .split("T");
  return [date, time];
};
const readDuration = (url: string) =>
  new Promise<number | undefined>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : undefined);
    v.onerror = () => resolve(undefined);
    v.src = url;
  });

const initialAi = (_preset: AiPreset): AiForm => ({
  picked: [],
  goal: GOALS[0],
  style: STYLES[0],
  tone: TONES[0],
  audience: AUDIENCES[0],
  extra: "",
});
const initialManual = (): ManualForm => ({
  productIds: [],
  campaign: CAMPAIGN_GOALS[0],
  segment: SEGMENTS[0],
  age: AGES[1],
  style: STYLES[0],
  note: "",
  text: "",
  hashtags: [],
  cta: "Mua ngay",
  link: "Link sản phẩm",
});

export function AiContentPage({ ctx }: { ctx: SocialCtx }) {
  const [method, setMethod] = useState<Method>("ai");
  const [ai, setAi] = useState<AiForm>(() => initialAi(ctx.aiPreset));
  const [manual, setManual] = useState<ManualForm>(initialManual);
  const [targets, setTargets] = useState<ChannelId[]>(["facebook", "instagram", "tiktok"]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [aiMediaOrder, setAiMediaOrder] = useState<string[]>([]);
  const [aiSourceImageIds, setAiSourceImageIds] = useState<string[]>([]);
  const [manualSourceImageIds, setManualSourceImageIds] = useState<string[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");

  const [catalogProducts, setCatalogProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [catalogLookbooks, setCatalogLookbooks] = useState<Collection[]>([]);
  const [selectedLookbook, setSelectedLookbook] = useState<Collection | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"ai" | "manual">("ai");
  /** Thiết lập gắn thẻ sản phẩm (từ popup chọn sản phẩm). */
  const [tagOpts, setTagOpts] = useState<TagOptions>(DEFAULT_TAG_OPTIONS);

  const [variants, setVariants] = useState<Variant[]>([]);
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(false);
  const [aiCta, setAiCta] = useState(CTAS[0]);
  const [aiCtaLink, setAiCtaLink] = useState("");
  const [generating, setGenerating] = useState(false);

  const [previewCh, setPreviewCh] = useState<ChannelId>("facebook");
  const [device, setDevice] = useState<Device>("desktop");
  const [publishMode, setPublishMode] = useState<PublishMode>("schedule");
  const [[date, time], setWhen] = useState<[string, string]>(inHour);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(false);

  const [aiKeyStatus, setAiKeyStatus] = useState<AiKeyInfo | null>(null);
  const [keyUsed, setKeyUsed] = useState<{ id?: string; label?: string; provider?: string } | null>(
    null,
  );

  // 1. Kiểm tra khóa OpenAI đang hoạt động từ bảng Quản lý khóa AI
  useEffect(() => {
    let alive = true;
    adminApi
      .socialAiKeyStatus()
      .then((res) => {
        if (alive) {
          setAiKeyStatus(res);
          if (res.key) setKeyUsed(res.key);
        }
      })
      .catch((err) => {
        console.warn("Could not check social AI key status:", err);
      });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Rút gọn SKU biến thể về Mã sản phẩm gốc (Style Code / Model SKU).
   * Ví dụ: FDC34045-TIM-S -> FDC34045, BJD33061-KEM-XL -> BJD33061, FQD31096-DEN-S -> FQD31096.
   * Các màu khác nhau, size khác nhau đều chung quy về 1 sản phẩm.
   */
  function extractBaseSku(rawSku: string | undefined, slug?: string): string {
    if (!rawSku) return slug ? slug.toUpperCase().slice(0, 10) : "";
    const parts = rawSku.split("-");
    if (parts.length >= 2 && !rawSku.startsWith("EL-")) {
      return parts[0];
    }
    return rawSku;
  }

  // 2. Tải danh mục sản phẩm và BST (Lookbook) thật từ hệ thống ÉLANE
  useEffect(() => {
    let alive = true;
    setLoadingCatalog(true);
    Promise.all([
      adminApi.products({ limit: 200, status: "published" }).catch((err) => {
        console.warn("Could not fetch real products:", err);
        return null;
      }),
      adminApi.lookbooks().catch((err) => {
        console.warn("Could not fetch real lookbooks:", err);
        return null;
      }),
    ])
      .then(([prodsRes, lookbooksRes]) => {
        if (!alive) return;
        if (prodsRes?.items && prodsRes.items.length > 0) {
          const seenNames = new Set<string>();
          const mapped: Product[] = [];

          for (let i = 0; i < prodsRes.items.length; i++) {
            const p = prodsRes.items[i];
            const normName = p.name?.trim().toLowerCase();
            // Đảm bảo list tất cả sản phẩm khác tên (các màu/size khác nhau đều chung quy về 1 sản phẩm)
            if (!normName || seenNames.has(normName)) continue;
            seenNames.add(normName);

            const gallery = Array.from(
              new Set(
                [...(p.images || []), ...(p.media || []).map((item) => item.url)].filter(
                  (url): url is string => Boolean(url),
                ),
              ),
            );
            const img = p.media?.find((m) => m.is_cover)?.url || gallery[0];
            const rawSku = p.variants?.[0]?.sku || p.slug || `EL-${p.id.slice(0, 6)}`;
            const baseSku = extractBaseSku(rawSku, p.slug);

            const colorCount =
              p.colorways?.length ||
              p.colors?.length ||
              new Set(
                p.variants
                  ?.map((v) => v.colorway_id || v.color_name || v.color?.name)
                  .filter(Boolean),
              ).size ||
              1;
            const sizeCount =
              p.sizes?.length ||
              new Set(
                p.variants?.map((v) => v.size_id || v.size_label || v.size?.code).filter(Boolean),
              ).size ||
              1;

            mapped.push({
              id: p.id,
              name: p.name,
              sku: baseSku,
              price: p.price_vnd,
              tint: TINTS[mapped.length % TINTS.length],
              inStock:
                p.variants && p.variants.length > 0
                  ? p.variants.some((v) => (v.cost_vnd ?? 1) >= 0)
                  : true,
              imageUrl: img,
              imageUrls: gallery,
              category: p.category?.name,
              description: p.material
                ? `${p.description || ""} (Chất liệu: ${p.material})`
                : p.description,
              slug: p.slug,
              colorsCount: colorCount,
              sizesCount: sizeCount,
              variantsCount: p.variants?.length || 1,
            });
          }
          setCatalogProducts(mapped);
        }

        if (lookbooksRes?.items && lookbooksRes.items.length > 0) {
          const mappedLb: Collection[] = lookbooksRes.items.map((lb) => ({
            id: lb.id,
            title: lb.title,
            slug: lb.slug,
            season: lb.season,
            coverImageUrl: lb.cover_image_url,
            itemCount:
              lb.item_count || lb.attached_products?.length || lb.attached_product_ids?.length || 0,
            description: lb.description,
            attachedProductIds:
              lb.attached_products?.map((p) => p.id) || lb.attached_product_ids || [],
          }));
          setCatalogLookbooks(mappedLb);
        }
      })
      .finally(() => {
        if (alive) setLoadingCatalog(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  /* Giải phóng URL tạm của file đã tải lên khi rời trang. */
  const mediaRef = useRef(media);
  mediaRef.current = media;
  useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL(m.url)), []);

  const updAi = (p: Partial<AiForm>) => setAi((f) => ({ ...f, ...p }));
  const updManual = (p: Partial<ManualForm>) => setManual((f) => ({ ...f, ...p }));
  const toggleChannel = (id: ChannelId) =>
    setTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  /* Giữ đúng thứ tự người dùng đã chọn / kéo thả trong popup. */
  const aiProducts = ai.picked
    .map((id) => catalogProducts.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));

  const suggestedLinks = useMemo(() => {
    const list: { label: string; url: string }[] = [];
    if (aiProducts.length > 0) {
      const p = aiProducts[0];
      const slug = p.slug || p.sku || p.id;
      list.push({
        label: `Sản phẩm: ${p.name}`,
        url: `https://elane.vn/products/${slug}`,
      });
    }
    if (selectedLookbook) {
      list.push({
        label: `BST: ${selectedLookbook.title}`,
        url: `https://elane.vn/collections/${selectedLookbook.slug || selectedLookbook.id}`,
      });
    }
    list.push({
      label: "Website ÉLANE",
      url: "https://elane.vn",
    });
    list.push({
      label: "Inbox Fanpage",
      url: "https://m.me/elane.official",
    });
    return list;
  }, [aiProducts, selectedLookbook]);

  // Tự động gợi ý link sản phẩm/BST cho CTA nếu chưa nhập link
  useEffect(() => {
    if (!aiCtaLink && suggestedLinks.length > 0 && (aiProducts.length > 0 || selectedLookbook)) {
      setAiCtaLink(suggestedLinks[0].url);
    }
  }, [suggestedLinks, aiCtaLink, aiProducts.length, selectedLookbook]);
  const productMedia: MediaItem[] = aiProducts.flatMap((product) => {
    const urls = product.imageUrls?.length
      ? product.imageUrls
      : product.imageUrl
        ? [product.imageUrl]
        : [];
    return urls.map((url, index) => ({
      id: `product-${product.id}-${index}`,
      productId: product.id,
      kind: "image" as const,
      url,
      name: `${product.name} · ảnh ${index + 1}`,
    }));
  });
  const selectedProductMedia = productMedia.filter((item) => aiSourceImageIds.includes(item.id));
  const aiMediaOptions = [...productMedia, ...media];
  const selectedAiMedia = aiMediaOrder.flatMap((id) => {
    const item = aiMediaOptions.find((candidate) => candidate.id === id);
    return item ? [item] : [];
  });

  useEffect(() => {
    const validIds = new Set(productMedia.map((item) => item.id));
    const coverIds = aiProducts.flatMap((product) => {
      const cover = productMedia.find((item) => item.productId === product.id);
      return cover ? [cover.id] : [];
    });
    setAiSourceImageIds((current) => {
      const kept = current.filter((id) => validIds.has(id));
      const next = [...kept];
      for (const coverId of coverIds) {
        const productId = productMedia.find((item) => item.id === coverId)?.productId;
        if (
          productId &&
          !next.some((id) => productMedia.find((item) => item.id === id)?.productId === productId)
        )
          next.push(coverId);
      }
      return next.slice(0, 10);
    });
  }, [ai.picked.join("|"), productMedia.map((item) => item.id).join("|")]);

  useEffect(() => {
    const productIds = selectedProductMedia.map((item) => item.id);
    setAiMediaOrder((current) =>
      [
        ...current.filter((id) => media.some((item) => item.id === id) || productIds.includes(id)),
        ...productIds.filter((id) => !current.includes(id)),
      ].slice(0, 10),
    );
  }, [
    aiSourceImageIds.join("|"),
    productMedia.map((item) => item.id).join("|"),
    media.map((item) => item.id).join("|"),
  ]);
  const manualProducts = manual.productIds
    .map((id) => catalogProducts.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));
  const manualProductMedia: MediaItem[] = manualProducts.flatMap((product) => {
    const urls = product.imageUrls?.length
      ? product.imageUrls
      : product.imageUrl
        ? [product.imageUrl]
        : [];
    return urls.map((url, index) => ({
      id: `manual-product-${product.id}-${index}`,
      productId: product.id,
      kind: "image" as const,
      url,
      name: `${product.name} · ảnh ${index + 1}`,
    }));
  });
  const selectedManualProductMedia = manualProductMedia.filter((item) =>
    manualSourceImageIds.includes(item.id),
  );
  const manualPostMedia = [...selectedManualProductMedia, ...media].slice(0, 10);

  useEffect(() => {
    const validIds = new Set(manualProductMedia.map((item) => item.id));
    setManualSourceImageIds((current) => {
      const kept = current.filter((id) => validIds.has(id));
      const next = [...kept];
      for (const product of manualProducts) {
        if (
          next.some(
            (id) => manualProductMedia.find((item) => item.id === id)?.productId === product.id,
          )
        )
          continue;
        const cover = manualProductMedia.find((item) => item.productId === product.id);
        if (cover) next.push(cover.id);
      }
      return next.slice(0, 10);
    });
  }, [manual.productIds.join("|"), manualProductMedia.map((item) => item.id).join("|")]);
  const current = variants[active];

  const draft: Draft =
    method === "ai"
      ? {
          title: current?.title ?? "",
          caption: current?.caption ?? "",
          hashtags: current?.hashtags ?? [],
          cta: current ? aiCta : "",
          ctaLink: current ? aiCtaLink.trim() : "",
        }
      : {
          title: manualProducts.map((product) => product.name).join(", "),
          caption: manual.text,
          hashtags: manual.hashtags,
          cta: manual.cta.trim(),
          ctaLink: /^https?:\/\//i.test(manual.link.trim())
            ? manual.link.trim()
            : manualProducts[0]?.slug
              ? `https://elane.vn/products/${manualProducts[0].slug}`
              : "https://elane.vn",
        };
  const hasContent = Boolean(draft.caption.trim());
  const step = hasContent ? 3 : 2;

  /* ---------- AI Tạo nội dung (Chỉ lấy key thuộc OPENAI từ Quản lý khóa AI) ---------- */
  async function generate() {
    const subjects = aiProducts
      .map((p, i) => {
        const parts = [p.name];
        if (p.category) parts.push(`Danh mục: ${p.category}`);
        if (p.description) parts.push(`Mô tả/Chất liệu: ${p.description.slice(0, 100)}`);
        if (tagOpts.featured && i === 0)
          parts.push("SẢN PHẨM NỔI BẬT – ưu tiên nhấn mạnh trong nội dung");
        return parts.join(" - ");
      })
      .join("\n");

    const extra = ai.extra.trim();
    if (!subjects && !extra && !selectedLookbook) {
      return toast.error(
        ctx.aiPreset === "product"
          ? "Hãy chọn ít nhất một sản phẩm"
          : "Hãy chọn sản phẩm hoặc nhập chủ đề/ý tưởng",
      );
    }

    const bstContext = selectedLookbook
      ? `Bộ sưu tập đang chọn: ${selectedLookbook.title}${selectedLookbook.season ? ` (${selectedLookbook.season})` : ""}`
      : "";

    setGenerating(true);
    const selectionPrompts = buildSelectionPrompts(ai);
    const brief = [
      `MỤC TIÊU CONTENT — ${ai.goal}\n${selectionPrompts.goal}`,
      `PHONG CÁCH NỘI DUNG — ${ai.style}\n${selectionPrompts.style}`,
      `TÔNG GIỌNG — ${ai.tone}\n${selectionPrompts.tone}`,
      `ĐỐI TƯỢNG KHÁCH HÀNG — ${ai.audience}\n${selectionPrompts.audience}`,
      bstContext,
      subjects &&
        tagOpts.tagProducts &&
        "Yêu cầu: nhắc rõ tên sản phẩm trong nội dung để gắn thẻ sản phẩm; không hiển thị SKU hoặc giá.",
      subjects && "Không nêu SKU, mã sản phẩm hoặc giá trong nội dung.",
      extra && `Chủ đề / ý tưởng / thông tin bổ sung: ${extra}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const productContext = subjects || bstContext || extra || "Trang phục thời trang ÉLANE";

    try {
      const res = await adminApi.generateSocialContent({
        brief,
        productContext,
        tone: `${selectionPrompts.style}\n${selectionPrompts.tone}`,
        count: VERSION_COUNT,
        channels: targets,
        objective: ai.goal,
        audience: selectionPrompts.audience,
        products: aiProducts.map((product) => ({
          id: product.id,
          name: product.name,
          imageUrls: selectedProductMedia
            .filter((item) => item.productId === product.id)
            .map((item) => item.url),
          ...(product.description ? { description: product.description } : {}),
          ...(product.category ? { category: product.category } : {}),
        })),
      });

      if (res.keyUsed) {
        setKeyUsed(res.keyUsed);
        setAiKeyStatus({
          active: true,
          key: res.keyUsed,
        });
      }

      if (res.variants && res.variants.length > 0) {
        const next: Variant[] = res.variants.map((v, i) => ({
          id: `v${i + 1}`,
          label: `Phiên bản ${i + 1}`,
          tags: [ai.style, ai.tone][i % 2] || ai.style,
          title: v.title || `Gợi ý phong cách ${i + 1}`,
          caption: normalizeAiText(v.caption || ""),
          hashtags: Array.isArray(v.hashtags) ? v.hashtags : ["#Elane", "#ThoiTrangNu"],
          ...(v.visualBrief ? { visualBrief: v.visualBrief } : {}),
        }));
        setVariants(next);
        if (res.variants[0]?.cta) {
          const rawCta = res.variants[0].cta;
          const urlMatch = rawCta.match(/https?:\/\/[^\s]+/);
          if (urlMatch) {
            setAiCta(
              rawCta
                .replace(urlMatch[0], "")
                .replace(/[-–—:]\s*$/, "")
                .trim(),
            );
            setAiCtaLink(urlMatch[0]);
          } else {
            setAiCta(rawCta);
          }
        }
        toast.success(
          `AI đã tạo ${next.length} phiên bản nội dung (khóa: ${res.keyUsed?.label || "KIE"})`,
        );
      } else if (res.title || res.caption) {
        const single: Variant = {
          id: "v1",
          label: "Phiên bản 1",
          tags: ai.style,
          title: res.title || "Gợi ý phong cách",
          caption: normalizeAiText(res.caption || ""),
          hashtags: Array.isArray(res.hashtags) ? res.hashtags : ["#Elane", "#ThoiTrangNu"],
        };
        setVariants([single]);
        if (res.cta) {
          const rawCta = res.cta;
          const urlMatch = rawCta.match(/https?:\/\/[^\s]+/);
          if (urlMatch) {
            setAiCta(
              rawCta
                .replace(urlMatch[0], "")
                .replace(/[-–—:]\s*$/, "")
                .trim(),
            );
            setAiCtaLink(urlMatch[0]);
          } else {
            setAiCta(rawCta);
          }
        }
        toast.success(`AI đã tạo nội dung thành công (khóa: ${res.keyUsed?.label || "KIE"})`);
      } else {
        toast.warning("Chưa nhận được nội dung từ AI, hiển thị nội dung mẫu");
        setVariants(MOCK_VARIANTS.slice(0, VERSION_COUNT));
      }
      setActive(0);
      setEditing(false);
    } catch (err: any) {
      console.error("AI Generation error:", err);
      const msg = err?.message || "Không thể tạo nội dung";
      if (
        msg.includes("missing_ai_key") ||
        msg.includes("chưa có khóa") ||
        msg.includes("Không tìm thấy OpenAI")
      ) {
        toast.error(
          "Không tìm thấy khóa KIE đang hoạt động trong Quản lý khóa AI. Vui lòng thêm hoặc bật khóa KIE.",
        );
      } else {
        toast.error(`Lỗi tạo nội dung: ${msg}`);
      }
      if (!variants.length) {
        setVariants(MOCK_VARIANTS.slice(0, VERSION_COUNT));
      }
    } finally {
      setGenerating(false);
    }
  }

  const patchVariant = (i: number, p: Partial<Variant>) =>
    setVariants((vs) => vs.map((v, k) => (k === i ? { ...v, ...p } : v)));
  const editVariant = (i: number) => {
    if (i === active) setEditing((e) => !e);
    else {
      setActive(i);
      setEditing(true);
    }
  };

  /* ---------- Tự soạn: media ---------- */
  async function addFiles(files: File[]) {
    const valid = files.filter((f) => /^(image|video)\//.test(f.type));
    const selectedProductImageCount =
      method === "ai" ? aiSourceImageIds.length : manualSourceImageIds.length;
    const room = 10 - media.length - selectedProductImageCount;
    if (valid.length < files.length) toast.warning("Chỉ hỗ trợ file ảnh hoặc video");
    if (valid.length > room) toast.warning(`Tối đa 10 file, còn ${Math.max(room, 0)} chỗ trống`);
    const added = await Promise.all(
      valid.slice(0, Math.max(room, 0)).map(async (f): Promise<MediaItem> => {
        const url = URL.createObjectURL(f);
        const kind = f.type.startsWith("video/") ? "video" : "image";
        return {
          id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
          kind,
          url,
          name: f.name,
          duration: kind === "video" ? await readDuration(url) : undefined,
        };
      }),
    );
    setMedia((m) => [...m, ...added].slice(0, 10));
    if (method === "ai")
      setAiMediaOrder((current) => [...current, ...added.map((item) => item.id)].slice(0, 10));
  }
  const removeMedia = (id: string) =>
    setMedia((m) => {
      const t = m.find((x) => x.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return m.filter((x) => x.id !== id);
    });

  /* ---------- Gửi duyệt / lưu nháp / đăng ngay ---------- */
  async function submit(action: "draft" | "pending" | "publish_now") {
    if (!hasContent)
      return toast.error(
        method === "ai" ? "Hãy tạo nội dung bằng AI trước" : "Hãy nhập nội dung bài viết",
      );
    if (!targets.length) return toast.error("Hãy chọn ít nhất một kênh đăng");

    // Lấy toàn bộ link ảnh thật từ sản phẩm hoặc media đã chọn
    const activeMedia = method === "ai" ? selectedAiMedia : manualPostMedia;
    let postMediaUrls: string[] = Array.from(
      new Set(activeMedia.map((m) => m.url).filter(Boolean)),
    );

    if (postMediaUrls.length === 0) {
      if (method === "manual" && manualProducts[0]?.imageUrl) {
        postMediaUrls = [manualProducts[0].imageUrl];
      }
    }

    if (mediaUrl.trim()) {
      const trimmed = mediaUrl.trim();
      postMediaUrls = [trimmed, ...postMediaUrls.filter((u) => u !== trimmed)];
    }

    if (action !== "draft" && postMediaUrls.length === 0) {
      return toast.error(
        "Hãy chọn sản phẩm có ảnh hoặc nhập URL ảnh công khai trước khi gửi duyệt",
      );
    }

    let scheduledAt: string | null = null;
    if (publishMode === "schedule") {
      const d = new Date(`${date}T${time}`);
      if (Number.isNaN(d.getTime())) return toast.error("Thời gian đăng không hợp lệ");
      scheduledAt = d.toISOString();
    }

    setSaving(true);
    try {
      const fullCta = formatFullCta(draft.cta, draft.ctaLink);
      const caption = [draft.caption.trim(), fullCta && `👉 ${fullCta}`, draft.hashtags.join(" ")]
        .filter(Boolean)
        .join("\n\n");
      const postProducts = (method === "ai" ? aiProducts : manualProducts).map((p) => ({
        id: p.id,
        name: p.name,
        code: p.sku || `EL-${p.id.slice(0, 6)}`,
        img:
          p.imageUrl ||
          "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=200&auto=format&fit=crop&q=80",
      }));
      const configuredLink =
        method === "manual" && /^https?:\/\//i.test(manual.link.trim()) ? manual.link.trim() : "";
      const ctaUrl =
        draft.ctaLink ||
        draft.cta.match(/https?:\/\/[^\s]+/)?.[0] ||
        configuredLink ||
        "https://elane.vn";
      const ctaRawLabel =
        draft.cta
          .replace(ctaUrl, "")
          .replace(/^[👉🔗\s*-]+/, "")
          .replace(/[-–—:]\s*$/, "")
          .trim() || "Khám phá ngay";
      const ctaLabel = ctaRawLabel.endsWith("→") ? ctaRawLabel : `${ctaRawLabel} →`;

      const created = await adminApi.createSocialContent({
        connectionId: ctx.data.connections[0]?.id ?? null,
        title: draft.caption.trim().split(/\n+/)[0]?.slice(0, 120) || draft.title || "Bài viết mới",
        caption,
        mediaType: postMediaUrls.length > 1 ? "CAROUSEL" : "IMAGE",
        mediaUrls: postMediaUrls,
        source: method === "ai" ? "ai_assisted" : "manual",
        status: action === "draft" ? "draft" : "pending",
        scheduledAt,
        metadata: {
          cta: { label: ctaLabel, url: ctaUrl },
          ...(postProducts.length > 0 ? { products: postProducts } : {}),
          ...(draft.hashtags.length > 0 ? { hashtags: draft.hashtags } : {}),
        },
      });

      const id = (created as unknown as { id?: string } | undefined)?.id;

      // CHỈ khi người dùng bấm "Duyệt & Đăng ngay" mới tự động gọi duyệt và xuất bản
      if (action === "publish_now" && id) {
        await adminApi.approveSocialContent(id, { publishNow: true, scheduledAt: null });
      }

      await ctx.reload(true);

      if (action === "draft") {
        toast.success("Đã lưu bài viết vào Bản nháp");
      } else if (action === "pending") {
        toast.success(
          publishMode === "schedule"
            ? "Đã gửi duyệt & lên lịch! Bài viết đang ở mục 'Chờ duyệt'."
            : "Đã gửi duyệt thành công! Bài viết đang ở mục 'Chờ duyệt'.",
        );
      } else {
        toast.success("Đã duyệt và đăng ngay bài viết!");
      }

      ctx.go("posts");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể lưu nội dung");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    media.forEach((m) => URL.revokeObjectURL(m.url));
    setAi(initialAi(ctx.aiPreset));
    setManual(initialManual());
    setMedia([]);
    setAiMediaOrder([]);
    setAiSourceImageIds([]);
    setManualSourceImageIds([]);
    setMediaUrl("");
    setVariants([]);
    setActive(0);
    setEditing(false);
    setAiCta(CTAS[0]);
    setAiCtaLink("");
    setMenu(false);
    setSelectedLookbook(null);
    setTagOpts(DEFAULT_TAG_OPTIONS);
  }

  const previewProducts = method === "ai" ? aiProducts : manualProducts;

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <PageHeader
        onBack={() => ctx.go("posts")}
        title="Tạo content mới"
        desc={DESC[method]}
        actions={
          <>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => void submit(false)}
              className="gap-2"
            >
              <Save className="size-4" />
              Lưu nháp
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.info("Hướng dẫn sử dụng sẽ được bổ sung")}
              className="gap-2"
            >
              <BookOpen className="size-4" />
              Xem hướng dẫn
            </Button>
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                aria-label="Thêm tùy chọn"
                aria-expanded={menu}
                onClick={() => setMenu((m) => !m)}
              >
                <MoreHorizontal className="size-4" />
              </Button>
              {menu && (
                <div className="absolute right-0 top-11 z-20 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-md">
                  <button
                    type="button"
                    onClick={reset}
                    className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    Làm mới biểu mẫu
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />
      <Stepper steps={STEPS[method]} current={step} />

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(340px,1fr)]">
        {/* ---------- Cột trái: phương thức + nhập liệu ---------- */}
        <div className="ai-content-left flex min-w-0 flex-col gap-5">
          <section className={cn(card, "p-5")}>
            <h2 className="text-lg font-semibold">1. Chọn phương thức tạo content</h2>
            <div role="radiogroup" className="mt-4 grid gap-3 sm:grid-cols-2">
              {METHODS.map(({ id, icon: Icon, title, desc }) => {
                const on = method === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMethod(id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                      on
                        ? "border-[#6941c6] bg-violet-50 ring-1 ring-[#6941c6]"
                        : "border-slate-200 hover:border-violet-200",
                    )}
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-violet-50 text-[#6941c6]">
                      <Icon className="size-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{desc}</span>
                    </span>
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border-2",
                        on ? "border-[#6941c6]" : "border-slate-300",
                      )}
                    >
                      {on && <span className="size-2.5 rounded-full bg-[#6941c6]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {method === "ai" ? (
            variants.length === 0 ? (
              <div className="content-input-scroll min-h-0 w-full flex-1 lg:h-full lg:overflow-y-auto">
                <AiInputPanel
                  form={ai}
                  upd={updAi}
                  preset={ctx.aiPreset}
                  targets={targets}
                  onToggleChannel={toggleChannel}
                  busy={generating}
                  hasResult={variants.length > 0}
                  onGenerate={() => void generate()}
                  onSeeAll={() => {
                    setPickerMode("ai");
                    setPickerOpen(true);
                  }}
                  aiKey={aiKeyStatus}
                  onManageKeys={() => {
                    window.location.href = "/ai-keys";
                  }}
                  products={catalogProducts}
                  selectedLookbook={selectedLookbook}
                  onClearLookbook={() => setSelectedLookbook(null)}
                  featuredFirst={tagOpts.featured}
                  productImages={productMedia}
                  selectedProductImageIds={aiSourceImageIds}
                  onToggleProductImage={(id) =>
                    setAiSourceImageIds((current) => {
                      if (current.includes(id)) return current.filter((item) => item !== id);
                      if (current.length >= 10) {
                        toast.warning("Chỉ có thể gửi tối đa 10 ảnh sản phẩm cho AI");
                        return current;
                      }
                      return [...current, id];
                    })
                  }
                />
              </div>
            ) : (
              <div className="w-full min-w-0">
                <AiResultPanel
                  variants={variants}
                  active={active}
                  onActive={(i) => {
                    setActive(i);
                    setEditing(false);
                  }}
                  editing={editing}
                  onEdit={editVariant}
                  onPatch={patchVariant}
                  busy={generating}
                  onRegenerate={() => void generate()}
                  cta={aiCta}
                  onCta={setAiCta}
                  ctaLink={aiCtaLink}
                  onCtaLink={setAiCtaLink}
                  suggestedLinks={suggestedLinks}
                  media={aiMediaOptions}
                  selectedMediaIds={aiMediaOrder}
                  onSelectedMediaIds={setAiMediaOrder}
                  onFiles={(files) => void addFiles(files)}
                  onChooseLibrary={() => {
                    setPickerMode("ai");
                    setPickerOpen(true);
                  }}
                  keyUsed={keyUsed}
                />
              </div>
            )
          ) : (
            <ManualComposer
              form={manual}
              upd={updManual}
              products={manualProducts}
              onPickProduct={() => {
                setPickerMode("manual");
                setPickerOpen(true);
              }}
              lookbook={selectedLookbook}
              onClearLookbook={() => setSelectedLookbook(null)}
              media={media}
              onFiles={(f) => void addFiles(f)}
              onRemoveMedia={removeMedia}
              productImages={manualProductMedia}
              selectedProductImageIds={manualSourceImageIds}
              onToggleProductImage={(id) =>
                setManualSourceImageIds((current) => {
                  if (current.includes(id)) return current.filter((item) => item !== id);
                  if (current.length + media.length >= 10) {
                    toast.warning("Bài viết chỉ có thể chứa tối đa 10 ảnh/video");
                    return current;
                  }
                  return [...current, id];
                })
              }
              targets={targets}
              onToggleChannel={toggleChannel}
            />
          )}
        </div>

        {/* ---------- Cột phải: xem trước + lịch đăng ---------- */}
        <aside className="min-w-0 space-y-5">
          <PreviewPanel
            title={method === "ai" ? "4. Xem trước trên các kênh" : "3. Xem trước theo kênh"}
            channel={previewCh}
            onChannel={setPreviewCh}
            device={device}
            onDevice={setDevice}
            draft={draft}
            products={previewProducts}
            media={method === "manual" ? manualPostMedia : selectedAiMedia}
            targets={targets}
            accounts={ctx.channels}
          />
          <SchedulePanel
            mode={publishMode}
            onMode={setPublishMode}
            date={date}
            onDate={(v) => setWhen([v, time])}
            time={time}
            onTime={(v) => setWhen([date, v])}
            mediaUrl={mediaUrl}
            onMediaUrl={setMediaUrl}
            unsupported={targets.some((t) => t !== "instagram")}
            busy={saving}
            onCancel={() => ctx.go("posts")}
            onDraft={() => void submit("draft")}
            onSubmit={() => void submit("pending")}
            onPublishNow={() => void submit("publish_now")}
          />
        </aside>
      </div>

      {saving && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/25 p-4 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-label="Đang gửi bài viết"
        >
          <div className="flex w-full max-w-xs flex-col items-center rounded-2xl border border-white/70 bg-white px-6 py-5 text-center shadow-2xl">
            <span className="grid size-12 place-items-center rounded-full bg-violet-100 text-[#6941c6]">
              <Loader2 className="size-6 animate-spin" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-900">Đang gửi bài viết…</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Đang lưu nội dung và chờ hệ thống xử lý. Vui lòng không đóng trang.
            </p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-violet-100">
              <span className="block h-full w-2/5 animate-pulse rounded-full bg-[#6941c6]" />
            </div>
          </div>
        </div>
      )}

      <ProductBstPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        products={catalogProducts}
        lookbooks={catalogLookbooks}
        selectedIds={pickerMode === "ai" ? ai.picked : manual.productIds}
        selectedLookbook={selectedLookbook}
        singleSelect={false}
        tagOptions={tagOpts}
        onApply={(selectedIds, pickedProds, pickedLb, opts) => {
          setTagOpts(opts);
          setSelectedLookbook(pickedLb);
          if (pickedProds.length > 0) {
            setCatalogProducts((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newItems = pickedProds.filter((p) => !existingIds.has(p.id));
              return newItems.length > 0 ? [...newItems, ...prev] : prev;
            });
          }
          if (pickerMode === "ai") {
            setAi((prev) => ({ ...prev, picked: selectedIds }));
          } else {
            setManual((prev) => ({ ...prev, productIds: selectedIds }));
            if (pickedProds[0]?.imageUrl) {
              setMediaUrl(pickedProds[0].imageUrl);
            }
          }
        }}
      />
    </div>
  );
}
