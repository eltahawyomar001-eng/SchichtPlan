"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";
import {
  PlusIcon,
  MessageCircleIcon,
  SendIcon,
  UsersIcon,
  XIcon,
  SearchIcon,
  EditIcon,
  TrashIcon,
  SmileIcon,
  MoreVerticalIcon,
  CheckIcon,
  UserIcon,
  SettingsIcon,
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────

interface WorkspaceUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface ChannelMember {
  userId: string;
  user: { id: string; name: string | null; email: string };
}

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  createdBy: string;
  memberCount: number;
  messageCount: number;
  unreadCount: number;
  members?: ChannelMember[];
  lastMessage?: {
    content: string;
    senderName: string;
    createdAt: string;
  } | null;
}

interface Reaction {
  id: string;
  emoji: string;
  userId: string;
}

interface Message {
  id: string;
  content: string;
  senderName: string;
  senderId: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  reactions: Reaction[];
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👀"];

// ─── Component ──────────────────────────────────────────────────

export default function NachrichtenPage() {
  const t = useTranslations("teamChat");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const { handlePlanLimit } = usePlanLimit();

  // Core state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planGated, setPlanGated] = useState(false);

  // Channel creation state
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<WorkspaceUser[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  // Workspace users (for member picker)
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Channel settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [channelDetails, setChannelDetails] = useState<Channel | null>(null);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [showAddMembers, setShowAddMembers] = useState(false);

  // Message actions
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(
    null,
  );
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);

  // @mention autocomplete
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  // Channel search
  const [channelSearch, setChannelSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  // ── Fetch workspace users ───────────────────────────────────

  const fetchWorkspaceUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/chat/users");
      if (res.ok) {
        const data = await res.json();
        setWorkspaceUsers(data);
      }
    } catch {
      /* non-critical */
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // ── Fetch channels ──────────────────────────────────────────

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/channels");
      if (res.status === 403) {
        const isPlan = await handlePlanLimit(res);
        if (isPlan) {
          setPlanGated(true);
          setLoading(false);
          return;
        }
      }
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
      }
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, [handlePlanLimit]);

  useEffect(() => {
    fetchChannels();
    fetchWorkspaceUsers();
  }, [fetchChannels, fetchWorkspaceUsers]);

  // Poll channels for unread badges every 15s
  useEffect(() => {
    const interval = setInterval(fetchChannels, 15000);
    return () => clearInterval(interval);
  }, [fetchChannels]);

  // ── Fetch messages for active channel ──────────────────────

  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(
        `/api/chat/channels/${channelId}/messages?limit=50`,
      );
      if (res.ok) {
        const data = await res.json();
        setMessages((data.messages as Message[]).reverse());
      }
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    if (!activeChannel) return;

    fetchMessages(activeChannel.id);
    pollRef.current = setInterval(() => {
      fetchMessages(activeChannel.id);
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeChannel, fetchMessages]);

  // ── Auto-scroll ─────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Fetch channel details (for settings panel) ─────────────

