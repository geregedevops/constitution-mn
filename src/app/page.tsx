import { db } from "@/lib/db";
import { ChatInterface } from "@/components/chat-interface";

export const dynamic = "force-dynamic";

const SUGGESTIONS = [
  "Ерөнхийлөгчийн бүрэн эрхийн хугацаа?",
  "Иргэний үндсэн эрх, эрх чөлөө?",
  "УИХ хэдэн гишүүнтэй вэ?",
  "Шүүх засаглалын тогтолцоо?",
];

export default async function HomePage() {
  const content = await db.content.findFirst({
    where: { isProcessed: true },
    include: { _count: { select: { chunks: true } } },
  });

  if (!content) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <h2 className="text-lg font-bold mb-2">Контент олдсонгүй</h2>
          <p className="text-sm text-muted-foreground">
            Мэдээллийн сан дахь контент боловсруулагдаагүй байна.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex overflow-hidden">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-[300px] lg:w-[320px] border-r border-border bg-card flex-col shrink-0">
        <div className="p-6 border-b border-border/60">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight leading-snug">{content.title}</h2>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
              <span className="w-[7px] h-[7px] rounded-full bg-emerald-500 animate-pulse-soft" />
              AI бэлэн
            </div>
            <button
              data-new-chat
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-[#F5F3FF] transition-all cursor-pointer"
            >
              Шинэ яриа
            </button>
          </div>
        </div>

        <div className="p-5 border-b border-border/60">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Санал болгох асуулт
          </div>
          <div className="space-y-1.5" id="suggestions">
            {SUGGESTIONS.map((q, i) => (
              <button
                key={i}
                data-suggestion={q}
                className="block w-full text-left px-3.5 py-2.5 rounded-lg border border-border bg-card text-[13px] text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-[#F5F3FF] transition-all cursor-pointer leading-snug"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Мэдээлэл
          </div>
          <div className="space-y-2.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Модел</span>
              <span className="font-semibold">Gemini 2.5 Flash</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chunks</span>
              <span className="font-semibold">{content._count.chunks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embedding</span>
              <span className="font-semibold">768 dim</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Хэл</span>
              <span className="font-semibold">Монгол</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden border-b border-border/60 bg-card px-4 py-3">
          <h1 className="text-[15px] font-bold tracking-tight truncate">{content.title}</h1>
        </div>

        <ChatInterface
          contentId={content.id}
          contentTitle={content.title}
          suggestions={SUGGESTIONS}
        />
      </div>
    </div>
  );
}
