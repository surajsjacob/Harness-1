import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Globe,
  RefreshCw,
  Search,
  PanelRightClose,
  PanelRightOpen,
  Menu,
  Sparkles,
  Zap,
  Sliders,
  Check
} from "lucide-react";
import { Provider, Settings } from "../lib/store";

interface TopBarProps {
  settings: Settings;
  currentProvider?: Provider;
  currentModel?: string;
  onSelectModel: (provider: Provider, model: string) => void;
  cachedModels: Partial<Record<Provider, string[]>>;
  onRefreshModels: (provider: Provider) => Promise<void>;
  webSearch: boolean;
  onToggleWebSearch: (val: boolean) => void;
  lastTokens?: number;
  lastLatencyMs?: number;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onOpenMobileSidebar: () => void;
  onOpenSettings: (tab?: "keys" | "email" | "data") => void;
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

export const TopBar: React.FC<TopBarProps> = ({
  settings,
  currentProvider,
  currentModel,
  onSelectModel,
  cachedModels,
  onRefreshModels,
  webSearch,
  onToggleWebSearch,
  lastTokens,
  lastLatencyMs,
  isRightPanelOpen,
  onToggleRightPanel,
  onOpenMobileSidebar,
  onOpenSettings,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [refreshingProvider, setRefreshingProvider] = useState<Provider | null>(null);
  const [customModelMode, setCustomModelMode] = useState<Provider | null>(null);
  const [customModelInput, setCustomModelInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableProviders: Provider[] = ["openai", "anthropic", "gemini", "xai"];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setCustomModelMode(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRefresh = async (p: Provider, e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshingProvider(p);
    try {
      await onRefreshModels(p);
    } finally {
      setRefreshingProvider(null);
    }
  };

  const handleSelect = (provider: Provider, model: string) => {
    onSelectModel(provider, model);
    setDropdownOpen(false);
    setCustomModelMode(null);
  };

  const handleCustomSubmit = (provider: Provider) => {
    if (customModelInput.trim()) {
      handleSelect(provider, customModelInput.trim());
      setCustomModelInput("");
    }
  };

  return (
    <div className="bg-white border-b border-[#E5E7EB] px-4 py-2.5 shadow-2xs">
      <div className="flex flex-col gap-2">
        {/* Row 1: Model Picker Pill, Last Reply Stats, Action Icons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile menu toggle */}
            <button
              onClick={onOpenMobileSidebar}
              className="lg:hidden p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Model Picker Pill */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-full text-xs font-semibold text-[#111827] transition-all cursor-pointer shadow-2xs"
              >
                {currentProvider ? (
                  <>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PROVIDER_DOTS[currentProvider] }}
                    />
                    <span>
                      {PROVIDER_NAMES[currentProvider]} · {currentModel || "Select model"}
                    </span>
                  </>
                ) : (
                  <span className="text-[#6B7280]">Select a model</span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute left-0 mt-2 w-80 max-h-96 bg-white rounded-xl shadow-xl border border-[#E5E7EB] overflow-hidden z-50 flex flex-col animate-fade-in text-xs">
                  {/* Search box */}
                  <div className="p-2 border-b border-[#F3F4F6]">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                      <input
                        type="text"
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                        placeholder="Search models..."
                        className="w-full pl-8 pr-2.5 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-xs text-[#111827] focus:outline-none focus:border-[#4F46E5]"
                      />
                    </div>
                  </div>

                  {/* Provider Model List */}
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-2">
                    {availableProviders.map(provider => {
                      const hasKey = !!settings.keys[provider];
                      const models = cachedModels[provider] || [];
                      const isRefreshing = refreshingProvider === provider;

                      const filteredModels = models.filter(m =>
                        m.toLowerCase().includes(searchFilter.toLowerCase())
                      );

                      return (
                        <div key={provider} className="rounded-lg p-1">
                          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#6B7280]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: PROVIDER_DOTS[provider] }}
                              />
                              <span>{PROVIDER_NAMES[provider]}</span>
                            </div>

                            {hasKey ? (
                              <button
                                onClick={e => handleRefresh(provider, e)}
                                title="Refresh model list"
                                className="p-1 hover:text-[#111827] rounded transition-colors"
                              >
                                <RefreshCw
                                  className={`w-3 h-3 ${isRefreshing ? "animate-spin text-[#4F46E5]" : ""}`}
                                />
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setDropdownOpen(false);
                                  onOpenSettings("keys");
                                }}
                                className="text-[11px] text-[#4F46E5] hover:underline"
                              >
                                Add key
                              </button>
                            )}
                          </div>

                          {hasKey ? (
                            <div className="space-y-0.5 mt-0.5">
                              {models.length === 0 ? (
                                <div className="px-3 py-1.5 text-xs text-[#9CA3AF]">
                                  No models loaded. Click test in Settings or refresh.
                                </div>
                              ) : filteredModels.length === 0 ? (
                                <div className="px-3 py-1 text-xs text-[#9CA3AF]">
                                  No matching models
                                </div>
                              ) : (
                                filteredModels.map(m => {
                                  const isSelected =
                                    currentProvider === provider && currentModel === m;
                                  return (
                                    <button
                                      key={m}
                                      onClick={() => handleSelect(provider, m)}
                                      className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                                        isSelected
                                          ? "bg-[#EEF2FF] text-[#4F46E5] font-semibold"
                                          : "text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]"
                                      }`}
                                    >
                                      <span className="truncate">{m}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                    </button>
                                  );
                                })
                              )}

                              {/* Custom Model Option */}
                              {customModelMode === provider ? (
                                <div className="p-1 flex items-center gap-1">
                                  <input
                                    type="text"
                                    placeholder="Type model id..."
                                    value={customModelInput}
                                    onChange={e => setCustomModelInput(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") handleCustomSubmit(provider);
                                      if (e.key === "Escape") setCustomModelMode(null);
                                    }}
                                    className="flex-1 px-2 py-1 text-xs bg-white border border-[#4F46E5] rounded text-[#111827] focus:outline-none"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleCustomSubmit(provider)}
                                    className="px-2 py-1 bg-[#4F46E5] text-white rounded text-xs"
                                  >
                                    Set
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setCustomModelMode(provider);
                                    setCustomModelInput("");
                                  }}
                                  className="w-full text-left px-2.5 py-1 text-[11px] text-[#6B7280] hover:text-[#4F46E5] transition-colors"
                                >
                                  + Custom model ID...
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="px-2.5 py-1 text-xs text-[#9CA3AF] italic">
                              Key required to enable models
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Last Reply Stats (replaces price badge) */}
            {lastTokens !== undefined && (
              <span className="text-xs text-[#6B7280] tabular-nums font-medium">
                {lastTokens} tokens
              </span>
            )}
            {lastLatencyMs !== undefined && (
              <span className="text-xs text-[#6B7280] tabular-nums font-medium flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#D97706]" />
                <span>Latency: {lastLatencyMs}ms</span>
              </span>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleRightPanel}
              title={isRightPanelOpen ? "Collapse context panel" : "Expand context panel"}
              className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer"
            >
              {isRightPanelOpen ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Web Search Switch */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#374151] cursor-pointer select-none">
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={webSearch}
                  onChange={e => onToggleWebSearch(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#E5E7EB] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D1D5DB] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4F46E5]"></div>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#4F46E5]" />
                <span>Web search</span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
