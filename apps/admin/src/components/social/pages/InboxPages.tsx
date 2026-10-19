import { useState } from "react";
import { AlertCircle, Bot, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOCK_COMMENTS, MOCK_THREADS, USE_MOCK_FALLBACK, type CommentRow, type Thread } from "../mock";
import type { SocialCtx } from "../types";
import { Avatar, ChannelLogo, Empty, PageHeader, Pill, card } from "../ui";

/* ---------- Tin nhắn ---------- */
export function MessagesPage({ ctx }: { ctx: SocialCtx }) {
  // TODO(api): thay MOCK_THREADS bằng GET /admin/social/messages
  const [threads, setThreads] = useState<Thread[]>(MOCK_THREADS);
  const [id, setId] = useState(threads[0]?.id);
  const [draft, setDraft] = useState("");
  const t = threads.find((x) => x.id === id);

  function send() {
    if (!draft.trim() || !t) return;
    // TODO(api): POST /admin/social/messages/:id/reply
    setThreads((all) => all.map((x) => (x.id === t.id ? { ...x, unread: 0, messages: [...x.messages, { from: "staff", text: draft.trim(), time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) }] } : x)));
    setDraft("");
  }

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <PageHeader onBack={() => ctx.go("overview")} title="Tin nhắn" desc="Hộp thư tập trung từ tất cả kênh. AI tự trả lời, nhân viên xử lý các trường hợp đặc biệt." />
      <div className={cn(card, "grid min-h-[520px] overflow-hidden md:grid-cols-[320px_1fr]")}>
        <ul className="divide-y divide-slate-100 border-b border-slate-200 md:border-b-0 md:border-r">
          {threads.map((x) => (
            <li key={x.id}><button onClick={() => { setId(x.id); setThreads((all) => all.map((y) => (y.id === x.id ? { ...y, unread: 0 } : y))); }} className={cn("flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50", id === x.id && "bg-violet-50/60")}>
              <div className="relative"><Avatar label={x.name[0].toUpperCase()} /><span className="absolute -bottom-1 -right-1"><ChannelLogo id={x.channel} size="xs" /></span></div>
              <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold">{x.name}</p><span className="text-xs text-slate-400">{x.time}</span></div><p className="truncate text-xs text-slate-500">{x.preview}</p></div>
              {x.unread > 0 && <span className="grid size-5 place-items-center rounded-full bg-[#6941c6] text-[11px] font-semibold text-white">{x.unread}</span>}
            </button></li>))}
        </ul>
        {t ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-slate-200 p-4"><ChannelLogo id={t.channel} size="sm" /><p className="font-semibold">{t.name}</p></div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-4">
              {t.messages.map((m, i) => (
                <div key={i} className={cn("flex", m.from === "customer" ? "justify-start" : "justify-end")}>
                  <div className={cn("max-w-[75%] rounded-lg px-3 py-2 text-sm", m.from === "customer" ? "border border-slate-200 bg-white" : m.from === "ai" ? "bg-violet-100 text-violet-900" : "bg-[#6941c6] text-white")}>
                    {m.from === "ai" && <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold"><Bot className="size-3" />AI trả lời</p>}{m.text}<p className="mt-1 text-right text-[10px] opacity-60">{m.time}</p></div>
                </div>))}
            </div>
            <div className="flex gap-2 border-t border-slate-200 p-3"><input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Nhập tin nhắn..." className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-[#6941c6]" /><Button onClick={send} className="gap-2 bg-[#6941c6] hover:bg-[#5b36b0]"><Send className="size-4" />Gửi</Button></div>
          </div>
        ) : <Empty>Chọn một cuộc trò chuyện.</Empty>}
      </div>
      <p className="text-xs text-slate-400">Dữ liệu mẫu – chưa nối API tin nhắn. <button onClick={() => ctx.go("connect")} className="text-[#6941c6] hover:underline">Kiểm tra kết nối kênh</button></p>
    </div>
  );
}

/* ---------- Bình luận ---------- */
const LABEL: Record<string, string> = { new: "Mới", replied: "AI đã trả lời", escalated: "Cần nhân viên" };

export function CommentsPage({ ctx }: { ctx: SocialCtx }) {
  const real: CommentRow[] = ctx.data.interactions.map((i) => ({ id: i.id, author: i.authorUsername || "instagram_user", message: i.message, createdAt: i.createdAt, status: i.status, aiReply: i.aiReply, escalationReason: i.escalationReason, real: true }));
  const items = real.length ? real : USE_MOCK_FALLBACK ? MOCK_COMMENTS : [];
  const [filter, setFilter] = useState("all");
  const list = items.filter((i) => filter === "all" || i.status === filter);

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <PageHeader onBack={() => ctx.go("overview")} title="Bình luận" desc="Bình luận từ các bài đăng. AI tự trả lời và chuyển nhân viên khi cần." />
      <div className="flex gap-1 border-b border-slate-200">{[["all", "Tất cả"], ["new", "Mới"], ["replied", "AI đã trả lời"], ["escalated", "Cần nhân viên"]].map(([id, label]) => <button key={id} onClick={() => setFilter(id)} className={cn("whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold", filter === id ? "border-[#6941c6] text-[#6941c6]" : "border-transparent text-slate-500 hover:text-slate-900")}>{label}</button>)}</div>
      <section className={cn(card, "divide-y divide-slate-100")}>
        {list.map((i) => (
          <div key={i.id} className="flex items-start gap-3 p-4">
            <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", i.status === "escalated" ? "bg-amber-100 text-amber-700" : "bg-violet-50 text-violet-700")}>{i.status === "escalated" ? <AlertCircle className="size-4" /> : <MessageCircle className="size-4" />}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><p className="font-semibold">@{i.author}</p><span className="text-xs text-slate-400">{new Date(i.createdAt).toLocaleString("vi-VN")}</span></div>
              <p className="mt-1 text-sm text-slate-700">{i.message}</p>
              {i.aiReply && <div className="mt-2 rounded-md bg-violet-50 p-2.5 text-sm text-violet-900"><span className="font-semibold">AI: </span>{i.aiReply}</div>}
              {i.escalationReason && <p className="mt-2 text-xs font-medium text-amber-700">{i.escalationReason}</p>}
            </div>
            <Pill tone={i.status === "escalated" ? "amber" : i.status === "replied" ? "violet" : "slate"}>{LABEL[i.status] ?? i.status}</Pill>
            {i.status === "escalated" && <Button size="sm" variant="outline" onClick={() => (i.real ? void ctx.retryReply(i.id) : toast.info("Đây là dữ liệu mẫu"))}>Thử AI lại</Button>}
          </div>))}
        {!list.length && <Empty>Chưa có bình luận.</Empty>}
      </section>
    </div>
  );
}
