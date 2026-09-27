import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Check,
  RotateCw,
  AlertCircle,
  ArrowDown,
  Globe,
  FileText,
  Mail,
  ExternalLink,
  Loader2,
  X
} from "lucide-react";
import { Message, Provider, Doc } from "../lib/store";

interface ChatThreadProps {
  messages: Message[];
  docs: Doc[];
  busy: boolean;
  statusLines: string[];
  onRetry: () => void;
  onRegenerate: (index: number) => void;
}

const PROVIDER_NAMES: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  xai: "xAI",
};

const PROVIDER_DOTS: Record<Provider, string> = {
  openai: "#000000",
  anthropic: "#D97757",
  gemini: "#4285F4",
  xai: "#111111",
};

export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  docs,
  busy,
  statusLines,
  onRetry,
  onRegenerate,
}) => {
  const threadEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Citation popover state
  const [citationPopover, setCitationPopover] = useState<{
    fileName: string;
    page: number;
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const scrollToBottom = (smooth = true) => {
    threadEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (!showJumpToBottom) {
      scrollToBottom(true);
    }
  }, [messages, busy, statusLines]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowJumpToBottom(!isNearBottom);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const formatDateHeader = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    if (d.toDateString() === today.toDateString()) return "TODAY";
    if (d.toDateString() === yesterday.toDateString()) return "YESTERDAY";
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const handleCitationClick = (
    fileName: string,
    page: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    const doc = docs.find(d => d.name.toLowerCase() === fileName.toLowerCase());
    const rect = e.currentTarget.getBoundingClientRect();
    let text = "Page content not found.";
    if (doc && doc.pages[page - 1]) {
      text = doc.pages[page - 1].slice(0, 600) + (doc.pages[page - 1].length > 600 ? "..." : "");
    }
    setCitationPopover({
      fileName,
      page,
      text,
      x: rect.left,
      y: rect.bottom + window.scrollY,
    });
  };

  const renderCitationPills = (text: string) => {
    // Regex for [filename p.N]
    const citationRegex = /\[([^\]]+?)\s+p\.(\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const fileName = match[1];
      const pageNum = parseInt(match[2], 10);
      parts.push(
        <button
          key={`${fileName}-${pageNum}-${match.index}`}
          onClick={e => handleCitationClick(fileName, pageNum, e)}
          className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] rounded-full text-xs font-medium cursor-pointer border border-[#E5E7EB]"
        >
          <FileText className="w-3 h-3 text-[#6B7280]" />
          <span>
            {fileName} p.{pageNum}
          </span>
        </button>
      );
      lastIndex = citationRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6"
    >
      <div className="max-w-[896px] mx-auto space-y-6">
        {messages.map((msg, index) => {
          // Check if date divider is needed
          const prevMsg = messages[index - 1];
          const showDateHeader =
            !prevMsg ||
            new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

          return (
            <React.Fragment key={msg.id || index}>
              {showDateHeader && (
                <div className="flex items-center justify-center my-6">
                  <span className="px-3 py-1 bg-[#F3F4F6] rounded-full text-[11px] font-semibold text-[#6B7280] tracking-wider uppercase">
                    {formatDateHeader(msg.createdAt)}
                  </span>
                </div>
              )}

              {/* USER MESSAGE */}
              {msg.role === "user" && (
                <div className="flex flex-col items-end animate-fade-in">
                  <div className="max-w-[80%] bg-[#EEF2FF] text-[#111827] px-4 py-3 rounded-2xl rounded-tr-xs border border-[#E0E7FF] text-sm leading-relaxed shadow-2xs">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] mt-1 mr-1">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              )}

              {/* ASSISTANT MESSAGE */}
              {msg.role === "assistant" && (
                <div className="flex flex-col items-start animate-fade-in w-full">
                  <div className="w-full bg-white rounded-xl border border-[#E5E7EB] shadow-xs overflow-hidden">
                    {/* Header Row */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAFBFD] border-b border-[#F3F4F6]">
                      <div className="flex items-center gap-2">
                        {msg.provider && (
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: PROVIDER_DOTS[msg.provider] }}
                          />
                        )}
                        <span className="text-xs font-semibold text-[#111827]">
                          Answered by {msg.provider ? PROVIDER_NAMES[msg.provider] : "Assistant"}{" "}
                          · {msg.model || ""}
                        </span>

                        {/* Tokens Pill */}
                        {(msg.inTokens !== undefined || msg.outTokens !== undefined) && (
                          <span className="px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[11px] text-[#6B7280] font-medium tabular-nums">
                            {(msg.inTokens || 0) + (msg.outTokens || 0)} tokens
                          </span>
                        )}

                        {/* Latency */}
                        {msg.latencyMs !== undefined && (
                          <span className="text-[11px] text-[#9CA3AF] tabular-nums font-medium">
                            {(msg.latencyMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          title="Copy reply"
                          className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => onRegenerate(index)}
                          title="Regenerate with current model"
                          className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Answer Body */}
                    <div className="p-4 sm:p-5 max-w-[68ch] text-sm text-[#111827] leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || "");
                            const codeString = String(children).replace(/\n$/, "");
                            if (!inline) {
                              return (
                                <div className="my-3 rounded-lg overflow-hidden border border-[#333333] bg-[#1E1E1E] text-white">
                                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#2D2D2D] text-xs font-mono text-[#9CA3AF]">
                                    <span>{match ? match[1] : "code"}</span>
                                    <button
                                      onClick={() => handleCopy(codeString, `code-${index}-${match?.[1]}`)}
                                      className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[11px]"
                                    >
                                      {copiedId === `code-${index}-${match?.[1]}` ? (
                                        <>
                                          <Check className="w-3 h-3 text-[#16A34A]" />
                                          <span>Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Copy</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <pre className="p-3 overflow-x-auto text-[13px] font-mono leading-normal text-[#E5E7EB]">
                                    <code>{children}</code>
                                  </pre>
                                </div>
                              );
                            }
                            return (
                              <code
                                className="px-1.5 py-0.5 bg-[#F3F4F6] text-[#4F46E5] rounded font-mono text-[13px]"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          p({ children }: any) {
                            // If text contains citations, parse them into pills
                            return (
                              <p className="mb-3 last:mb-0">
                                {React.Children.map(children, child => {
                                  if (typeof child === "string") {
                                    return renderCitationPills(child);
                                  }
                                  return child;
                                })}
                              </p>
                            );
                          },
                          a({ href, children }: any) {
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#4F46E5] underline hover:text-[#4338CA]"
                              >
                                {children}
                              </a>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>

                      {/* Soft Notices */}
                      {msg.notices && msg.notices.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {msg.notices.map((notice, nIdx) => (
                            <p
                              key={nIdx}
                              className="text-xs text-[#D97706] bg-[#FFFBEB] px-2.5 py-1 rounded-md border border-[#FEF3C7]"
                            >
                              {notice}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Search Skipped Note */}
                      {msg.searchSkipped && (
                        <p className="mt-2 text-xs text-[#6B7280] italic">
                          This model doesn&apos;t support web search, so it answered without it.
                        </p>
                      )}

                      {/* Sources Used Line */}
                      {msg.used &&
                        (msg.used.web !== undefined ||
                          msg.used.docs !== undefined ||
                          msg.used.email !== undefined) && (
                          <div className="mt-4 pt-3 border-t border-[#F3F4F6] text-xs text-[#6B7280]">
                            <span>Sources used: </span>
                            {[
                              msg.used.web !== undefined &&
                                (msg.searchSkipped
                                  ? "Web · not supported by this model"
                                  : `Web (${msg.used.webVia === "tavily" ? "Tavily" : msg.provider ? PROVIDER_NAMES[msg.provider] : "provider"}) · ${msg.used.web} results`),
                              msg.used.docs !== undefined &&
                                `Docs · ${msg.used.docs} file${msg.used.docs === 1 ? "" : "s"}`,
                              msg.used.email !== undefined &&
                                (msg.used.emailError
                                  ? "Email · skipped"
                                  : `Email · ${msg.used.email} recent`),
                            ]
                              .filter(Boolean)
                              .join("  |  ")}
                          </div>
                        )}

                      {/* Web Search Sources Chips */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-[#F3F4F6]">
                          <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                            Sources
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((s, sIdx) => {
                              let host = "";
                              try {
                                host = new URL(s.url).hostname;
                              } catch {
                                host = s.url;
                              }
                              return (
                                <a
                                  key={sIdx}
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-full text-xs text-[#374151] transition-all max-w-xs truncate"
                                >
                                  <span className="w-4 h-4 rounded-full bg-[#E5E7EB] text-[#4B5563] flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {sIdx + 1}
                                  </span>
                                  {host && (
                                    <img
                                      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
                                      alt=""
                                      className="w-3.5 h-3.5 shrink-0"
                                      onError={e => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                  )}
                                  <span className="truncate">{s.title || host}</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-[#9CA3AF] shrink-0" />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ERROR MESSAGE */}
              {msg.role === "error" && (
                <div className="flex flex-col items-start animate-fade-in w-full">
                  <div className="w-full bg-[#FEF2F2] border border-[#FEE2E2] rounded-xl p-4 text-xs text-[#DC2626]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{msg.content}</p>
                        </div>
                      </div>
                      <button
                        onClick={onRetry}
                        className="px-3 py-1 bg-white hover:bg-[#FDF2F2] border border-[#FCA5A5] text-[#DC2626] font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* BUSY STATUS BUBBLE */}
        {busy && (
          <div className="flex flex-col items-start animate-fade-in">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-2xs space-y-1.5 text-xs text-[#4B5563]">
              {statusLines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4F46E5]" />
                  <span>{line}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-[#4F46E5] font-medium pt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-ping" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Jump to bottom button */}
      {showJumpToBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="fixed bottom-28 right-8 z-30 p-2.5 bg-white text-[#4F46E5] border border-[#E5E7EB] rounded-full shadow-lg hover:bg-[#F9FAFB] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowDown className="w-4 h-4" />
          <span>Jump to latest</span>
        </button>
      )}

      {/* Citation preview popover */}
      {citationPopover && (
        <div
          className="fixed z-50 bg-white border border-[#E5E7EB] shadow-xl rounded-xl p-3 max-w-sm text-xs animate-fade-in"
          style={{
            left: Math.min(citationPopover.x, window.innerWidth - 320),
            top: citationPopover.y + 8,
          }}
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#F3F4F6]">
            <span className="font-semibold text-[#111827]">
              {citationPopover.fileName} · Page {citationPopover.page}
            </span>
            <button
              onClick={() => setCitationPopover(null)}
              className="text-[#9CA3AF] hover:text-[#111827] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[#4B5563] leading-relaxed max-h-40 overflow-y-auto">
            {citationPopover.text}
          </p>
        </div>
      )}
    </div>
  );
};