  const fetchChannelDetails = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`/api/chat/channels/${channelId}`);
      if (res.ok) {
        const data = await res.json();
        setChannelDetails(data);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  // ── Send message ────────────────────────────────────────────

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || sendingMsg) return;

    setSendingMsg(true);
    const content = newMessage.trim();
    setNewMessage("");

    try {
      const res = await fetch(
        `/api/chat/channels/${activeChannel.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );

      if (res.ok) {
        const msg: Message = await res.json();
        setMessages((prev) => [
          ...prev,
          { ...msg, reactions: msg.reactions || [] },
        ]);
      } else {
        setError(tc("errorOccurred"));
        setNewMessage(content);
      }
    } catch {
      setError(tc("errorOccurred"));
      setNewMessage(content);
    } finally {
      setSendingMsg(false);
    }
  }

  // ── Edit message ────────────────────────────────────────────

  async function handleEditMessage(msgId: string) {
    if (!editContent.trim() || !activeChannel) return;

    try {
      const res = await fetch(
        `/api/chat/channels/${activeChannel.id}/messages/${msgId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent.trim() }),
        },
      );

      if (res.ok) {
        const updated: Message = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, content: updated.content, editedAt: updated.editedAt }
              : m,
          ),
        );
        setEditingMessage(null);
        setEditContent("");
      } else {
        setError(tc("errorOccurred"));
      }
    } catch {
      setError(tc("errorOccurred"));
    }
  }

  // ── Delete message ──────────────────────────────────────────

  async function handleDeleteMessage(msgId: string) {
    if (!activeChannel) return;

    try {
      const res = await fetch(
        `/api/chat/channels/${activeChannel.id}/messages/${msgId}`,
        { method: "DELETE" },
      );

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, deletedAt: new Date().toISOString(), content: "" }
              : m,
          ),
        );
      }
    } catch {
      setError(tc("errorOccurred"));
    }
    setShowMessageMenu(null);
  }

  // ── Toggle reaction ─────────────────────────────────────────

  async function handleReaction(msgId: string, emoji: string) {
    if (!activeChannel) return;

    try {
      const res = await fetch(
        `/api/chat/channels/${activeChannel.id}/messages/${msgId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msgId) return m;
            if (data.action === "added") {
              return {
                ...m,
                reactions: [
                  ...m.reactions,
                  { id: Date.now().toString(), emoji, userId: user?.id || "" },
                ],
              };
            } else {
              return {
                ...m,
                reactions: m.reactions.filter(
                  (r) => !(r.emoji === emoji && r.userId === user?.id),
                ),
              };
            }
          }),
        );
      }
    } catch {
      /* non-critical */
    }
    setShowReactionPicker(null);
  }

  // ── Create channel ──────────────────────────────────────────

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!newChannelName.trim() || creatingChannel) return;

    setCreatingChannel(true);
    try {
      const res = await fetch("/api/chat/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newChannelName.trim(),
          description: newChannelDesc.trim() || null,
          type: "GROUP",
          memberIds: selectedMembers.map((m) => m.id),
        }),
      });

      if (res.ok) {
        const channel: Channel = await res.json();
        await fetchChannels();
        setActiveChannel(channel);
        closeNewChannelModal();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || tc("errorOccurred"));
      }
    } catch {
      setError(tc("errorOccurred"));
    } finally {
      setCreatingChannel(false);
    }
  }

  // ── Create DM ───────────────────────────────────────────────

  async function handleStartDM(targetUser: WorkspaceUser) {
    if (creatingChannel) return;

    // Check if DM channel already exists between these two users
    const existingDM = channels.find(
      (ch) =>
        ch.type === "DIRECT" &&
        ch.members?.some((m) => m.userId === targetUser.id),
    );

    if (existingDM) {
      setActiveChannel(existingDM);
      setShowNewDM(false);
      setMemberSearch("");
      return;
    }

    setCreatingChannel(true);
    try {
      const dmName = `${user?.name || user?.email} & ${targetUser.name || targetUser.email}`;
      const res = await fetch("/api/chat/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dmName,
          type: "DIRECT",
          memberIds: [targetUser.id],
        }),
      });

      if (res.ok) {
        const channel: Channel = await res.json();
        await fetchChannels();
        setActiveChannel(channel);
        setShowNewDM(false);
        setMemberSearch("");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || tc("errorOccurred"));
      }
    } catch {
      setError(tc("errorOccurred"));
    } finally {
      setCreatingChannel(false);
    }
  }

  // ── Add member to channel ───────────────────────────────────

  async function handleAddMember(userId: string) {
    if (!activeChannel) return;
    try {
      const res = await fetch(
        `/api/chat/channels/${activeChannel.id}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: [userId] }),
        },
      );
      if (res.ok) {
        fetchChannelDetails(activeChannel.id);
        fetchChannels();
      }
    } catch {
      setError(tc("errorOccurred"));
    }
  }

  // ── Remove member from channel ──────────────────────────────

  async function handleRemoveMember(userId: string) {
    if (!activeChannel) return;
    try {
      const res = await fetch(
        `/api/chat/channels/${activeChannel.id}/members?userId=${userId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        fetchChannelDetails(activeChannel.id);
        fetchChannels();
        if (userId === user?.id) {
          setActiveChannel(null);
          setShowSettings(false);
        }
      }
    } catch {
      setError(tc("errorOccurred"));
    }
  }

  // ── @mention handling ───────────────────────────────────────

  function handleMessageInput(value: string) {
    setNewMessage(value);

    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex >= 0) {
      const charBeforeAt =
        lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      if (charBeforeAt === " " || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!query.includes(" ")) {
          setMentionQuery(query);
          setShowMentions(true);
          setMentionIndex(0);
          return;
        }
      }
    }
    setShowMentions(false);
  }

  const filteredMentionUsers = useMemo(() => {
    if (!showMentions || !mentionQuery) return workspaceUsers.slice(0, 6);
    const q = mentionQuery.toLowerCase();
    return workspaceUsers
      .filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [showMentions, mentionQuery, workspaceUsers]);

  function insertMention(mentionUser: WorkspaceUser) {
    const cursorPos = inputRef.current?.selectionStart || newMessage.length;
    const textBeforeCursor = newMessage.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = newMessage.slice(cursorPos);

    const displayName = mentionUser.name || mentionUser.email.split("@")[0];
    const newValue =
      newMessage.slice(0, lastAtIndex) + `@${displayName} ` + textAfterCursor;

    setNewMessage(newValue);
    setShowMentions(false);
    inputRef.current?.focus();
  }

  function handleMentionKeyDown(e: React.KeyboardEvent) {
    if (!showMentions || filteredMentionUsers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((prev) =>
        prev < filteredMentionUsers.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((prev) =>
        prev > 0 ? prev - 1 : filteredMentionUsers.length - 1,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filteredMentionUsers[mentionIndex]);
    } else if (e.key === "Escape") {
      setShowMentions(false);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────

  function closeNewChannelModal() {
    setShowNewChannel(false);
    setNewChannelName("");
    setNewChannelDesc("");
    setSelectedMembers([]);
    setMemberSearch("");
  }

  const filteredMembersForPicker = useMemo(() => {
    const selectedIds = new Set(selectedMembers.map((m) => m.id));
    const q = memberSearch.toLowerCase();
    return workspaceUsers.filter(
      (u) =>
        u.id !== user?.id &&
        !selectedIds.has(u.id) &&
        (u.name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)),
    );
  }, [workspaceUsers, selectedMembers, memberSearch, user?.id]);

  const filteredChannels = useMemo(() => {
    if (!channelSearch) return channels;
    const q = channelSearch.toLowerCase();
    return channels.filter((ch) => ch.name.toLowerCase().includes(q));
  }, [channels, channelSearch]);

  const dmChannels = useMemo(
    () => filteredChannels.filter((ch) => ch.type === "DIRECT"),
    [filteredChannels],
  );
  const groupChannels = useMemo(
    () => filteredChannels.filter((ch) => ch.type !== "DIRECT"),
    [filteredChannels],
  );

  const settingMembers = channelDetails?.members || [];
  const addableMembersForSettings = useMemo(() => {
    const existingIds = new Set(
      settingMembers.map((m: ChannelMember) => m.userId),
    );
    const q = addMemberSearch.toLowerCase();
    return workspaceUsers.filter(
      (u) =>
        !existingIds.has(u.id) &&
        (u.name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)),
    );
  }, [workspaceUsers, settingMembers, addMemberSearch]);

  // Group reactions by emoji
  function groupReactions(reactions: Reaction[]) {
    const map = new Map<string, { emoji: string; userIds: string[] }>();
    for (const r of reactions) {
      const existing = map.get(r.emoji);
      if (existing) {
        existing.userIds.push(r.userId);
      } else {
        map.set(r.emoji, { emoji: r.emoji, userIds: [r.userId] });
      }
    }
    return Array.from(map.values());
  }

  // Render @mentions in message content
  function renderMessageContent(content: string) {
    const parts = content.split(/(@\S+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span
            key={i}
            className="rounded bg-emerald-100 px-1 font-medium text-emerald-800"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  }

  function getDMPartnerName(channel: Channel) {
    if (!channel.members) return channel.name;
    const partner = channel.members.find((m) => m.userId !== user?.id);
    return partner?.user.name || partner?.user.email || channel.name;
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <div className="flex items-center justify-center p-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (planGated) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <div className="p-6">
          <Card>
            <CardContent className="py-16 text-center">
              <MessageCircleIcon className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="mb-2 text-lg font-semibold text-gray-800">
                {t("planRequired")}
              </p>
              <p className="mx-auto max-w-md text-sm text-gray-500">
                {t("planRequiredDesc")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Topbar title={t("title")} description={t("description")} />

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Sidebar: Channel List ─── */}
        <aside className="flex w-72 flex-shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
          {/* Sidebar header */}
          <div className="border-b border-gray-100 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                {t("channels")}
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowNewDM(true)}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                  title={t("newDM")}
                >
                  <UserIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setShowNewChannel(true);
                    if (workspaceUsers.length === 0) fetchWorkspaceUsers();
                  }}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                  title={t("newChannel")}
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Channel search */}
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                placeholder={t("searchChannels")}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {channels.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-400">{t("noChannels")}</p>
                <button
                  onClick={() => setShowNewChannel(true)}
                  className="mt-2 text-sm text-emerald-600 hover:underline"
                >
                  {t("createFirst")}
                </button>
              </div>
            ) : (
              <div className="p-2">
                {/* Group Channels */}
                {groupChannels.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {t("channels")}
                    </p>
                    <ul className="space-y-0.5">
                      {groupChannels.map((ch) => (
                        <li key={ch.id}>
                          <button
                            onClick={() => {
                              setActiveChannel(ch);
                              setMessages([]);
                              setShowSettings(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                              activeChannel?.id === ch.id
                                ? "bg-emerald-50 font-medium text-emerald-700"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-gray-400">#</span>
                              <span className="truncate">{ch.name}</span>
                            </div>
                            {ch.unreadCount > 0 && (
                              <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white">
                                {ch.unreadCount}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* DM Channels */}
                {dmChannels.length > 0 && (
                  <div>
                    <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {t("directMessages")}
                    </p>
                    <ul className="space-y-0.5">
                      {dmChannels.map((ch) => (
                        <li key={ch.id}>
                          <button
                            onClick={() => {
                              setActiveChannel(ch);
                              setMessages([]);
                              setShowSettings(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                              activeChannel?.id === ch.id
                                ? "bg-emerald-50 font-medium text-emerald-700"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600">
                                {(getDMPartnerName(ch) ||
                                  "?")[0]?.toUpperCase()}
                              </div>
                              <span className="truncate">
                                {getDMPartnerName(ch)}
                              </span>
                            </div>
                            {ch.unreadCount > 0 && (
                              <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white">
                                {ch.unreadCount}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ─── Main Message Area ─── */}
        <main className="flex flex-1 flex-col overflow-hidden bg-gray-50">
          {activeChannel ? (
            <>
              {/* Channel header */}
              <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                  {activeChannel.type === "DIRECT" ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">
                      {(getDMPartnerName(activeChannel) ||
                        "?")[0]?.toUpperCase()}
                    </div>
                  ) : (
                    <span className="font-medium text-gray-400">#</span>
                  )}
                  <h2 className="font-semibold text-gray-900">
                    {activeChannel.type === "DIRECT"
                      ? getDMPartnerName(activeChannel)
                      : activeChannel.name}
                  </h2>
                  {activeChannel.description &&
                    activeChannel.type !== "DIRECT" && (
                      <span className="hidden text-sm text-gray-400 sm:inline">
                        · {activeChannel.description}
                      </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {activeChannel.memberCount || 0} {t("membersCount")}
                  </span>
                  <button
                    onClick={() => {
                      setShowSettings(!showSettings);
                      if (!showSettings) {
                        fetchChannelDetails(activeChannel.id);
                      }
                    }}
                    className={`rounded-lg p-1.5 transition-colors ${
                      showSettings
                        ? "bg-emerald-50 text-emerald-600"
                        : "text-gray-400 hover:bg-gray-100"
                    }`}
                    title={t("channelSettings")}
                  >
                    <SettingsIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Messages */}
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 space-y-1 overflow-y-auto p-4">
                    {error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        {error}
                        <button
                          onClick={() => setError(null)}
                          className="ml-2 underline"
                        >
                          {tc("dismiss")}
                        </button>
                      </div>
                    )}

                    {messages.length === 0 && (
                      <div className="py-12 text-center">
                        <MessageCircleIcon className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                        <p className="text-sm text-gray-400">
                          {t("noMessages")}
                        </p>
                      </div>
                    )}

                    {messages.map((msg, idx) => {
                      const isOwn = msg.senderId === user?.id;
                      const prevMsg = idx > 0 ? messages[idx - 1] : null;
                      const showSender =
                        !prevMsg || prevMsg.senderId !== msg.senderId;
                      const isDeleted = !!msg.deletedAt;
                      const isEditing = editingMessage === msg.id;
                      const grouped = groupReactions(msg.reactions || []);

                      return (
                        <div
                          key={msg.id}
                          className={`group flex ${isOwn ? "justify-end" : "justify-start"}`}
                          onMouseEnter={() => setHoveredMessage(msg.id)}
                          onMouseLeave={() => {
                            setHoveredMessage(null);
                            if (showMessageMenu === msg.id)
                              setShowMessageMenu(null);
                          }}
                        >
                          <div
                            className={`relative max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}
                          >
                            {showSender && !isDeleted && (
                              <span
                                className={`mb-1 text-xs text-gray-500 ${isOwn ? "text-right" : ""}`}
                              >
                                {msg.senderName}
                              </span>
                            )}

                            {isDeleted ? (
                              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm italic text-gray-400">
                                {t("messageDeleted")}
                              </div>
                            ) : isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editContent}
                                  onChange={(e) =>
                                    setEditContent(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      handleEditMessage(msg.id);
                                    if (e.key === "Escape") {
                                      setEditingMessage(null);
                                      setEditContent("");
                                    }
                                  }}
                                  className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleEditMessage(msg.id)}
                                  className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700"
                                >
                                  <CheckIcon className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMessage(null);
                                    setEditContent("");
                                  }}
                                  className="rounded-lg bg-gray-200 p-1.5 text-gray-600 hover:bg-gray-300"
                                >
                                  <XIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div
                                  className={`rounded-2xl px-4 py-2.5 text-sm break-words ${
                                    isOwn
                                      ? "rounded-br-md bg-emerald-600 text-white"
                                      : "rounded-bl-md border border-gray-100 bg-white text-gray-800 shadow-sm"
                                  }`}
                                >
                                  {renderMessageContent(msg.content)}
                                  {msg.editedAt && (
                                    <span
                                      className={`ml-1.5 text-xs ${isOwn ? "text-emerald-200" : "text-gray-400"}`}
                                    >
                                      ({t("edited")})
                                    </span>
                                  )}
                                </div>

                                {/* Message action buttons (hover) */}
                                {hoveredMessage === msg.id && !isDeleted && (
                                  <div
                                    className={`absolute -top-3 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm ${
                                      isOwn ? "right-0" : "left-0"
                                    }`}
                                  >
                                    <button
                                      onClick={() =>
                                        setShowReactionPicker(
                                          showReactionPicker === msg.id
                                            ? null
                                            : msg.id,
                                        )
                                      }
                                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                      title={t("addReaction")}
                                    >
                                      <SmileIcon className="h-3.5 w-3.5" />
                                    </button>
                                    {isOwn && (
                                      <button
                                        onClick={() => {
                                          setEditingMessage(msg.id);
                                          setEditContent(msg.content);
                                        }}
                                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                        title={t("editMessage")}
                                      >
                                        <EditIcon className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    {isOwn && (
                                      <button
                                        onClick={() =>
                                          handleDeleteMessage(msg.id)
                                        }
                                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                        title={t("deleteMessage")}
                                      >
                                        <TrashIcon className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    {!isOwn && (
                                      <button
                                        onClick={() =>
                                          setShowMessageMenu(
                                            showMessageMenu === msg.id
                                              ? null
                                              : msg.id,
                                          )
                                        }
                                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                      >
                                        <MoreVerticalIcon className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}

                                {/* Message menu dropdown */}
                                {showMessageMenu === msg.id && (
                                  <div
                                    className={`absolute top-6 z-10 rounded-lg border border-gray-200 bg-white p-1 shadow-lg ${
                                      isOwn ? "right-0" : "left-0"
                                    }`}
                                  >
                                    <button
                                      onClick={() =>
                                        handleDeleteMessage(msg.id)
                                      }
                                      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                                    >
                                      <TrashIcon className="h-3 w-3" />
                                      {t("deleteMessage")}
                                    </button>
                                  </div>
                                )}

                                {/* Reaction picker */}
                                {showReactionPicker === msg.id && (
                                  <div
                                    className={`absolute -top-11 z-10 flex gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg ${
                                      isOwn ? "right-0" : "left-0"
                                    }`}
                                  >
                                    {REACTION_EMOJIS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={() =>
                                          handleReaction(msg.id, emoji)
                                        }
                                        className="rounded-lg p-1 text-lg transition-transform hover:scale-125 hover:bg-gray-100"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Reactions display */}
                                {grouped.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {grouped.map((g) => {
                                      const iReacted = g.userIds.includes(
                                        user?.id || "",
                                      );
                                      return (
                                        <button
                                          key={g.emoji}
                                          onClick={() =>
                                            handleReaction(msg.id, g.emoji)
                                          }
                                          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                            iReacted
                                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                          }`}
                                        >
                                          <span>{g.emoji}</span>
                                          <span className="font-medium">
                                            {g.userIds.length}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            )}

                            <span className="mt-0.5 text-xs text-gray-400">
                              {new Date(msg.createdAt).toLocaleTimeString(
                                "de-DE",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Compose area */}
                  <div className="relative border-t border-gray-200 bg-white p-3">
                    {/* @mention autocomplete popup */}
                    {showMentions && filteredMentionUsers.length > 0 && (
                      <div
                        ref={mentionRef}
                        className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-gray-200 bg-white shadow-lg"
                      >
                        {filteredMentionUsers.map((mu, i) => (
                          <button
                            key={mu.id}
                            onClick={() => insertMention(mu)}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                              i === mentionIndex
                                ? "bg-emerald-50 text-emerald-700"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                              {(mu.name || mu.email)[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">
                                {mu.name || mu.email.split("@")[0]}
                              </p>
                              <p className="text-xs text-gray-400">
                                {mu.email}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <form
                      onSubmit={handleSendMessage}
                      className="flex items-center gap-2"
                    >
                      <Input
                        ref={inputRef}
                        value={newMessage}
                        onChange={(e) => handleMessageInput(e.target.value)}
                        onKeyDown={handleMentionKeyDown}
                        placeholder={t("messagePlaceholder")}
                        disabled={sendingMsg}
                        className="flex-1"
                        maxLength={5000}
                      />
                      <Button
                        type="submit"
                        disabled={!newMessage.trim() || sendingMsg}
                        size="sm"
                      >
                        <SendIcon className="h-4 w-4" />
                        <span className="sr-only">{t("send")}</span>
                      </Button>
                    </form>
                    <p className="mt-1 text-xs text-gray-400">
                      {t("mentionHint")}
                    </p>
                  </div>
                </div>

                {/* ─── Channel Settings Panel ─── */}
                {showSettings && (
                  <aside className="flex w-72 flex-shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white">
                    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                      <h3 className="font-semibold text-gray-900">
                        {t("channelSettings")}
                      </h3>
                      <button
                        onClick={() => setShowSettings(false)}
                        className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      {/* Channel info */}
                      {activeChannel.type !== "DIRECT" && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                            {t("channelName")}
                          </p>
                          <p className="mt-1 text-sm font-medium text-gray-900">
                            # {activeChannel.name}
                          </p>
                          {activeChannel.description && (
                            <>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                {t("channelDesc")}
                              </p>
                              <p className="mt-1 text-sm text-gray-600">
                                {activeChannel.description}
                              </p>
                            </>
                          )}
                        </div>
                      )}

                      {/* Members */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                            {t("membersLabel")} ({settingMembers.length})
                          </p>
                          {activeChannel.type !== "DIRECT" && (
                            <button
                              onClick={() => setShowAddMembers(!showAddMembers)}
                              className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50"
                              title={t("addMember")}
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Add member search */}
                        {showAddMembers && (
                          <div className="mb-3">
                            <div className="relative">
                              <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                              <input
                                type="text"
                                value={addMemberSearch}
                                onChange={(e) =>
                                  setAddMemberSearch(e.target.value)
                                }
                                placeholder={t("searchMembers")}
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                                autoFocus
                              />
                            </div>
                            <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-gray-100">
                              {addableMembersForSettings.length === 0 ? (
                                <p className="p-2 text-center text-xs text-gray-400">
                                  {t("noUsersFound")}
                                </p>
                              ) : (
                                addableMembersForSettings.map((wu) => (
                                  <button
                                    key={wu.id}
                                    onClick={() => handleAddMember(wu.id)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-emerald-50"
                                  >
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                                      {(wu.name || wu.email)[0]?.toUpperCase()}
                                    </div>
                                    <span className="truncate text-gray-700">
                                      {wu.name || wu.email}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {/* Member list */}
                        <ul className="space-y-1">
                          {settingMembers.map((m: ChannelMember) => (
                            <li
                              key={m.userId}
                              className="group/member flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                                  {(m.user.name ||
                                    m.user.email)[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm text-gray-800">
                                    {m.user.name || m.user.email}
                                  </p>
                                  {m.userId === activeChannel.createdBy && (
                                    <span className="text-xs text-emerald-600">
                                      {t("creator")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {m.userId !== activeChannel.createdBy &&
                                activeChannel.type !== "DIRECT" && (
                                  <button
                                    onClick={() => handleRemoveMember(m.userId)}
                                    className="rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover/member:opacity-100"
                                    title={t("removeMember")}
                                  >
                                    <XIcon className="h-3.5 w-3.5" />
                                  </button>
                                )}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Leave channel */}
                      {activeChannel.type !== "DIRECT" && (
                        <div className="mt-6 border-t border-gray-100 pt-4">
                          <button
                            onClick={() => handleRemoveMember(user?.id || "")}
                            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                          >
                            {t("leaveChannel")}
                          </button>
                        </div>
                      )}
                    </div>
                  </aside>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <MessageCircleIcon className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                <p className="font-medium text-gray-500">
                  {t("selectChannel")}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  {t("selectChannelDesc")}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ─── New Channel Modal ─── */}
      {showNewChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-emerald-600" />
                <h2 className="font-semibold text-gray-900">
                  {t("newChannel")}
                </h2>
              </div>
              <button
                onClick={closeNewChannelModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4 p-6">
              <div>
                <Label htmlFor="channelName">{t("channelName")} *</Label>
                <Input
                  id="channelName"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder={t("channelNamePlaceholder")}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="channelDesc">{t("channelDesc")}</Label>
                <Input
                  id="channelDesc"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder={t("channelDescPlaceholder")}
                  maxLength={200}
                />
              </div>

              {/* Member picker */}
              <div>
                <Label>{t("addMembers")}</Label>

                {/* Selected members chips */}
                {selectedMembers.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedMembers.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                      >
                        {m.name || m.email}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMembers((prev) =>
                              prev.filter((p) => p.id !== m.id),
                            )
                          }
                          className="rounded-full p-0.5 hover:bg-emerald-100"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder={t("searchMembers")}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  />
                </div>

                {/* Dropdown */}
                {loadingUsers ? (
                  <div className="mt-1 rounded-lg border border-gray-100 p-3 text-center">
                    <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  </div>
                ) : (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-100">
                    {filteredMembersForPicker.length === 0 ? (
                      <p className="p-3 text-center text-sm text-gray-400">
                        {t("noUsersFound")}
                      </p>
                    ) : (
                      filteredMembersForPicker.map((wu) => (
                        <button
                          type="button"
                          key={wu.id}
                          onClick={() =>
                            setSelectedMembers((prev) => [...prev, wu])
                          }
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-emerald-50"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                            {(wu.name || wu.email)[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">
                              {wu.name || wu.email.split("@")[0]}
                            </p>
                            <p className="text-xs text-gray-400">{wu.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeNewChannelModal}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={!newChannelName.trim() || creatingChannel}
                >
                  {creatingChannel ? tc("loading") : t("createChannel")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── New DM Modal ─── */}
      {showNewDM && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-emerald-600" />
                <h2 className="font-semibold text-gray-900">{t("newDM")}</h2>
              </div>
              <button
                onClick={() => {
                  setShowNewDM(false);
                  setMemberSearch("");
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative mb-3">
                <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder={t("searchMembers")}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  autoFocus
                />
              </div>

              <div className="max-h-60 overflow-y-auto">
                {workspaceUsers
                  .filter(
                    (wu) =>
                      wu.id !== user?.id &&
                      (wu.name
                        ?.toLowerCase()
                        .includes(memberSearch.toLowerCase()) ||
                        wu.email
                          .toLowerCase()
                          .includes(memberSearch.toLowerCase())),
                  )
                  .map((wu) => (
                    <button
                      key={wu.id}
                      onClick={() => handleStartDM(wu)}
                      disabled={creatingChannel}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                        {(wu.name || wu.email)[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {wu.name || wu.email.split("@")[0]}
                        </p>
                        <p className="text-xs text-gray-400">{wu.email}</p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
