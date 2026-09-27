import React from "react";
import { KeyRound, Cpu, MessageSquare, ArrowRight, Sparkles } from "lucide-react";

interface WelcomeProps {
  onOpenSettings: (tab?: "keys" | "email" | "data") => void;
  onSelectPrompt: (prompt: string, options?: { enableWeb?: boolean; openEmail?: boolean }) => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onOpenSettings, onSelectPrompt }) => {
  return (
    <div className="flex flex-col items-center justify-center max-w-2xl mx-auto my-auto p-6 text-center animate-fade-in">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#4F46E5] text-white font-bold text-2xl mb-4 shadow-sm">
        H
      </div>
      <h1 className="text-2xl font-bold text-[#111827] tracking-tight mb-2">Welcome to Harness</h1>
      <p className="text-sm text-[#6B7280] max-w-md mb-8">
        Bring your own model keys to chat with OpenAI, Claude, Gemini, and Grok. Connect documents and email with complete client-side privacy.
      </p>

      {/* 3 Step Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-8 text-left">
        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#4F46E5] font-semibold text-xs tracking-wider uppercase">
              <span className="w-5 h-5 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[11px] font-bold">1</span>
              <span>API Key</span>
            </div>
            <h3 className="text-sm font-semibold text-[#111827] mb-1">Add your key</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed mb-3">
              Add at least one key for OpenAI, Anthropic, Gemini, or Grok.
            </p>
          </div>
          <button
            onClick={() => onOpenSettings("keys")}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Open Settings</span>
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#6B7280] font-semibold text-xs tracking-wider uppercase">
              <span className="w-5 h-5 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[11px] font-bold text-[#4B5563]">2</span>
              <span>Model</span>
            </div>
            <h3 className="text-sm font-semibold text-[#111827] mb-1">Pick a model</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Select from available models in the top bar. Switch providers at any point in the chat.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] py-1.5 px-1 font-medium">
            <Cpu className="w-3.5 h-3.5" />
            <span>Switch anytime</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#6B7280] font-semibold text-xs tracking-wider uppercase">
              <span className="w-5 h-5 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[11px] font-bold text-[#4B5563]">3</span>
              <span>Chat</span>
            </div>
            <h3 className="text-sm font-semibold text-[#111827] mb-1">Ask anything</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Synthesize web search, documents, and email inbox in a single unified prompt.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] py-1.5 px-1 font-medium">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Web + Docs + Email</span>
          </div>
        </div>
      </div>

      {/* 4 Example Prompts */}
      <div className="w-full">
        <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Example prompts</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => onSelectPrompt("Summarise my uploaded PDF")}
            className="px-3 py-1.5 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-full text-xs text-[#374151] transition-all cursor-pointer shadow-2xs hover:text-[#111827]"
          >
            📄 Summarise my uploaded PDF
          </button>
          <button
            onClick={() => onSelectPrompt("What's in the news today?", { enableWeb: true })}
            className="px-3 py-1.5 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-full text-xs text-[#374151] transition-all cursor-pointer shadow-2xs hover:text-[#111827]"
          >
            🌐 What's in the news today?
          </button>
          <button
            onClick={() => onSelectPrompt("Draft a reply to my latest email", { openEmail: true })}
            className="px-3 py-1.5 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-full text-xs text-[#374151] transition-all cursor-pointer shadow-2xs hover:text-[#111827]"
          >
            ✉️ Draft a reply to my latest email
          </button>
          <button
            onClick={() => onSelectPrompt("Explain RAG in simple terms")}
            className="px-3 py-1.5 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-full text-xs text-[#374151] transition-all cursor-pointer shadow-2xs hover:text-[#111827]"
          >
            💡 Explain RAG in simple terms
          </button>
        </div>
      </div>
    </div>
  );
};
