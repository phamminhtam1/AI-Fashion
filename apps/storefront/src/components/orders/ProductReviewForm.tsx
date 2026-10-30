import { useState } from "react";
import { Check, Star } from "lucide-react";
import { toast } from "sonner";
import { storeApi, type StoreReview } from "@/lib/api";

type Props = {
  orderItemId: string;
  review: StoreReview | null | undefined;
  onSubmitted: (review: StoreReview) => void;
};

export function ProductReviewForm({ orderItemId, review, onSubmitted }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  if (review) {
    return (
      <div className="mt-3 border-t border-border/60 pt-3 text-xs">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Đã đánh giá · {"★".repeat(review.rating)}
        </div>
        {review.title && <p className="mt-1 font-medium text-foreground">{review.title}</p>}
        {review.comment && <p className="mt-1 text-muted-foreground">{review.comment}</p>}
      </div>
    );
  }

  async function submit() {
    if (!comment.trim()) {
      toast.error("Hãy chia sẻ cảm nhận của bạn về sản phẩm");
      return;
    }
    setSaving(true);
    try {
      const created = await storeApi.submitReview({
        order_item_id: orderItemId,
        rating,
        ...(title.trim() ? { title: title.trim() } : {}),
        comment: comment.trim(),
      });
      onSubmitted(created);
      toast.success("Cảm ơn bạn đã đánh giá sản phẩm!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không gửi được đánh giá");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Đánh giá sản phẩm</p>
      <div className="mt-2 flex items-center gap-1" aria-label="Chọn số sao">
        {Array.from({ length: 5 }, (_, index) => {
          const value = index + 1;
          return (
            <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} sao`}>
              <Star className={`h-5 w-5 transition ${value <= rating ? "fill-amber-400 text-amber-400" : "text-border"}`} />
            </button>
          );
        })}
        <span className="ml-2 text-xs text-muted-foreground">{rating}/5</span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,180px)_1fr]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Tiêu đề (tuỳ chọn)" className="border border-border bg-background px-3 py-2 text-xs outline-none focus:border-foreground" />
        <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="Chia sẻ trải nghiệm của bạn…" className="border border-border bg-background px-3 py-2 text-xs outline-none focus:border-foreground" />
      </div>
      <button type="button" disabled={saving} onClick={() => void submit()} className="mt-2 bg-foreground px-4 py-2 text-[11px] uppercase tracking-wider text-background disabled:opacity-50">
        {saving ? "Đang gửi…" : "Gửi đánh giá"}
      </button>
    </div>
  );
}
