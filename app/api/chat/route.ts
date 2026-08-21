import { cookies } from "next/headers";
import { chatSystemInstruction } from "@/lib/chat-knowledge";
import { addMessage, getMessages, getOrCreateConversation } from "@/lib/chat-store";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const FALLBACK_ANSWER =
  "Mình chưa có thông tin cụ thể cho câu hỏi này. Bạn để lại câu hỏi ở đây hoặc để lại email/số điện thoại trong form báo giá, đội ngũ tư vấn sẽ liên hệ lại nhé.";

// Cookie chỉ mang một UUID vô nghĩa dùng để nối các lượt chat cùng một khách,
// không chứa nội dung hội thoại — toàn bộ nội dung nằm trong Supabase, đọc/ghi
// riêng bằng secret key ở lib/chat-store.ts. Trình duyệt không đọc được cookie
// này (httpOnly) và không có cách nào truy vấn database trực tiếp.
const COOKIE_NAME = "duhoc24_conv_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 ngày

export async function GET() {
  const cookieStore = await cookies();
  const conversationId = cookieStore.get(COOKIE_NAME)?.value ?? null;

  if (!conversationId) {
    return Response.json({ messages: [] });
  }

  const stored = await getMessages(conversationId);
  return Response.json({
    messages: stored.map((m) => ({ from: m.sender, text: m.content })),
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Chưa cấu hình GEMINI_API_KEY trên server." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const message: string = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "Thiếu nội dung câu hỏi." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const conversationId = await getOrCreateConversation(
    cookieStore.get(COOKIE_NAME)?.value ?? null,
  );
  cookieStore.set(COOKIE_NAME, conversationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  await addMessage(conversationId, { sender: "user", content: message });
  const history = await getMessages(conversationId);
  const contents = history.map((m) => ({
    role: m.sender === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  let reply = FALLBACK_ANSWER;
  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: chatSystemInstruction }] },
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
      }),
    });

    if (!res.ok) {
      console.error("Gemini API error", res.status, await res.text());
    } else {
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) reply = text;
    }
  } catch (err) {
    console.error("Gemini request failed", err);
  }

  await addMessage(conversationId, { sender: "bot", content: reply });

  return Response.json({ reply });
}
