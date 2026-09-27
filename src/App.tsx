/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  Chat,
  Message,
  Doc,
  Provider,
  getSettings,
  saveSettings,
  getChatIndex,
  getChat,
  saveChat,
  deleteChat,
  getCachedModels,
  setCachedModels,
  subscribeStorageBlocked,
  DEFAULT_SETTINGS
} from "./lib/store";
import { api } from "./lib/api";
import { buildDocContext } from "./lib/rag";
import { BASE_SYSTEM } from "./lib/prompts";
import { WakeScreen } from "./components/WakeScreen";
import { Welcome } from "./components/Welcome";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { ChatThread } from "./components/ChatThread";
import { Composer } from "./components/Composer";
import { RightPanel } from "./components/RightPanel";
import { SettingsModal } from "./components/SettingsModal";
import { AlertCircle } from "lucide-react";

export default function App() {
  // Wake-up / Server health
  const [serverReady, setServerReady] = useState(false);
  const [serverFailed, setServerFailed] = useState(false);

  // Storage blocked warning
  const [storageBlocked, setStorageBlocked] = useState(false);

  // Settings
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"keys" | "email" | "data">("keys");

  // Chat state
  const [chatIndex, setChatIndex] = useState<{ id: string; title: string; updatedAt: number }[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);

  // Composer / Chat flow state
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const abortCtrlRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Model caching
  const [cachedModels, setCachedModelsState] = useState<Partial<Record<Provider, string[]>>>({});

  // Right Panel
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<"docs" | "email">("docs");
  const [rightPanelEmailMode, setRightPanelEmailMode] = useState<"inbox" | "paste">("inbox");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Mobile sidebar
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Search notice
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  // Toast / inline error banner
  const [appErrorToast, setAppErrorToast] = useState<string | null>(null);

  // 1. Initial server health polling (every 3s, up to 30 tries)
  useEffect(() => {
    let attempts = 0;
    let cancelled = false;

    const checkHealth = async () => {
      try {
        const res = await api<{ ok: boolean }>("health");
        if (res.ok && !cancelled) {
          setServerReady(true);
          return;
        }
      } catch {
        // Continue retrying
      }

      attempts++;
      if (attempts >= 30) {
        if (!cancelled) setServerFailed(true);
      } else {
        if (!cancelled) setTimeout(checkHealth, 3000);
      }
    };

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Storage blocked listener
  useEffect(() => {
    return subscribeStorageBlocked(() => {
      setStorageBlocked(true);
    });
  }, []);

  // 3. Load initial settings and chats when server is ready
  useEffect(() => {
    if (!serverReady) return;

    const loadData = async () => {
      const s = await getSettings();
      setSettings(s);

      // Load cached models for each provider
      const provs: Provider[] = ["openai", "anthropic", "gemini", "xai"];
      const loadedModels: Partial<Record<Provider, string[]>> = {};
      for (const p of provs) {
        const m = await getCachedModels(p);
        if (m) loadedModels[p] = m;
      }
      setCachedModelsState(loadedModels);

      const idx = await getChatIndex();
      setChatIndex(idx);

      if (idx.length > 0) {
        const first = await getChat(idx[0].id);
        if (first) {
          setCurrentChat(first);
        } else {
          createNewChat(s);
        }
      } else {
        createNewChat(s);
      }
    };

    loadData();
  }, [serverReady]);

  // Apply dark theme class if needed
  useEffect(() => {
    if (settings.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.theme]);

  // Auto-save current chat on changes (debounced 300ms)
  useEffect(() => {
    if (!currentChat) return;

    const timer = setTimeout(async () => {
      await saveChat(currentChat);
      const updatedIdx = await getChatIndex();
      setChatIndex(updatedIdx);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentChat]);

  const createNewChat = (customSettings = settings) => {
    const defaultProvider = customSettings.last?.provider || getDefaultProvider(customSettings);
    const defaultModel =
      customSettings.last?.model || (defaultProvider ? getDefaultModel(defaultProvider) : undefined);

    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      provider: defaultProvider,
      model: defaultModel,
      webSearch: false,
      includeEmail: false,
      messages: [],
      docs: [],
    };

    setCurrentChat(newChat);
    saveChat(newChat);
    getChatIndex().then(setChatIndex);
    return newChat;
  };

  const getDefaultProvider = (s: Settings): Provider | undefined => {
    const provs: Provider[] = ["openai", "anthropic", "gemini", "xai"];
    return provs.find(p => !!s.keys[p]);
  };

  const getDefaultModel = (provider: Provider): string | undefined => {
    const list = cachedModels[provider] || [];
    if (list.length === 0) return undefined;
    const fast = list.find(m => /mini|flash|haiku|fast/i.test(m));
    return fast || list[0];
  };

  const handleSelectChat = async (id: string) => {
    const c = await getChat(id);
    if (c) {
      setCurrentChat(c);
    }
  };

  const handleDeleteChat = async (id: string) => {
    await deleteChat(id);
    const updatedIdx = await getChatIndex();
    setChatIndex(updatedIdx);
    if (currentChat?.id === id) {
      if (updatedIdx.length > 0) {
        handleSelectChat(updatedIdx[0].id);
      } else {
        createNewChat();
      }
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    if (currentChat && currentChat.id === id) {
      const updated = { ...currentChat, title: newTitle, updatedAt: Date.now() };
      setCurrentChat(updated);
      await saveChat(updated);
    } else {
      const c = await getChat(id);
      if (c) {
        c.title = newTitle;
        c.updatedAt = Date.now();
        await saveChat(c);
      }
    }
    const updatedIdx = await getChatIndex();
    setChatIndex(updatedIdx);
  };

  const handleRefreshModels = async (provider: Provider) => {
    const key = settings.keys[provider];
    if (!key) return;
    try {
      const res = await api<{ models: string[] }>("models", { provider, key });
      if (res.models) {
        await setCachedModels(provider, res.models);
        setCachedModelsState(prev => ({ ...prev, [provider]: res.models }));
      }
    } catch (e: any) {
      setAppErrorToast(e.message || "Failed to refresh models");
      setTimeout(() => setAppErrorToast(null), 4000);
    }
  };

  const handleSelectModel = (provider: Provider, model: string) => {
    if (!currentChat) return;
    const updatedChat = { ...currentChat, provider, model, updatedAt: Date.now() };
    setCurrentChat(updatedChat);

    const updatedSettings = {
      ...settings,
      last: { provider, model },
    };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
  };

  const handleToggleWebSearch = (val: boolean) => {
    if (!currentChat) return;

    if (val && !settings.seenSearchNotice) {
      setSearchNotice(
        "Web search is billed by your provider on top of normal usage."
      );
      const updatedSettings = { ...settings, seenSearchNotice: true };
      setSettings(updatedSettings);
      saveSettings(updatedSettings);
    }

    setCurrentChat({
      ...currentChat,
      webSearch: val,
      updatedAt: Date.now(),
    });
  };

  const handleToggleIncludeEmail = (val: boolean) => {
    if (!currentChat) return;
    setCurrentChat({
      ...currentChat,
      includeEmail: val,
      updatedAt: Date.now(),
    });
  };

  const handleToggleDoc = (docId: string, enabled: boolean) => {
    if (!currentChat) return;
    const updatedDocs = currentChat.docs.map(d =>
      d.id === docId ? { ...d, enabled } : d
    );
    setCurrentChat({
      ...currentChat,
      docs: updatedDocs,
      updatedAt: Date.now(),
    });
  };

  const handleDeleteDoc = (docId: string) => {
    if (!currentChat) return;
    const updatedDocs = currentChat.docs.filter(d => d.id !== docId);
    setCurrentChat({
      ...currentChat,
      docs: updatedDocs,
      updatedAt: Date.now(),
    });
  };

  const handleUploadFile = async (file: File) => {
    if (!currentChat) return;
    setUploadError(null);

    // Client-side checks before upload
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("File is larger than 20 MB.");
      return;
    }
    if (currentChat.docs.length >= 10) {
      setUploadError("Max 10 documents per chat.");
      return;
    }
    if (currentChat.docs.some(d => d.name.toLowerCase() === file.name.toLowerCase())) {
      setUploadError(`"${file.name}" is already attached.`);
      return;
    }

    setUploadingDoc(true);
    const form = new FormData();
    form.append("file", file);

    try {
      const res = await api<{ name: string; pages: string[]; chars: number }>(
        "parse",
        form,
        true
      );
      const newDoc: Doc = {
        id: crypto.randomUUID(),
        name: res.name,
        pages: res.pages,
        chars: res.chars,
        enabled: true,
      };

      setCurrentChat({
        ...currentChat,
        docs: [...currentChat.docs, newDoc],
        updatedAt: Date.now(),
      });
    } catch (e: any) {
      setUploadError(e.message || "Upload failed");
    } finally {
      setUploadingDoc(false);
    }
  };

  // ================= SEND MESSAGE FLOW (Section 6.4) =================
  const handleSendMessage = async (retryContent?: string) => {
    const textToSend = (retryContent !== undefined ? retryContent : input).trim();
    if (!textToSend || busy || !currentChat) return;

    // Check provider / model
    if (!currentChat.provider || !currentChat.model) {
      setSettingsInitialTab("keys");
      setSettingsModalOpen(true);
      setAppErrorToast("Add a key and pick a model first.");
      setTimeout(() => setAppErrorToast(null), 4000);
      return;
    }

    const providerKey = settings.keys[currentChat.provider];
    if (!providerKey) {
      setAppErrorToast(`Add your ${currentChat.provider} key in Settings.`);
      setTimeout(() => setAppErrorToast(null), 4000);
      return;
    }

    // Append user message if not a retry
    let updatedMessages: Message[] = [...currentChat.messages];
    if (retryContent === undefined) {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: textToSend,
        createdAt: Date.now(),
      };
      updatedMessages.push(userMsg);
      setInput("");
    }

    // Set first message as chat title if it's the first turn
    const isFirstUserMessage =
      currentChat.messages.filter(m => m.role === "user").length === 0;
    const newTitle = isFirstUserMessage
      ? textToSend.slice(0, 40) + (textToSend.length > 40 ? "..." : "")
      : currentChat.title;

    // Setup busy status
    setBusy(true);
    const enabledDocs = currentChat.docs.filter(d => d.enabled);
    const lines: string[] = [];
    if (currentChat.webSearch) lines.push("🌐 Searching the web...");
    if (enabledDocs.length > 0) lines.push("📄 Reading your documents...");
    if (currentChat.includeEmail && settings.gmail?.email) {
      lines.push("✉️ Checking your email...");
    }
    setStatusLines(lines);

    // Build request context
    let system = BASE_SYSTEM;
    if (enabledDocs.length > 0) {
      system += "\n\n" + buildDocContext(enabledDocs, textToSend);
    }

    // Messages: role user or assistant only (skip error), last 30, under 120,000 chars
    const filteredMsgs = updatedMessages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
      .slice(-30);

    let totalChars = filteredMsgs.reduce((acc, m) => acc + m.content.length, 0);
    while (filteredMsgs.length > 1 && totalChars > 120000) {
      const removed = filteredMsgs.shift();
      if (removed) totalChars -= removed.content.length;
    }

    // Abort controller
    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;
    const t0 = Date.now();

    // Update state with user message
    setCurrentChat({
      ...currentChat,
      title: newTitle,
      messages: updatedMessages,
      updatedAt: Date.now(),
    });

    try {
      const requestPayload: any = {
        provider: currentChat.provider,
        key: providerKey,
        model: currentChat.model,
        system,
        messages: filteredMsgs,
        webSearch: currentChat.webSearch,
      };

      if (settings.tavilyKey?.trim()) {
        requestPayload.tavilyKey = settings.tavilyKey.trim();
      }

      if (currentChat.includeEmail && settings.gmail?.email) {
        requestPayload.includeEmail = true;
        requestPayload.gmail = settings.gmail;
      }

      const res = await api<any>("chat", requestPayload, false, ctrl.signal);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.text,
        provider: currentChat.provider,
        model: currentChat.model,
        sources: res.sources,
        inTokens: res.inTokens,
        outTokens: res.outTokens,
        searchSkipped: res.searchSkipped,
        latencyMs: Date.now() - t0,
        used: {
          ...res.used,
          docs: enabledDocs.length > 0 ? enabledDocs.length : undefined,
        },
        notices: res.notices,
        createdAt: Date.now(),
      };

      setCurrentChat(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, assistantMsg],
          updatedAt: Date.now(),
        };
      });
    } catch (e: any) {
      const errMsg = e.message || "Something went wrong";
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "error",
        content: errMsg,
        createdAt: Date.now(),
      };
      setCurrentChat(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, errorMsg],
          updatedAt: Date.now(),
        };
      });
    } finally {
      setBusy(false);
      setStatusLines([]);
      abortCtrlRef.current = null;
      textareaRef.current?.focus();
    }
  };

  const handleStop = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
  };

  const handleRetry = () => {
    if (!currentChat) return;
    // Remove the trailing error message
    const msgs = [...currentChat.messages];
    if (msgs.length > 0 && msgs[msgs.length - 1].role === "error") {
      msgs.pop();
    }
    // Find the last user message
    const lastUser = [...msgs].reverse().find(m => m.role === "user");
    if (lastUser) {
      setCurrentChat({
        ...currentChat,
        messages: msgs,
        updatedAt: Date.now(),
      });
      handleSendMessage(lastUser.content);
    }
  };

  const handleRegenerate = (index: number) => {
    if (!currentChat) return;
    // Find the user message before this assistant message
    const msgs = currentChat.messages.slice(0, index);
    const lastUser = [...msgs].reverse().find(m => m.role === "user");
    if (lastUser) {
      setCurrentChat({
        ...currentChat,
        messages: msgs,
        updatedAt: Date.now(),
      });
      handleSendMessage(lastUser.content);
    }
  };

  // Context token estimate: ~Math.round((systemChars + messageChars) / 4 / 100) / 10 k tokens
  const calculateContextTokens = () => {
    if (!currentChat) return 0;
    const enabledDocs = currentChat.docs.filter(d => d.enabled);
    let systemChars = BASE_SYSTEM.length;
    if (enabledDocs.length > 0) {
      systemChars += enabledDocs.reduce((acc, d) => acc + d.pages.join(" ").length, 0);
    }
    const messageChars = currentChat.messages.reduce(
      (acc, m) => acc + (m.role !== "error" ? m.content.length : 0),
      0
    );
    return Math.max(0.1, Math.round(((systemChars + messageChars) / 4) / 100) / 10);
  };

  const hasAnyKey = Object.values(settings.keys).some(k => !!k?.trim());
  const isEmptyChat = !currentChat || currentChat.messages.length === 0;

  // Last assistant reply stats
  const lastAssistantMsg = currentChat?.messages
    .slice()
    .reverse()
    .find(m => m.role === "assistant");
  const lastTokens =
    lastAssistantMsg &&
    (lastAssistantMsg.inTokens !== undefined || lastAssistantMsg.outTokens !== undefined)
      ? (lastAssistantMsg.inTokens || 0) + (lastAssistantMsg.outTokens || 0)
      : undefined;
  const lastLatencyMs = lastAssistantMsg?.latencyMs;

  if (!serverReady) {
    return <WakeScreen failed={serverFailed} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F9FAFB] text-[#111827]">
      {/* Storage Blocked Warning */}
      {storageBlocked && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#FEF2F2] border-b border-[#FEE2E2] px-4 py-2 text-center text-xs text-[#DC2626] font-medium shadow-xs">
          Your browser is blocking storage, chats won&apos;t be saved.
        </div>
      )}

      {/* App Error Toast */}
      {appErrorToast && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-[#FEE2E2] rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-2 text-xs text-[#DC2626] font-medium animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{appErrorToast}</span>
        </div>
      )}

      {/* Column 1: Left Sidebar */}
      <Sidebar
        chatIndex={chatIndex}
        activeChatId={currentChat?.id || null}
        onSelectChat={handleSelectChat}
        onNewChat={() => createNewChat()}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onOpenSettings={() => {
          setSettingsInitialTab("keys");
          setSettingsModalOpen(true);
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Column 2: Center Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Bar */}
        <TopBar
          settings={settings}
          currentProvider={currentChat?.provider}
          currentModel={currentChat?.model}
          onSelectModel={handleSelectModel}
          cachedModels={cachedModels}
          onRefreshModels={handleRefreshModels}
          webSearch={currentChat?.webSearch || false}
          onToggleWebSearch={handleToggleWebSearch}
          lastTokens={lastTokens}
          lastLatencyMs={lastLatencyMs}
          isRightPanelOpen={isRightPanelOpen}
          onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenSettings={tab => {
            if (tab) setSettingsInitialTab(tab);
            setSettingsModalOpen(true);
          }}
        />

        {/* Center Thread or Welcome Screen */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {isEmptyChat && !hasAnyKey ? (
            <Welcome
              onOpenSettings={tab => {
                if (tab) setSettingsInitialTab(tab);
                setSettingsModalOpen(true);
              }}
              onSelectPrompt={(prompt, opts) => {
                setInput(prompt);
                if (opts?.enableWeb) handleToggleWebSearch(true);
                if (opts?.openEmail) {
                  setIsRightPanelOpen(true);
                  setRightPanelTab("email");
                }
              }}
            />
          ) : isEmptyChat ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#9CA3AF]">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#4F46E5] font-bold text-xl mb-3 shadow-2xs">
                H
              </div>
              <h2 className="text-base font-semibold text-[#111827] mb-1">Harness</h2>
              <p className="text-xs text-[#6B7280] max-w-xs mb-6">
                Type a prompt below, attach documents, or toggle web and email context.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                <button
                  onClick={() => setInput("Summarise my uploaded PDF")}
                  className="px-3 py-1.5 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-xs text-[#4B5563] cursor-pointer"
                >
                  📄 Summarise my uploaded PDF
                </button>
                <button
                  onClick={() => {
                    setInput("What's in the news today?");
                    handleToggleWebSearch(true);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-xs text-[#4B5563] cursor-pointer"
                >
                  🌐 What's in the news today?
                </button>
                <button
                  onClick={() => {
                    setInput("Draft a reply to my latest email");
                    setIsRightPanelOpen(true);
                    setRightPanelTab("email");
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] rounded-full text-xs text-[#4B5563] cursor-pointer"
                >
                  ✉️ Draft a reply to my latest email
                </button>
              </div>
            </div>
          ) : (
            <ChatThread
              messages={currentChat?.messages || []}
              docs={currentChat?.docs || []}
              busy={busy}
              statusLines={statusLines}
              onRetry={handleRetry}
              onRegenerate={handleRegenerate}
            />
          )}

          {/* Composer */}
          <Composer
            input={input}
            setInput={setInput}
            onSend={() => handleSendMessage()}
            onStop={handleStop}
            busy={busy}
            enabledDocs={currentChat?.docs.filter(d => d.enabled) || []}
            onToggleDoc={handleToggleDoc}
            webSearch={currentChat?.webSearch || false}
            onToggleWebSearch={handleToggleWebSearch}
            includeEmail={currentChat?.includeEmail || false}
            onToggleIncludeEmail={handleToggleIncludeEmail}
            settings={settings}
            onOpenSettings={tab => {
              if (tab) setSettingsInitialTab(tab);
              setSettingsModalOpen(true);
            }}
            onUploadFile={handleUploadFile}
            textareaRef={textareaRef}
            searchNotice={searchNotice}
            onDismissSearchNotice={() => setSearchNotice(null)}
          />
        </div>
      </main>

      {/* Column 3: Right Context Panel */}
      <RightPanel
        isOpen={isRightPanelOpen}
        onClose={() => setIsRightPanelOpen(false)}
        docs={currentChat?.docs || []}
        onToggleDoc={handleToggleDoc}
        onDeleteDoc={handleDeleteDoc}
        onUploadFile={handleUploadFile}
        uploadingDoc={uploadingDoc}
        uploadError={uploadError}
        onDismissUploadError={() => setUploadError(null)}
        settings={settings}
        currentProvider={currentChat?.provider}
        currentModel={currentChat?.model}
        onOpenSettings={tab => {
          if (tab) setSettingsInitialTab(tab);
          setSettingsModalOpen(true);
        }}
        contextTokenEstimate={calculateContextTokens()}
        initialTab={rightPanelTab}
        initialEmailMode={rightPanelEmailMode}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        initialTab={settingsInitialTab}
        settings={settings}
        onSave={updated => {
          setSettings(updated);
          saveSettings(updated);
          setSettingsModalOpen(false);

          // If current selected provider was removed, clear chat provider
          if (currentChat?.provider && !updated.keys[currentChat.provider]) {
            const nextProv = getDefaultProvider(updated);
            const nextModel = nextProv ? getDefaultModel(nextProv) : undefined;
            setCurrentChat({
              ...currentChat,
              provider: nextProv,
              model: nextModel,
              updatedAt: Date.now(),
            });
          }
        }}
        onClose={() => setSettingsModalOpen(false)}
        onOpenPasteEmail={() => {
          setIsRightPanelOpen(true);
          setRightPanelTab("email");
          setRightPanelEmailMode("paste");
        }}
      />
    </div>
  );
}
