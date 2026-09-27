import { get, set, del, keys } from "idb-keyval";

export type Provider = "openai" | "anthropic" | "gemini" | "xai";

export type Settings = {
  keys: Partial<Record<Provider, string>>;
  tavilyKey?: string;
  tavilyStatus?: "ok" | "error" | "untested";
  keyStatus: Partial<Record<Provider, "ok" | "error" | "untested">>;
  keyErrors?: Partial<Record<Provider, string>>;
  gmail?: { email: string; appPassword: string };
  last?: { provider: Provider; model: string };
  theme?: "light" | "dark";
  seenSearchNotice?: boolean;
};

export type Doc = {
  id: string;
  name: string;
  pages: string[];
  chars: number;
  enabled: boolean;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  provider?: Provider;
  model?: string;
  sources?: { title: string; url: string }[];
  inTokens?: number;
  outTokens?: number;
  searchSkipped?: boolean;
  latencyMs?: number;
  used?: {
    web?: number;
    webVia?: "tavily" | "native";
    email?: number;
    emailError?: string;
    docs?: number;
  };
  notices?: string[];
  createdAt: number;
};

export type Chat = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  provider?: Provider;
  model?: string;
  webSearch: boolean;
  includeEmail: boolean;
  messages: Message[];
  docs: Doc[];
};

export type ChatIndexItem = {
  id: string;
  title: string;
  updatedAt: number;
};

// In-memory fallback if IndexedDB is blocked
const memoryStore = new Map<string, any>();
let storageBlocked = false;
let onStorageBlockedListeners: (() => void)[] = [];

export function isStorageBlocked(): boolean {
  return storageBlocked;
}

export function subscribeStorageBlocked(fn: () => void) {
  onStorageBlockedListeners.push(fn);
  return () => {
    onStorageBlockedListeners = onStorageBlockedListeners.filter(l => l !== fn);
  };
}

function notifyStorageBlocked() {
  if (!storageBlocked) {
    storageBlocked = true;
    onStorageBlockedListeners.forEach(fn => fn());
  }
}

async function safeGet<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const val = await get<T>(key);
    return val !== undefined ? val : defaultValue;
  } catch (err) {
    notifyStorageBlocked();
    return memoryStore.has(key) ? memoryStore.get(key) : defaultValue;
  }
}

async function safeSet(key: string, val: any): Promise<void> {
  try {
    await set(key, val);
  } catch (err) {
    notifyStorageBlocked();
    memoryStore.set(key, val);
  }
}

async function safeDel(key: string): Promise<void> {
  try {
    await del(key);
  } catch (err) {
    notifyStorageBlocked();
    memoryStore.delete(key);
  }
}

export const DEFAULT_SETTINGS: Settings = {
  keys: {},
  keyStatus: {},
  keyErrors: {},
  theme: "light",
};

export async function getSettings(): Promise<Settings> {
  const s = await safeGet<Settings>("settings", DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await safeSet("settings", settings);
}

export async function getChatIndex(): Promise<ChatIndexItem[]> {
  const list = await safeGet<ChatIndexItem[]>("chatIndex", []);
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveChatIndex(index: ChatIndexItem[]): Promise<void> {
  await safeSet("chatIndex", index);
}

export async function getChat(id: string): Promise<Chat | null> {
  return await safeGet<Chat | null>(`chat:${id}`, null);
}

export async function saveChat(chat: Chat): Promise<void> {
  await safeSet(`chat:${chat.id}`, chat);

  // Update index
  const index = await getChatIndex();
  const existing = index.find(item => item.id === chat.id);
  if (existing) {
    existing.title = chat.title;
    existing.updatedAt = chat.updatedAt;
  } else {
    index.unshift({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updatedAt,
    });
  }
  await saveChatIndex(index);
}

export async function deleteChat(id: string): Promise<void> {
  await safeDel(`chat:${id}`);
  const index = await getChatIndex();
  await saveChatIndex(index.filter(item => item.id !== id));
}

export async function getCachedModels(provider: Provider): Promise<string[] | null> {
  return await safeGet<string[] | null>(`models:${provider}`, null);
}

export async function setCachedModels(provider: Provider, models: string[]): Promise<void> {
  await safeSet(`models:${provider}`, models);
}

export async function exportAllChatsJson(): Promise<string> {
  try {
    const index = await getChatIndex();
    const chats: Chat[] = [];
    for (const item of index) {
      const c = await getChat(item.id);
      if (c) chats.push(c);
    }
    const settings = await getSettings();
    // Do not export API keys or passwords in plaintext export if user wants to keep them private,
    // but export chats and docs
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      chats,
      settings: {
        theme: settings.theme,
        last: settings.last,
      },
    };
    return JSON.stringify(exportData, null, 2);
  } catch (e) {
    return JSON.stringify({ error: "Failed to export data" });
  }
}

export async function clearAllMyData(): Promise<void> {
  try {
    const allKeys = await keys();
    for (const k of allKeys) {
      await del(k);
    }
  } catch (err) {
    notifyStorageBlocked();
  }
  memoryStore.clear();
}
