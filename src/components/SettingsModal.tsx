import React, { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  X,
  Eye,
  EyeOff,
  Lock,
  ExternalLink,
  Loader2,
  Mail,
  Database,
  KeyRound,
  Trash2,
  Download,
  Moon,
  Sun,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Provider, Settings, saveSettings, setCachedModels, exportAllChatsJson, clearAllMyData } from "../lib/store";
import { api } from "../lib/api";

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: "keys" | "email" | "data";
  settings: Settings;
  onSave: (updated: Settings) => void;
  onClose: () => void;
  onOpenPasteEmail?: () => void;
}

const PROVIDER_INFO: Record<
  Provider,
  { name: string; letter: string; color: string; bg: string; keyUrl: string }
> = {
  openai: {
    name: "OpenAI",
    letter: "O",
    color: "#000000",
    bg: "#F3F4F6",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    name: "Anthropic",
    letter: "A",
    color: "#D97757",
    bg: "#FBF3EE",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  gemini: {
    name: "Google Gemini",
    letter: "G",
    color: "#4285F4",
    bg: "#EFF6FF",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  xai: {
    name: "xAI Grok",
    letter: "X",
    color: "#111111",
    bg: "#F3F4F6",
    keyUrl: "https://console.x.ai",
  },
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  initialTab = "keys",
  settings,
  onSave,
  onClose,
  onOpenPasteEmail,
}) => {
  const [activeTab, setActiveTab] = useState<"keys" | "email" | "data">(initialTab);
  
  // Local drafts
  const [draftKeys, setDraftKeys] = useState<Partial<Record<Provider, string>>>({});
  const [draftKeyStatus, setDraftKeyStatus] = useState<Partial<Record<Provider, "ok" | "error" | "untested">>>({});
  const [draftKeyErrors, setDraftKeyErrors] = useState<Partial<Record<Provider, string>>>({});
  const [modelCount, setModelCount] = useState<Partial<Record<Provider, number>>>({});
  const [testingProvider, setTestingProvider] = useState<Provider | null>(null);

  // Tavily draft
  const [draftTavilyKey, setDraftTavilyKey] = useState<string>("");
  const [draftTavilyStatus, setDraftTavilyStatus] = useState<"ok" | "error" | "untested">("untested");
  const [tavilyError, setTavilyError] = useState<string>("");
  const [testingTavily, setTestingTavily] = useState<boolean>(false);

  // Password visibility
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  // Gmail draft
  const [gmailEmail, setGmailEmail] = useState<string>("");
  const [gmailPassword, setGmailPassword] = useState<string>("");
  const [gmailConnecting, setGmailConnecting] = useState<boolean>(false);
  const [gmailError, setGmailError] = useState<string>("");

  // In-app confirm dialogs
  const [confirmDiscard, setConfirmDiscard] = useState<boolean>(false);
  const [confirmClearData, setConfirmClearData] = useState<boolean>(false);

  // Key links popover
  const [showKeyLinks, setShowKeyLinks] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setDraftKeys({ ...settings.keys });
      setDraftKeyStatus({ ...settings.keyStatus });
      setDraftKeyErrors({ ...settings.keyErrors });
      setDraftTavilyKey(settings.tavilyKey || "");
      setDraftTavilyStatus(settings.tavilyStatus || "untested");
      setGmailEmail(settings.gmail?.email || "");
      setGmailPassword(settings.gmail?.appPassword || "");
      setGmailError("");
      setTavilyError("");
      setConfirmDiscard(false);
      setConfirmClearData(false);
      setShowKeyLinks(false);
    }
  }, [isOpen, initialTab, settings]);

  if (!isOpen) return null;

  const hasChanges = () => {
    const origKeys = settings.keys || {};
    const provs: Provider[] = ["openai", "anthropic", "gemini", "xai"];
    for (const p of provs) {
      if ((draftKeys[p] || "").trim() !== (origKeys[p] || "").trim()) return true;
    }
    if ((draftTavilyKey || "").trim() !== (settings.tavilyKey || "").trim()) return true;
    return false;
  };

  const handleRequestClose = () => {
    if (hasChanges()) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  };

  const handleSaveAndClose = () => {
    const cleanedKeys: Partial<Record<Provider, string>> = {};
    const provs: Provider[] = ["openai", "anthropic", "gemini", "xai"];
    provs.forEach(p => {
      const v = (draftKeys[p] || "").trim();
      if (v) cleanedKeys[p] = v;
    });

    const cleanedTavily = (draftTavilyKey || "").trim();

    const updatedSettings: Settings = {
      ...settings,
      keys: cleanedKeys,
      keyStatus: draftKeyStatus,
      keyErrors: draftKeyErrors,
      tavilyKey: cleanedTavily || undefined,
      tavilyStatus: cleanedTavily ? draftTavilyStatus : "untested",
    };

    // If current selected provider key was removed, clear selection
    if (settings.last?.provider && !cleanedKeys[settings.last.provider]) {
      delete updatedSettings.last;
    }

    onSave(updatedSettings);
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleKeyChange = (provider: Provider, raw: string) => {
    const cleaned = raw.replace(/\s+/g, "");
    setDraftKeys(prev => ({ ...prev, [provider]: cleaned }));
    setDraftKeyStatus(prev => ({
      ...prev,
      [provider]: cleaned.length > 0 ? "untested" : undefined,
    }));
    setDraftKeyErrors(prev => ({ ...prev, [provider]: undefined }));
  };

  const handleTestKey = async (provider: Provider) => {
    const key = (draftKeys[provider] || "").trim();
    if (!key) return;
    setTestingProvider(provider);
    setDraftKeyErrors(prev => ({ ...prev, [provider]: undefined }));

    try {
      const res = await api<{ models: string[] }>("models", { provider, key });
      setDraftKeyStatus(prev => ({ ...prev, [provider]: "ok" }));
      setModelCount(prev => ({ ...prev, [provider]: res.models?.length || 0 }));
      if (res.models) {
        await setCachedModels(provider, res.models);
      }
    } catch (e: any) {
      setDraftKeyStatus(prev => ({ ...prev, [provider]: "error" }));
      setDraftKeyErrors(prev => ({ ...prev, [provider]: e.message || "Test failed" }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleTestTavily = async () => {
    const key = (draftTavilyKey || "").trim();
    if (!key) return;
    setTestingTavily(true);
    setTavilyError("");
    try {
      await api<{ ok: boolean }>("tavily/test", { key });
      setDraftTavilyStatus("ok");
    } catch (e: any) {
      setDraftTavilyStatus("error");
      setTavilyError(e.message || "Tavily test failed");
    } finally {
      setTestingTavily(false);
    }
  };

  const handleConnectGmail = async () => {
    const email = gmailEmail.trim();
    const appPassword = gmailPassword.replace(/\s+/g, "");
    if (!email || !appPassword) {
      setGmailError("Please provide both Gmail address and 16-letter App Password.");
      return;
    }
    setGmailConnecting(true);
    setGmailError("");
    try {
      await api<{ messages: any[] }>("email/list", { email, appPassword });
      const updated: Settings = {
        ...settings,
        gmail: { email, appPassword },
      };
      await saveSettings(updated);
      onSave(updated);
    } catch (e: any) {
      setGmailError(e.message || "Could not connect to Gmail.");
    } finally {
      setGmailConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    const updated: Settings = {
      ...settings,
      gmail: undefined,
    };
    setGmailEmail("");
    setGmailPassword("");
    await saveSettings(updated);
    onSave(updated);
  };

  const handleExportChats = async () => {
    const jsonStr = await exportAllChatsJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `harness-chats-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAllData = async () => {
    await clearAllMyData();
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) handleRequestClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-[580px] max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#F3F4F6] text-[#4F46E5]">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111827]">Settings</h2>
              <p className="text-xs text-[#6B7280]">Your keys, email connection and data.</p>
            </div>
          </div>
          <button
            onClick={handleRequestClose}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 p-1 bg-[#F3F4F6] rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab("keys")}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === "keys"
                  ? "bg-white text-[#111827] shadow-xs"
                  : "text-[#6B7280] hover:text-[#111827]"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>API keys</span>
            </button>
            <button
              onClick={() => setActiveTab("email")}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === "email"
                  ? "bg-white text-[#111827] shadow-xs"
                  : "text-[#6B7280] hover:text-[#111827]"
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>
            <button
              onClick={() => setActiveTab("data")}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === "data"
                  ? "bg-white text-[#111827] shadow-xs"
                  : "text-[#6B7280] hover:text-[#111827]"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Data</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* ================= API KEYS TAB ================= */}
          {activeTab === "keys" && (
            <>
              {(["openai", "anthropic", "gemini", "xai"] as Provider[]).map(provider => {
                const info = PROVIDER_INFO[provider];
                const keyVal = draftKeys[provider] || "";
                const status = draftKeyStatus[provider];
                const isTesting = testingProvider === provider;
                const errText = draftKeyErrors[provider];
                const isVisible = !!visibleKeys[provider];
                const count = modelCount[provider];

                return (
                  <div
                    key={provider}
                    className="p-4 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs hover:border-[#D1D5DB] transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{ backgroundColor: info.bg, color: info.color }}
                        >
                          {info.letter}
                        </div>
                        <span className="text-sm font-semibold text-[#111827]">{info.name}</span>
                        {count !== undefined && count > 0 && status === "ok" && (
                          <span className="text-xs text-[#9CA3AF]">
                            {count} models available
                          </span>
                        )}
                      </div>

                      {/* Status Pills */}
                      <div>
                        {!keyVal ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#6B7280]">
                            Not added
                          </span>
                        ) : status === "ok" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]">
                            ✓ Working
                          </span>
                        ) : status === "error" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]">
                            ✗ Failed
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#6B7280]">
                            Not tested
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={isVisible ? "text" : "password"}
                          value={keyVal}
                          onChange={e => handleKeyChange(provider, e.target.value)}
                          placeholder={`Paste ${info.name} API key`}
                          className="w-full pl-3 pr-9 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => toggleVisibility(provider)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] cursor-pointer"
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={!keyVal || isTesting}
                        onClick={() => handleTestKey(provider)}
                        className="px-3.5 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] disabled:opacity-50 text-[#374151] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isTesting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Testing</span>
                          </>
                        ) : (
                          <span>Test</span>
                        )}
                      </button>
                    </div>

                    {status === "error" && errText && (
                      <p className="mt-2 text-xs text-[#DC2626] flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errText}</span>
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Web search card (optional): Tavily */}
              <div className="p-4 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs hover:border-[#D1D5DB] transition-all">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                      T
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-[#111827]">
                        Web search (optional): Tavily
                      </span>
                    </div>
                  </div>

                  <div>
                    {!draftTavilyKey ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#6B7280]">
                        Not added
                      </span>
                    ) : draftTavilyStatus === "ok" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]">
                        ✓ Working
                      </span>
                    ) : draftTavilyStatus === "error" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]">
                        ✗ Failed
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#6B7280]">
                        Not tested
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#6B7280] mb-2.5">
                  Add a Tavily key to use the same web search for every model. Without it, each model uses its own search.
                </p>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={visibleKeys["tavily"] ? "text" : "password"}
                      value={draftTavilyKey}
                      onChange={e => {
                        const val = e.target.value.replace(/\s+/g, "");
                        setDraftTavilyKey(val);
                        setDraftTavilyStatus(val ? "untested" : "untested");
                        setTavilyError("");
                      }}
                      placeholder="tvly-..."
                      className="w-full pl-3 pr-9 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisibility("tavily")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] cursor-pointer"
                    >
                      {visibleKeys["tavily"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!draftTavilyKey || testingTavily}
                    onClick={handleTestTavily}
                    className="px-3.5 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] disabled:opacity-50 text-[#374151] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {testingTavily ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing</span>
                      </>
                    ) : (
                      <span>Test</span>
                    )}
                  </button>
                </div>

                {draftTavilyStatus === "error" && tavilyError && (
                  <p className="mt-2 text-xs text-[#DC2626] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{tavilyError}</span>
                  </p>
                )}
              </div>

              {/* Lock Note */}
              <div className="flex items-start gap-3 p-3.5 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                <div className="p-1 rounded-md bg-white border border-[#E5E7EB] text-[#4F46E5] mt-0.5">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#111827] mb-0.5">
                    Stored only in this browser
                  </h4>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    Your keys stay in this browser. Each request passes through the Harness server to the provider and is never stored or logged.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ================= EMAIL TAB ================= */}
          {activeTab === "email" && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-xl border border-[#E5E7EB]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#111827]">Connect Gmail</h3>
                  {settings.gmail?.email ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]">
                      ✓ Connected as {settings.gmail.email}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#6B7280]">
                      Not connected
                    </span>
                  )}
                </div>

                {/* Instructions */}
                <div className="mb-4 text-xs text-[#4B5563] space-y-1.5 bg-[#F9FAFB] p-3 rounded-lg border border-[#E5E7EB]">
                  <p className="font-semibold text-[#111827] mb-1">How to connect with an App Password:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>
                      Turn on <strong>2-Step Verification</strong> on your Google account (
                      <a
                        href="https://myaccount.google.com/security"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#4F46E5] underline"
                      >
                        myaccount.google.com/security
                      </a>
                      ).
                    </li>
                    <li>
                      Open{" "}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#4F46E5] underline"
                      >
                        myaccount.google.com/apppasswords
                      </a>
                      , type a name like &quot;Harness&quot;, click <strong>Create</strong>, copy the 16-letter password.
                    </li>
                    <li>Paste your Gmail address and that App Password here, then click <strong>Connect</strong>.</li>
                  </ol>
                  <p className="text-[11px] text-[#6B7280] pt-1">
                    Your App Password is stored only in this browser. You can revoke it any time at myaccount.google.com/apppasswords.
                  </p>
                  <p className="text-[11px] text-[#6B7280]">
                    Work (Google Workspace) accounts may block App Passwords. Use <strong>Paste an email</strong> instead.
                  </p>
                </div>

                {settings.gmail?.email ? (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-[#374151]">
                      Logged in as <strong>{settings.gmail.email}</strong>
                    </p>
                    <button
                      onClick={handleDisconnectGmail}
                      className="text-xs text-[#DC2626] hover:underline font-semibold cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">
                        Gmail Address
                      </label>
                      <input
                        type="email"
                        value={gmailEmail}
                        onChange={e => setGmailEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        className="w-full px-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#4F46E5]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">
                        16-Letter App Password
                      </label>
                      <input
                        type="password"
                        value={gmailPassword}
                        onChange={e => setGmailPassword(e.target.value)}
                        placeholder="xxxx xxxx xxxx xxxx"
                        className="w-full px-3 py-2 text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#4F46E5] font-mono"
                      />
                    </div>

                    {gmailError && (
                      <p className="text-xs text-[#DC2626] flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{gmailError}</span>
                      </p>
                    )}

                    <button
                      disabled={gmailConnecting || !gmailEmail || !gmailPassword}
                      onClick={handleConnectGmail}
                      className="w-full py-2 bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {gmailConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying & Connecting...</span>
                        </>
                      ) : (
                        <span>Connect</span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* No setup paste mode card */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#E5E7EB]"></div>
                <span className="text-xs text-[#9CA3AF] uppercase font-semibold">or</span>
                <div className="flex-1 h-px bg-[#E5E7EB]"></div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#111827]">No setup required</h4>
                  <p className="text-xs text-[#6B7280]">
                    Paste an email directly to summarise, extract action items, or draft replies.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenPasteEmail?.();
                  }}
                  className="px-3 py-1.5 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Paste an email
                </button>
              </div>
            </div>
          )}

          {/* ================= DATA TAB ================= */}
          {activeTab === "data" && (
            <div className="space-y-4">
              {/* Theme */}
              <div className="p-4 bg-white rounded-xl border border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[#111827]">Appearance Theme</h4>
                  <p className="text-xs text-[#6B7280]">Toggle light or dark interface theme</p>
                </div>
                <div className="flex p-1 bg-[#F3F4F6] rounded-lg">
                  <button
                    onClick={() => {
                      const updated = { ...settings, theme: "light" as const };
                      onSave(updated);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      settings.theme !== "dark"
                        ? "bg-white text-[#111827] shadow-xs"
                        : "text-[#6B7280] hover:text-[#111827]"
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => {
                      const updated = { ...settings, theme: "dark" as const };
                      onSave(updated);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      settings.theme === "dark"
                        ? "bg-white text-[#111827] shadow-xs"
                        : "text-[#6B7280] hover:text-[#111827]"
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              {/* Export chats */}
              <div className="p-4 bg-white rounded-xl border border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[#111827]">Export Chat History</h4>
                  <p className="text-xs text-[#6B7280]">Download all chats and documents as a JSON file</p>
                </div>
                <button
                  onClick={handleExportChats}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>

              {/* Clear all data */}
              <div className="p-4 bg-white rounded-xl border border-[#FEE2E2]">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-[#DC2626]">Clear All Data</h4>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      Wipes all API keys, stored chats, indexed documents, and local settings from IndexedDB.
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmClearData(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-[#DC2626] text-[#DC2626] hover:bg-[#FEF2F2] text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear all data</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB]">
          <div className="relative">
            <button
              onClick={() => setShowKeyLinks(!showKeyLinks)}
              className="flex items-center gap-1 text-xs text-[#4F46E5] hover:text-[#4338CA] font-medium cursor-pointer"
            >
              <span>Where do I get a key?</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            {/* Key Links Popover */}
            {showKeyLinks && (
              <div className="absolute left-0 bottom-full mb-2 w-64 bg-white rounded-xl shadow-lg border border-[#E5E7EB] p-2 space-y-1 z-20 animate-fade-in text-xs">
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 hover:bg-[#F3F4F6] rounded-lg text-[#111827]"
                >
                  <span>OpenAI Keys</span>
                  <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
                </a>
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 hover:bg-[#F3F4F6] rounded-lg text-[#111827]"
                >
                  <span>Anthropic Keys</span>
                  <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
                </a>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 hover:bg-[#F3F4F6] rounded-lg text-[#111827]"
                >
                  <span>Google Gemini Keys</span>
                  <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
                </a>
                <a
                  href="https://console.x.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 hover:bg-[#F3F4F6] rounded-lg text-[#111827]"
                >
                  <span>xAI Grok Keys</span>
                  <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
                </a>
                <a
                  href="https://app.tavily.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 hover:bg-[#F3F4F6] rounded-lg text-[#111827]"
                >
                  <span>Tavily Search Keys</span>
                  <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRequestClose}
              className="px-4 py-2 text-xs font-semibold text-[#4B5563] hover:text-[#111827] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Save &amp; Close
            </button>
          </div>
        </div>

        {/* In-app Confirm Discard */}
        {confirmDiscard && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-30 animate-fade-in">
            <div className="bg-white rounded-xl max-w-xs w-full p-5 shadow-xl border border-[#E5E7EB] text-center">
              <h4 className="text-sm font-bold text-[#111827] mb-1">Discard unsaved changes?</h4>
              <p className="text-xs text-[#6B7280] mb-4">
                You have modified keys or settings that have not been saved.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmDiscard(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] rounded-lg cursor-pointer"
                >
                  Keep editing
                </button>
                <button
                  onClick={() => {
                    setConfirmDiscard(false);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-lg cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-app Confirm Clear All Data */}
        {confirmClearData && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-30 animate-fade-in">
            <div className="bg-white rounded-xl max-w-xs w-full p-5 shadow-xl border border-[#E5E7EB] text-center">
              <div className="w-10 h-10 rounded-full bg-red-50 text-[#DC2626] flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-[#111827] mb-1">Delete all local data?</h4>
              <p className="text-xs text-[#6B7280] mb-4">
                This will wipe all chats, documents, and credentials from this browser. This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmClearData(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllData}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-lg cursor-pointer"
                >
                  Clear Everything
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
