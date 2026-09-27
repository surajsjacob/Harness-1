import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Mail,
  UploadCloud,
  Trash2,
  Check,
  Copy,
  RotateCw,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  ArrowLeft,
  Send,
  BookmarkPlus
} from "lucide-react";
import { Doc, Settings, Provider } from "../lib/store";
import { api } from "../lib/api";
import { EMAIL_SYSTEM, EMAIL_ACTIONS, TONES, emailBlock } from "../lib/prompts";

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  docs: Doc[];
  onToggleDoc: (id: string, enabled: boolean) => void;
  onDeleteDoc: (id: string) => void;
  onUploadFile: (file: File) => Promise<void>;
  uploadingDoc: boolean;
  uploadError: string | null;
  onDismissUploadError: () => void;
  settings: Settings;
  currentProvider?: Provider;
  currentModel?: string;
  onOpenSettings: (tab?: "keys" | "email" | "data") => void;
  contextTokenEstimate: number;
  initialTab?: "docs" | "email";
  initialEmailMode?: "inbox" | "paste";
}

type EmailListItem = {
  uid: number;
  from: string;
  subject: string;
  date: string;
};

type EmailFull = {
  uid: number;
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  date: string;
  messageId: string;
  references: string[];
  text: string;
};

export const RightPanel: React.FC<RightPanelProps> = ({
  isOpen,
  onClose,
  docs,
  onToggleDoc,
  onDeleteDoc,
  onUploadFile,
  uploadingDoc,
  uploadError,
  onDismissUploadError,
  settings,
  currentProvider,
  currentModel,
  onOpenSettings,
  contextTokenEstimate,
  initialTab = "docs",
  initialEmailMode = "inbox",
}) => {
  const [activeTab, setActiveTab] = useState<"docs" | "email">(initialTab);
  const [emailMode, setEmailMode] = useState<"inbox" | "paste">(initialEmailMode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email Inbox State
  const [emailList, setEmailList] = useState<EmailListItem[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailSearchQuery, setEmailSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailFull | null>(null);
  const [loadingSelectedEmail, setLoadingSelectedEmail] = useState(false);
  const [emailListError, setEmailListError] = useState<string | null>(null);

  // Email Action / AI state
  const [selectedTone, setSelectedTone] = useState<string>("Friendly");
  const [extraInstructions, setExtraInstructions] = useState<string>("");
  const [aiActionResult, setAiActionResult] = useState<string>("");
  const [draftReplyText, setDraftReplyText] = useState<string>("");
  const [aiActionRunning, setAiActionRunning] = useState<boolean>(false);
  const [aiActionType, setAiActionType] = useState<"summarise" | "actions" | "reply" | null>(null);
  const [aiActionError, setAiActionError] = useState<string | null>(null);
  const [savedDraftSuccess, setSavedDraftSuccess] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [copiedResult, setCopiedResult] = useState<boolean>(false);

  // Paste mode text
  const [pastedEmailText, setPastedEmailText] = useState<string>("");

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    if (initialEmailMode) setEmailMode(initialEmailMode);
  }, [initialTab, initialEmailMode]);

  // Load emails when switching to email inbox tab if Gmail is connected
  useEffect(() => {
    if (isOpen && activeTab === "email" && emailMode === "inbox" && settings.gmail?.email) {
      if (emailList.length === 0) {
        fetchEmails();
      }
    }
  }, [isOpen, activeTab, emailMode, settings.gmail]);

  const fetchEmails = async (query = emailSearchQuery) => {
    if (!settings.gmail) return;
    setLoadingEmails(true);
    setEmailListError(null);
    try {
      const res = await api<{ messages: EmailListItem[] }>("email/list", {
        email: settings.gmail.email,
        appPassword: settings.gmail.appPassword,
        query: query.trim() || undefined,
      });
      setEmailList(res.messages || []);
    } catch (e: any) {
      setEmailListError(e.message || "Failed to load emails");
    } finally {
      setLoadingEmails(false);
    }
  };

  const handleSelectEmail = async (uid: number) => {
    if (!settings.gmail) return;
    setLoadingSelectedEmail(true);
    setAiActionResult("");
    setDraftReplyText("");
    setAiActionError(null);
    setSavedDraftSuccess(null);
    try {
      const res = await api<EmailFull>("email/get", {
        email: settings.gmail.email,
        appPassword: settings.gmail.appPassword,
        uid,
      });
      setSelectedEmail(res);
    } catch (e: any) {
      setEmailListError(e.message || "Failed to fetch email details");
    } finally {
      setLoadingSelectedEmail(false);
    }
  };

  const handleRunEmailAction = async (type: "summarise" | "actions" | "reply") => {
    if (!currentProvider || !currentModel) {
      setAiActionError("Pick a model with a key first.");
      return;
    }
    const key = settings.keys[currentProvider];
    if (!key) {
      setAiActionError(`Add your ${currentProvider} key in Settings.`);
      return;
    }

    let targetEmailData: { from: string; subject: string; text: string; to?: string; date?: string };

    if (emailMode === "inbox") {
      if (!selectedEmail) {
        setAiActionError("Select an email first.");
        return;
      }
      targetEmailData = selectedEmail;
    } else {
      if (!pastedEmailText.trim()) {
        setAiActionError("Paste an email first.");
        return;
      }
      targetEmailData = {
        from: "(pasted)",
        subject: "(pasted)",
        text: pastedEmailText.trim(),
      };
    }

    setAiActionRunning(true);
    setAiActionType(type);
    setAiActionError(null);
    setSavedDraftSuccess(null);

    let instruction = "";
    if (type === "summarise") instruction = EMAIL_ACTIONS.summarise;
    else if (type === "actions") instruction = EMAIL_ACTIONS.actions;
    else instruction = EMAIL_ACTIONS.reply(selectedTone, extraInstructions.trim());

    try {
      const promptContent = `${emailBlock(targetEmailData)}\n\n${instruction}`;
      const res = await api<{ text: string }>("chat", {
        provider: currentProvider,
        key,
        model: currentModel,
        system: EMAIL_SYSTEM,
        messages: [{ role: "user", content: promptContent }],
        webSearch: false,
      });

      if (type === "reply") {
        setDraftReplyText(res.text);
      } else {
        setAiActionResult(res.text);
      }
    } catch (e: any) {
      setAiActionError(e.message || "AI action failed");
    } finally {
      setAiActionRunning(false);
    }
  };

  const handleSaveToGmailDrafts = async () => {
    if (!settings.gmail || !selectedEmail) return;
    setSavingDraft(true);
    setSavedDraftSuccess(null);
    try {
      await api("email/draft", {
        email: settings.gmail.email,
        appPassword: settings.gmail.appPassword,
        to: selectedEmail.replyTo || selectedEmail.from,
        subject: selectedEmail.subject,
        body: draftReplyText,
        inReplyTo: selectedEmail.messageId,
        references: selectedEmail.references,
      });
      setSavedDraftSuccess("Saved to Gmail Drafts. Open Gmail to review and send.");
    } catch (e: any) {
      setAiActionError(e.message || "Failed to save draft to Gmail.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 2000);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await onUploadFile(file);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-2xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 right-0 z-40 w-full sm:w-[320px] bg-[#F1F3FF] border-l border-[#E5E7EB] flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full lg:hidden"
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#111827] uppercase tracking-wider">
              Context
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#6B7280] hover:text-[#111827] hover:bg-[#E5EAFC] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 p-1 bg-white/70 rounded-xl text-xs font-semibold border border-[#E5E7EB]/60">
            <button
              onClick={() => setActiveTab("docs")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "docs"
                  ? "bg-white text-[#111827] shadow-xs"
                  : "text-[#6B7280] hover:text-[#111827]"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Docs</span>
            </button>
            <button
              onClick={() => setActiveTab("email")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "email"
                  ? "bg-white text-[#111827] shadow-xs"
                  : "text-[#6B7280] hover:text-[#111827]"
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {/* ================= DOCS TAB ================= */}
          {activeTab === "docs" && (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="p-5 border-2 border-dashed border-[#D1D5DB] hover:border-[#4F46E5] bg-white/50 hover:bg-white rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onUploadFile(f);
                    e.target.value = "";
                  }}
                  accept=".pdf,.docx,.txt,.md,.csv"
                  className="hidden"
                />
                <UploadCloud className="w-6 h-6 text-[#6B7280] mb-2" />
                <p className="text-xs font-semibold text-[#111827]">
                  Upload PDF, DOCX, TXT, MD, CSV
                </p>
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Drag &amp; drop or click to browse (up to 20 MB)
                </p>
              </div>

              {/* Uploading Spinner */}
              {uploadingDoc && (
                <div className="p-3 bg-white rounded-xl border border-[#E5E7EB] flex items-center gap-2.5 text-xs text-[#4F46E5]">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Reading document...</span>
                </div>
              )}

              {/* Upload Error */}
              {uploadError && (
                <div className="p-3 bg-[#FEF2F2] rounded-xl border border-[#FEE2E2] flex items-start justify-between text-xs text-[#DC2626]">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                  <button
                    onClick={onDismissUploadError}
                    className="text-[#DC2626] hover:text-[#991B1B] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Document List */}
              <div className="space-y-2">
                {docs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#9CA3AF]">
                    No documents attached yet
                  </div>
                ) : (
                  docs.map(doc => (
                    <div
                      key={doc.id}
                      className="p-3 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs hover:border-[#D1D5DB] transition-all flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-[#4F46E5] shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-[#111827] truncate">
                            {doc.name}
                          </p>
                          <p className="text-[11px] text-[#6B7280]">
                            {doc.pages.length} page{doc.pages.length === 1 ? "" : "s"} · Ready
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* On/Off Toggle */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={doc.enabled}
                            onChange={e => onToggleDoc(doc.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-7 h-4 bg-[#E5E7EB] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D1D5DB] after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#4F46E5]"></div>
                        </label>

                        {/* Delete Button */}
                        <button
                          onClick={() => onDeleteDoc(doc.id)}
                          className="p-1 text-[#9CA3AF] hover:text-[#DC2626] transition-colors cursor-pointer"
                          title="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= EMAIL TAB ================= */}
          {activeTab === "email" && (
            <div className="space-y-3">
              {/* Segmented control: Inbox | Paste an email */}
              <div className="grid grid-cols-2 p-0.5 bg-white/70 rounded-lg text-xs font-medium border border-[#E5E7EB]/60">
                <button
                  onClick={() => setEmailMode("inbox")}
                  className={`py-1 text-center rounded-md transition-all cursor-pointer ${
                    emailMode === "inbox"
                      ? "bg-white text-[#111827] shadow-2xs font-semibold"
                      : "text-[#6B7280] hover:text-[#111827]"
                  }`}
                >
                  Inbox
                </button>
                <button
                  onClick={() => setEmailMode("paste")}
                  className={`py-1 text-center rounded-md transition-all cursor-pointer ${
                    emailMode === "paste"
                      ? "bg-white text-[#111827] shadow-2xs font-semibold"
                      : "text-[#6B7280] hover:text-[#111827]"
                  }`}
                >
                  Paste an email
                </button>
              </div>

              {/* ================= INBOX MODE ================= */}
              {emailMode === "inbox" && (
                <>
                  {!settings.gmail?.email ? (
                    <div className="p-4 bg-white rounded-xl border border-[#E5E7EB] text-center space-y-3">
                      <Mail className="w-8 h-8 text-[#4F46E5] mx-auto" />
                      <div>
                        <h4 className="text-xs font-bold text-[#111827]">Connect your Gmail</h4>
                        <p className="text-[11px] text-[#6B7280] mt-1">
                          Use a 16-letter App Password to browse recent emails and draft replies.
                        </p>
                      </div>
                      <button
                        onClick={() => onOpenSettings("email")}
                        className="w-full py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Connect Gmail
                      </button>
                    </div>
                  ) : selectedEmail ? (
                    /* Selected Email Detail View */
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-[#E5E7EB]">
                      <button
                        onClick={() => {
                          setSelectedEmail(null);
                          setAiActionResult("");
                          setDraftReplyText("");
                          setAiActionError(null);
                        }}
                        className="flex items-center gap-1 text-xs text-[#4F46E5] hover:underline font-semibold cursor-pointer mb-2"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Inbox</span>
                      </button>

                      <div className="border-b border-[#F3F4F6] pb-2">
                        <h4 className="text-xs font-bold text-[#111827] leading-snug">
                          {selectedEmail.subject}
                        </h4>
                        <p className="text-[11px] text-[#6B7280] truncate mt-0.5">
                          From: {selectedEmail.from}
                        </p>
                        <p className="text-[10px] text-[#9CA3AF]">
                          {new Date(selectedEmail.date).toLocaleString()}
                        </p>
                      </div>

                      {/* Scrollable Email Body */}
                      <div className="max-h-[160px] overflow-y-auto text-xs text-[#4B5563] leading-relaxed p-2 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] whitespace-pre-wrap">
                        {selectedEmail.text}
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            disabled={aiActionRunning}
                            onClick={() => handleRunEmailAction("summarise")}
                            className="py-1.5 px-2 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] text-[11px] font-semibold rounded-lg transition-colors cursor-pointer text-center disabled:opacity-50"
                          >
                            Summarise
                          </button>
                          <button
                            disabled={aiActionRunning}
                            onClick={() => handleRunEmailAction("actions")}
                            className="py-1.5 px-2 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] text-[11px] font-semibold rounded-lg transition-colors cursor-pointer text-center disabled:opacity-50"
                          >
                            Action items
                          </button>
                          <button
                            disabled={aiActionRunning}
                            onClick={() => handleRunEmailAction("reply")}
                            className="py-1.5 px-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer text-center disabled:opacity-50"
                          >
                            Draft reply
                          </button>
                        </div>

                        {/* Tone Selector & Extra Instructions */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex flex-wrap gap-1">
                            {TONES.map(t => (
                              <button
                                key={t}
                                onClick={() => setSelectedTone(t)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${
                                  selectedTone === t
                                    ? "bg-[#4F46E5] text-white"
                                    : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={extraInstructions}
                            onChange={e => setExtraInstructions(e.target.value)}
                            placeholder="Extra instructions (optional)..."
                            className="w-full px-2.5 py-1 text-[11px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#4F46E5]"
                          />
                        </div>
                      </div>

                      {/* AI Action Running Spinner */}
                      {aiActionRunning && (
                        <div className="flex items-center gap-2 text-xs text-[#4F46E5] py-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating {aiActionType}...</span>
                        </div>
                      )}

                      {/* AI Action Error */}
                      {aiActionError && (
                        <div className="p-2 bg-[#FEF2F2] rounded-lg border border-[#FEE2E2] text-xs text-[#DC2626]">
                          {aiActionError}
                        </div>
                      )}

                      {/* Result Area for Summarise / Action items */}
                      {aiActionResult && (
                        <div className="p-3 bg-[#FAFBFD] rounded-lg border border-[#E5E7EB] space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-1.5">
                            <span className="font-semibold text-[#111827] capitalize">
                              {aiActionType}
                            </span>
                            <button
                              onClick={() => handleCopyText(aiActionResult)}
                              className="flex items-center gap-1 text-[11px] text-[#4F46E5] hover:underline cursor-pointer"
                            >
                              {copiedResult ? (
                                <Check className="w-3 h-3 text-[#16A34A]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedResult ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-[#374151] leading-relaxed">
                            {aiActionResult}
                          </p>
                        </div>
                      )}

                      {/* Result Area for Draft Reply */}
                      {draftReplyText && (
                        <div className="space-y-2 pt-2 border-t border-[#F3F4F6]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#111827]">
                              Editable Draft
                            </span>
                            <button
                              onClick={() => handleCopyText(draftReplyText)}
                              className="flex items-center gap-1 text-[11px] text-[#4F46E5] hover:underline cursor-pointer"
                            >
                              {copiedResult ? (
                                <Check className="w-3 h-3 text-[#16A34A]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>Copy</span>
                            </button>
                          </div>
                          <textarea
                            value={draftReplyText}
                            onChange={e => setDraftReplyText(e.target.value)}
                            rows={6}
                            className="w-full p-2.5 text-xs bg-[#FAFBFD] border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#4F46E5] resize-none"
                          />
                          <button
                            disabled={savingDraft || !draftReplyText.trim()}
                            onClick={handleSaveToGmailDrafts}
                            className="w-full py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                          >
                            {savingDraft ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Saving to Drafts...</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                <span>Save to Gmail drafts</span>
                              </>
                            )}
                          </button>
                          <p className="text-[10px] text-[#9CA3AF] text-center">
                            Harness never sends email.
                          </p>
                          {savedDraftSuccess && (
                            <p className="text-xs text-[#16A34A] bg-[#F0FDF4] p-2 rounded-lg border border-[#DCFCE7] text-center">
                              {savedDraftSuccess}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Email List */
                    <div className="space-y-2">
                      {/* Search Bar & Refresh */}
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                          <input
                            type="text"
                            value={emailSearchQuery}
                            onChange={e => setEmailSearchQuery(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") fetchEmails();
                            }}
                            placeholder="Search inbox..."
                            className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs text-[#111827] focus:outline-none focus:border-[#4F46E5]"
                          />
                        </div>
                        <button
                          onClick={() => fetchEmails()}
                          title="Refresh email list"
                          className="p-1.5 bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg text-[#6B7280] cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${loadingEmails ? "animate-spin text-[#4F46E5]" : ""}`}
                          />
                        </button>
                      </div>

                      {/* Email rows */}
                      {loadingEmails ? (
                        <div className="space-y-2 py-2">
                          {[1, 2, 3, 4].map(n => (
                            <div
                              key={n}
                              className="p-3 bg-white rounded-xl border border-[#E5E7EB] animate-pulse space-y-1.5"
                            >
                              <div className="h-3 bg-gray-200 rounded w-1/3" />
                              <div className="h-3 bg-gray-200 rounded w-3/4" />
                            </div>
                          ))}
                        </div>
                      ) : emailListError ? (
                        <div className="p-3 bg-[#FEF2F2] rounded-xl border border-[#FEE2E2] text-xs text-[#DC2626]">
                          {emailListError}
                        </div>
                      ) : emailList.length === 0 ? (
                        <div className="text-center py-6 text-xs text-[#9CA3AF]">
                          No emails found
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {emailList.map(item => (
                            <div
                              key={item.uid}
                              onClick={() => handleSelectEmail(item.uid)}
                              className="p-2.5 bg-white hover:bg-[#FAFBFD] border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-xl transition-all cursor-pointer shadow-2xs"
                            >
                              <div className="flex items-center justify-between text-xs mb-0.5">
                                <span className="font-bold text-[#111827] truncate max-w-[170px]">
                                  {item.from}
                                </span>
                                <span className="text-[10px] text-[#9CA3AF]">
                                  {new Date(item.date).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-[#4B5563] truncate">{item.subject}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ================= PASTE MODE ================= */}
              {emailMode === "paste" && (
                <div className="space-y-3 bg-white p-3.5 rounded-xl border border-[#E5E7EB]">
                  <div>
                    <label className="block text-xs font-semibold text-[#111827] mb-1">
                      Paste Email Text
                    </label>
                    <textarea
                      value={pastedEmailText}
                      onChange={e => setPastedEmailText(e.target.value)}
                      placeholder="Paste the email here (include the sender and subject if you can)..."
                      rows={6}
                      className="w-full p-2.5 text-xs bg-[#FAFBFD] border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#4F46E5] resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      disabled={aiActionRunning || !pastedEmailText.trim()}
                      onClick={() => handleRunEmailAction("summarise")}
                      className="py-1.5 px-2 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] text-[11px] font-semibold rounded-lg transition-colors cursor-pointer text-center disabled:opacity-50"
                    >
                      Summarise
                    </button>
                    <button
                      disabled={aiActionRunning || !pastedEmailText.trim()}
                      onClick={() => handleRunEmailAction("actions")}
                      className="py-1.5 px-2 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] text-[11px] font-semibold rounded-lg transition-colors cursor-pointer text-center disabled:opacity-50"
                    >
                      Action items
                    </button>
                    <button
                      disabled={aiActionRunning || !pastedEmailText.trim()}
                      onClick={() => handleRunEmailAction("reply")}
                      className="py-1.5 px-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer text-center disabled:opacity-50"
                    >
                      Draft reply
                    </button>
                  </div>

                  {/* Tones & Extra */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex flex-wrap gap-1">
                      {TONES.map(t => (
                        <button
                          key={t}
                          onClick={() => setSelectedTone(t)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${
                            selectedTone === t
                              ? "bg-[#4F46E5] text-white"
                              : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={extraInstructions}
                      onChange={e => setExtraInstructions(e.target.value)}
                      placeholder="Extra instructions (optional)..."
                      className="w-full px-2.5 py-1 text-[11px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  {aiActionRunning && (
                    <div className="flex items-center gap-2 text-xs text-[#4F46E5] py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing email...</span>
                    </div>
                  )}

                  {aiActionError && (
                    <div className="p-2 bg-[#FEF2F2] rounded-lg border border-[#FEE2E2] text-xs text-[#DC2626]">
                      {aiActionError}
                    </div>
                  )}

                  {/* Result Area */}
                  {aiActionResult && (
                    <div className="p-3 bg-[#FAFBFD] rounded-lg border border-[#E5E7EB] space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-1.5">
                        <span className="font-semibold text-[#111827] capitalize">
                          {aiActionType}
                        </span>
                        <button
                          onClick={() => handleCopyText(aiActionResult)}
                          className="flex items-center gap-1 text-[11px] text-[#4F46E5] hover:underline cursor-pointer"
                        >
                          {copiedResult ? (
                            <Check className="w-3 h-3 text-[#16A34A]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedResult ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap text-[#374151] leading-relaxed">
                        {aiActionResult}
                      </p>
                    </div>
                  )}

                  {draftReplyText && (
                    <div className="space-y-2 pt-2 border-t border-[#F3F4F6]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#111827]">Draft Reply</span>
                        <button
                          onClick={() => handleCopyText(draftReplyText)}
                          className="flex items-center gap-1 text-[11px] text-[#4F46E5] hover:underline cursor-pointer"
                        >
                          {copiedResult ? (
                            <Check className="w-3 h-3 text-[#16A34A]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>Copy</span>
                        </button>
                      </div>
                      <textarea
                        value={draftReplyText}
                        onChange={e => setDraftReplyText(e.target.value)}
                        rows={6}
                        className="w-full p-2.5 text-xs bg-[#FAFBFD] border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#4F46E5] resize-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel Footer: Token Estimate */}
        <div className="px-4 py-3 border-t border-[#E5E7EB] bg-[#F1F3FF]">
          <span className="text-xs text-[#6B7280] font-medium tabular-nums">
            Context: ~{contextTokenEstimate}k tokens
          </span>
        </div>
      </aside>
    </>
  );
};
