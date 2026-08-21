import "server-only";
import { createAdminClient } from "@supabase/server/core";
import type { Database } from "@/lib/database.types";

// Import "server-only" chặn build nếu file này lỡ bị import vào code chạy ở trình duyệt.
// Dùng secret key (bypass RLS) — bảng conversations/chat_messages không có policy nào
// cho anon/publishable key, nên trình duyệt không thể đọc/ghi trực tiếp dù có URL project.

const supabaseAdmin = createAdminClient<Database>();

export interface StoredMessage {
  sender: "user" | "bot";
  content: string;
}

export async function getOrCreateConversation(conversationId: string | null) {
  if (conversationId) {
    const { data } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (data) return data.id as string;
  }

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({})
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Không tạo được cuộc hội thoại mới");
  return data.id as string;
}

export async function getMessages(conversationId: string) {
  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .select("sender, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as StoredMessage[];
}

export async function addMessage(conversationId: string, message: StoredMessage) {
  const { error } = await supabaseAdmin.from("chat_messages").insert({
    conversation_id: conversationId,
    sender: message.sender,
    content: message.content,
  });
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
}

// --- Dùng cho trang quản trị /admin/conversations ---

export interface ConversationSummary {
  id: string;
  channel: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const { data: conversations, error } = await supabaseAdmin
    .from("conversations")
    .select("id, channel, started_at, last_message_at")
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!conversations || conversations.length === 0) return [];

  // Đếm số tin nhắn theo từng cuộc hội thoại — quy mô demo nên gộp ở phía JS
  // thay vì viết SQL group-by riêng.
  const { data: allMessages, error: countError } = await supabaseAdmin
    .from("chat_messages")
    .select("conversation_id");
  if (countError) throw new Error(countError.message);

  const messageCounts = new Map<string, number>();
  for (const row of allMessages ?? []) {
    messageCounts.set(row.conversation_id, (messageCounts.get(row.conversation_id) ?? 0) + 1);
  }

  return conversations.map((c) => ({
    id: c.id,
    channel: c.channel,
    startedAt: c.started_at,
    lastMessageAt: c.last_message_at,
    messageCount: messageCounts.get(c.id) ?? 0,
  }));
}

export interface ConversationMessage {
  sender: "user" | "bot";
  content: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  channel: string;
  startedAt: string;
  messages: ConversationMessage[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getConversationDetail(
  conversationId: string,
): Promise<ConversationDetail | null> {
  if (!UUID_RE.test(conversationId)) return null;

  const { data: conversation, error } = await supabaseAdmin
    .from("conversations")
    .select("id, channel, started_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!conversation) return null;

  const { data: messages, error: msgError } = await supabaseAdmin
    .from("chat_messages")
    .select("sender, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (msgError) throw new Error(msgError.message);

  return {
    id: conversation.id,
    channel: conversation.channel,
    startedAt: conversation.started_at,
    messages: (messages ?? []).map((m) => ({
      sender: m.sender as "user" | "bot",
      content: m.content,
      createdAt: m.created_at,
    })),
  };
}
