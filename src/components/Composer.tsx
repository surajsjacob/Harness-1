import React, { useRef, useEffect } from "react";
import {
  Paperclip,
  Globe,
  Mail,
  ArrowUp,
  Square,
  X,
  FileText,
  AlertCircle
} from "lucide-react";
import { Doc, Settings } from "../lib/store";

interface ComposerProps {
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  enabledDocs: Doc[];
  onToggleDoc: (id: string, enabled: boolean) => void;
  webSearch: boolean;
  onToggleWebSearch: (val: boolean) => void;
  includeEmail: boolean;
  onToggleIncludeEmail: (val: boolean) => void;
  settings: Settings;
  onOpenSettings: (tab?: "keys" | "email" | "data") => void;
  onUploadFile: (file: File) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  searchNotice?: string | null;
  onDismissSearchNotice?: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  setInput,
  onSend,
  onStop,
  busy,
  enabledDocs,
  onToggleDoc,
  webSearch,
  onToggleWebSearch,
  includeEmail,
  onToggleIncludeEmail,
  settings,
  onOpenSettings,
  onUploadFile,
  textareaRef,
  searchNotice,
  onDismissSearchNotice,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy && input.trim()) {
        onSend();
      }
    }
  };

  const handleEmailToggle = () => {
    if (!settings.gmail?.email) {
      onOpenSettings("email");
    } else {
      onToggleIncludeEmail(!includeEmail);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = "";
    }
  };

  return (
    <div className="p-4 max-w-[896px] mx-auto w-full">
      {/* One-time Search Notice */}
      {searchNotice && (
        <div className="mb-2 p-2.5 bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl flex items-center justify-between text-xs text-[#92400E] animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#D97706] shrink-0" />
            <span>{searchNotice}</span>
          </div>
          <button
            onClick={onDismissSearchNotice}
            className="p-1 hover:bg-[#FDE68A] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Composer Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-md focus-within:border-[#4F46E5] focus-within:ring-3 focus-within:ring-[#4F46E5]/10 transition-all overflow-hidden">
        {/* Active Context Chips Row */}
        {(enabledDocs.length > 0 || webSearch || includeEmail) && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-1 border-b border-[#F3F4F6]">
            {/* Enabled Docs Chips */}
            {enabledDocs.map(doc => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F3F4F6] text-[#374151] rounded-full text-xs font-medium border border-[#E5E7EB]"
              >
                <FileText className="w-3 h-3 text-[#6B7280]" />
                <span className="truncate max-w-[160px]">{doc.name}</span>
                <button
                  type="button"
                  onClick={() => onToggleDoc(doc.id, false)}
                  className="hover:text-[#111827] cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Web Search Chip */}
            {webSearch && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EFF6FF] text-[#2563EB] rounded-full text-xs font-medium border border-[#DBEAFE]">
                <Globe className="w-3 h-3" />
                <span>Web search on</span>
                <button
                  type="button"
                  onClick={() => onToggleWebSearch(false)}
                  className="hover:text-[#1D4ED8] cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Email Chip */}
            {includeEmail && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EEF2FF] text-[#4F46E5] rounded-full text-xs font-medium border border-[#E0E7FF]">
                <Mail className="w-3 h-3" />
                <span>Email on</span>
                <button
                  type="button"
                  onClick={() => onToggleIncludeEmail(false)}
                  className="hover:text-[#4338CA] cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          rows={1}
          className="w-full px-4 py-3 bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] resize-none focus:outline-none max-h-[240px]"
        />

        {/* Action icons row */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#FAFBFD] border-t border-[#F3F4F6]">
          <div className="flex items-center gap-1">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt,.md,.csv"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach document (.pdf, .docx, .txt, .md, .csv)"
              className="p-2 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-xl transition-colors cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onToggleWebSearch(!webSearch)}
              title="Toggle Web Search"
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                webSearch
                  ? "bg-[#EFF6FF] text-[#2563EB]"
                  : "text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]"
              }`}
            >
              <Globe className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleEmailToggle}
              title={
                settings.gmail?.email
                  ? "Include recent emails as context"
                  : "Connect Gmail in Settings"
              }
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                includeEmail
                  ? "bg-[#EEF2FF] text-[#4F46E5]"
                  : "text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]"
              }`}
            >
              <Mail className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#9CA3AF] hidden sm:inline select-none">
              Enter to send · Shift+Enter for new line
            </span>

            {busy ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-xs transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!input.trim()}
                onClick={onSend}
                title="Send message"
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 text-white shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
