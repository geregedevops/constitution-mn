"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";

interface ChatInterfaceProps {
  contentId: string;
  contentTitle: string;
  suggestions?: string[];
}

export function ChatInterface({ contentId, contentTitle, suggestions }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { contentId } }),
    [contentId]
  );

  const { messages, sendMessage, regenerate, status, error, stop } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("message") as HTMLInputElement;
    const text = input.value.trim();
    if (!text || isLoading) return;

    sendMessage({ text });
    input.value = "";
  }

  const handleSuggestion = useCallback(
    (text: string) => {
      if (isLoading) return;
      sendMessage({ text });
    },
    [isLoading, sendMessage]
  );

  function handleNewChat() {
    window.location.reload();
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
  }

  // Listen for sidebar suggestion clicks
  useEffect(() => {
    function handler(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest("[data-suggestion]");
      if (btn) {
        const text = btn.getAttribute("data-suggestion");
        if (text) handleSuggestion(text);
      }
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [handleSuggestion]);

  // Listen for "new chat" button in sidebar
  useEffect(() => {
    function handler(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest("[data-new-chat]");
      if (btn) handleNewChat();
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const allMessages = messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    text:
      m.parts
        ?.filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("") ?? "",
  }));

  return (
    <>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-8">
        <div className="max-w-[760px] mx-auto px-4 sm:px-8 space-y-8">
          {/* Welcome */}
          {allMessages.length === 0 && (
            <div className="text-center py-16 sm:py-24">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#F5F3FF] flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-primary/40">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Сайн байна уу!</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                &quot;{contentTitle}&quot; сэдвийн талаар асуултаа бичээрэй
              </p>
              {suggestions && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center md:hidden max-w-md mx-auto">
                  {suggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(q)}
                      className="px-3.5 py-2 rounded-lg border border-border text-[13px] text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-[#F5F3FF] transition-all cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All messages */}
          {allMessages.map((msg, idx) => {
            const isLastAssistant =
              msg.role === "assistant" &&
              idx === allMessages.findLastIndex((m) => m.role === "assistant");
            return (
            <div key={msg.id}>
              {msg.role === "user" ? (
                <div className="flex justify-end mb-2">
                  <div className="max-w-[70%] sm:max-w-[65%] px-4 py-3 rounded-2xl rounded-br-sm bg-primary text-white text-sm leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div className="pl-5 border-l-[3px] border-primary/30">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-white">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-[13px] font-semibold text-primary">Үндсэн Хууль AI</span>
                  </div>
                  <div className="text-sm leading-[1.75] prose prose-sm prose-slate max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:mt-4 prose-headings:mb-2 prose-strong:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  {/* Actions */}
                  {status !== "streaming" && (
                    <div className="flex gap-1 mt-3">
                      <button
                        onClick={() => handleCopy(msg.text)}
                        className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-[#F5F3FF] transition-all cursor-pointer"
                        title="Хуулах"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      </button>
                      {isLastAssistant && !isLoading && (
                        <button
                          onClick={() => regenerate()}
                          className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-[#F5F3FF] transition-all cursor-pointer"
                          title="Дахин хариулах"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
          })}

          {/* Typing */}
          {isLoading && status === "submitted" && (
            <div className="pl-5 border-l-[3px] border-primary/30">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-[13px] font-semibold text-primary">Үндсэн Хууль AI</span>
              </div>
              <div className="flex gap-1.5 py-1">
                <span className="w-[7px] h-[7px] rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
                <span className="w-[7px] h-[7px] rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
                <span className="w-[7px] h-[7px] rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-destructive text-sm bg-destructive/5 rounded-xl p-4 border border-destructive/15">
              Алдаа гарлаа: {error.message}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border bg-card px-4 sm:px-8 py-4 shrink-0">
        <div className="max-w-[760px] mx-auto flex gap-3">
          <Input
            name="message"
            placeholder="Асуултаа бичнэ үү..."
            disabled={isLoading}
            className="flex-1 h-12 rounded-xl bg-background border-border focus:border-primary/40 placeholder:text-muted-foreground/50 text-sm"
            autoComplete="off"
          />
          {isLoading ? (
            <Button
              type="button"
              onClick={() => stop()}
              variant="outline"
              className="w-12 h-12 shrink-0 rounded-xl cursor-pointer p-0 border-destructive/30 text-destructive hover:bg-destructive/5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            </Button>
          ) : (
            <Button type="submit" className="w-12 h-12 shrink-0 rounded-xl cursor-pointer p-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
