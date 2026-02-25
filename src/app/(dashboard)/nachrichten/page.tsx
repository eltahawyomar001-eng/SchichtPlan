"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  _count?: { messages: number };
  members?: { userId: string; user: { name: string | null; email: string } }[];
}

interface Message {
  id: string;
  content: string;
  senderName: string;
  senderId: string;
  createdAt: string;
}

// ─── Component ──────────────────────────────────────────────────

export default function NachrichtenPage() {
  const t = useTranslations("teamChat");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const { handlePlanLimit } = usePlanLimit();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planGated, setPlanGated] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [handlePlanLimit]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // ── Fetch messages for active channel ──────────────────────

  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(
        `/api/chat/channels/${channelId}/messages?limit=50`,
      );
      if (res.ok) {
        const data = await res.json();
        // Messages come newest-first; reverse for display
        setMessages((data.messages as Message[]).reverse());
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    if (!activeChannel) return;

    fetchMessages(activeChannel.id);

    // Poll every 5 seconds for new messages
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
        setMessages((prev) => [...prev, msg]);
      } else {
        setError(tc("errorOccurred"));
        setNewMessage(content); // Restore
      }
    } catch {
      setError(tc("errorOccurred"));
      setNewMessage(content);
    } finally {
      setSendingMsg(false);
    }
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
          memberIds: [],
        }),
      });

      if (res.ok) {
        const channel: Channel = await res.json();
        setChannels((prev) => [channel, ...prev]);
        setActiveChannel(channel);
        setShowNewChannel(false);
        setNewChannelName("");
        setNewChannelDesc("");
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

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <div className="p-6 flex items-center justify-center">
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
              <MessageCircleIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-semibold text-gray-800 mb-2">
                {t("planRequired")}
              </p>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {t("planRequiredDesc")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Topbar title={t("title")} description={t("description")} />

      <div className="flex flex-1 overflow-hidden">
        {/* Channel list */}
        <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              {t("channels")}
            </h2>
            <button
              onClick={() => setShowNewChannel(true)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
              title={t("newChannel")}
            >
              <PlusIcon className="h-4 w-4" />
            </button>
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
              <ul className="p-2 space-y-0.5">
                {channels.map((ch) => (
                  <li key={ch.id}>
                    <button
                      onClick={() => {
                        setActiveChannel(ch);
                        setMessages([]);
                      }}
                      className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                        activeChannel?.id === ch.id
                          ? "bg-emerald-50 text-emerald-700 font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-gray-400 mr-1">#</span>
                      <span className="truncate">{ch.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Message area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {activeChannel ? (
            <>
              {/* Channel header */}
              <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-medium">#</span>
                  <h2 className="font-semibold text-gray-900">
                    {activeChannel.name}
                  </h2>
                  {activeChannel.description && (
                    <span className="text-sm text-gray-400 hidden sm:inline">
                      · {activeChannel.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
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
                  <div className="text-center py-12">
                    <MessageCircleIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">{t("noMessages")}</p>
                  </div>
                )}

                {messages.map((msg, idx) => {
                  const isOwn = msg.senderId === user?.id;
                  const prevMsg = idx > 0 ? messages[idx - 1] : null;
                  const showSender =
                    !prevMsg || prevMsg.senderId !== msg.senderId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}
                      >
                        {showSender && (
                          <span
                            className={`text-xs text-gray-500 mb-1 ${isOwn ? "text-right" : ""}`}
                          >
                            {msg.senderName}
                          </span>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm break-words ${
                            isOwn
                              ? "bg-emerald-600 text-white rounded-br-md"
                              : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md"
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-xs text-gray-400 mt-0.5">
                          {new Date(msg.createdAt).toLocaleTimeString("de-DE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <div className="bg-white border-t border-gray-200 p-3">
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
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
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircleIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">
                  {t("selectChannel")}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {t("selectChannelDesc")}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* New channel modal */}
      {showNewChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-emerald-600" />
                <h2 className="font-semibold text-gray-900">
                  {t("newChannel")}
                </h2>
              </div>
              <button
                onClick={() => setShowNewChannel(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="p-6 space-y-4">
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

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewChannel(false)}
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
    </div>
  );
}
