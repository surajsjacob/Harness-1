import React, { useState } from "react";
import { Plus, Search, Settings as SettingsIcon, MessageSquare, Trash2, Edit2, Check, X, AlertCircle } from "lucide-react";
import { ChatIndexItem } from "../lib/store";

interface SidebarProps {
  chatIndex: ChatIndexItem[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onOpenSettings: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chatIndex,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onOpenSettings,
  isMobileOpen,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Group chats by date
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const startOfYesterday = startOfToday - ONE_DAY;
  const startOf7Days = startOfToday - 6 * ONE_DAY;

  const filtered = chatIndex.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups: { label: string; items: ChatIndexItem[] }[] = [
    {
      label: "TODAY",
      items: filtered.filter(item => item.updatedAt >= startOfToday),
    },
    {
      label: "YESTERDAY",
      items: filtered.filter(
        item => item.updatedAt >= startOfYesterday && item.updatedAt < startOfToday
      ),
    },
    {
      label: "PREVIOUS 7 DAYS",
      items: filtered.filter(
        item => item.updatedAt >= startOf7Days && item.updatedAt < startOfYesterday
      ),
    },
    {
      label: "OLDER",
      items: filtered.filter(item => item.updatedAt < startOf7Days),
    },
  ].filter(g => g.items.length > 0);

  const handleStartRename = (item: ChatIndexItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      onRenameChat(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-2xs"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-[260px] bg-[#F1F3FF] border-r border-[#E5E7EB] flex flex-col transition-transform duration-200 ease-in-out ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo Header */}
        <div className="flex items-center gap-3 px-4 pt-5 pb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#4F46E5] text-white font-bold text-base shadow-2xs">
            H
          </div>
          <span className="font-bold text-base tracking-tight text-[#111827]">Harness</span>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pt-2 pb-3">
          <button
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New chat</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs placeholder:text-[#9CA3AF] text-[#111827] focus:outline-none focus:border-[#4F46E5]"
            />
          </div>
        </div>

        {/* Chat List Grouped */}
        <div className="flex-1 overflow-y-auto px-2 space-y-4">
          {groups.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-[#9CA3AF]">
                {searchQuery ? "No matching chats" : "No chats yet"}
              </p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.label} className="space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const isActive = item.id === activeChatId;
                    const isEditing = editingId === item.id;

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          onSelectChat(item.id);
                          onCloseMobile();
                        }}
                        className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isActive
                            ? "bg-[#DCE2F3] text-[#111827] font-medium"
                            : "text-[#4B5563] hover:bg-[#E5EAFC] hover:text-[#111827]"
                        }`}
                      >
                        {isEditing ? (
                          <div
                            className="flex items-center gap-1 w-full"
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingTitle}
                              autoFocus
                              onChange={e => setEditingTitle(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") handleSaveRename(item.id, e);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="flex-1 px-1.5 py-0.5 bg-white border border-[#4F46E5] rounded text-xs text-[#111827] focus:outline-none"
                            />
                            <button
                              onClick={e => handleSaveRename(item.id, e)}
                              className="p-1 text-[#16A34A] hover:bg-white rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={handleCancelRename}
                              className="p-1 text-[#6B7280] hover:bg-white rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 truncate pr-2">
                              <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#6B7280]" />
                              <span className="truncate">{item.title}</span>
                            </div>

                            {/* Action icons on hover */}
                            <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                              <button
                                onClick={e => handleStartRename(item, e)}
                                title="Rename"
                                className="p-1 text-[#6B7280] hover:text-[#111827] hover:bg-white/80 rounded"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setDeletingId(item.id);
                                }}
                                title="Delete"
                                className="p-1 text-[#6B7280] hover:text-[#DC2626] hover:bg-white/80 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Settings */}
        <div className="p-3 border-t border-[#E5E7EB]">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-[#4B5563] hover:text-[#111827] hover:bg-[#E5EAFC] rounded-lg transition-colors cursor-pointer"
          >
            <SettingsIcon className="w-4 h-4 text-[#6B7280]" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* In-app Confirm Delete Dialog */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-xs w-full p-5 shadow-xl border border-[#E5E7EB] text-center">
            <div className="w-9 h-9 rounded-full bg-red-50 text-[#DC2626] flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-[#111827] mb-1">Delete this chat?</h4>
            <p className="text-xs text-[#6B7280] mb-4">
              This will remove the conversation and its document references from your browser.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteChat(deletingId);
                  setDeletingId(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-lg cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
