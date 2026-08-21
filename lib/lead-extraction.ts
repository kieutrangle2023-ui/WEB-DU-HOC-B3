import "server-only";
import { createAdminClient } from "@supabase/server/core";
import type { Database } from "@/lib/database.types";
import { getMessages } from "@/lib/chat-store";

const supabaseAdmin = createAdminClient<Database>();

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const EXTRACTION_SYSTEM_INSTRUCTION = `Bạn là công cụ trích xuất dữ liệu, đọc bản ghi hội thoại giữa một trợ lý tư vấn du học và một khách truy cập, rồi trả về đúng một object JSON theo schema đã cho.

Quy tắc:
- Chỉ lấy thông tin khách thực sự đã nói ra trong hội thoại, không suy đoán hay bịa thêm.
- Trường nào khách chưa cung cấp thì để null (trừ bookedConsultation và quality, luôn phải có giá trị).
- bookedConsultation = true chỉ khi khách đã đồng ý đặt lịch tư vấn (không chỉ hỏi thông tin).
- quality đánh giá dựa trên mức độ nghiêm túc/tiềm năng của lead:
  - "good": có nhu cầu rõ ràng và đã để lại ít nhất một trong các thông tin liên hệ (email hoặc số điện thoại).
  - "ok": có trao đổi thực chất về nhu cầu du học nhưng chưa để lại thông tin liên hệ đầy đủ.
  - "spam": hội thoại rỗng, test, chửi bậy, quảng cáo, hoặc không liên quan gì đến du học.
- notes: tóm tắt ngắn gọn (1-2 câu) các điểm đáng chú ý khác (ví dụ: đã có IELTS, ngân sách, thời gian dự kiến đi học...).`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", nullable: true, description: "Họ tên khách" },
    email: { type: "STRING", nullable: true },
    phone: { type: "STRING", nullable: true, description: "Số điện thoại" },
    country: { type: "STRING", nullable: true, description: "Nước du học khách quan tâm" },
    educationLevel: {
      type: "STRING",
      nullable: true,
      description: "Bậc học, ví dụ THPT, Đại học, Thạc sĩ",
    },
    major: { type: "STRING", nullable: true, description: "Ngành học quan tâm" },
    availability: {
      type: "STRING",
      nullable: true,
      description: "Thời gian khách rảnh để được tư vấn/gọi điện, nếu có nhắc tới",
    },
    bookedConsultation: {
      type: "BOOLEAN",
      description: "true nếu khách đã đồng ý đặt lịch tư vấn",
    },
    notes: { type: "STRING", nullable: true },
    quality: { type: "STRING", enum: ["good", "ok", "spam"] },
  },
  required: ["bookedConsultation", "quality"],
};

interface ExtractedLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  educationLevel: string | null;
  major: string | null;
  availability: string | null;
  bookedConsultation: boolean;
  notes: string | null;
  quality: "good" | "ok" | "spam";
}

export interface Lead {
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  educationLevel: string | null;
  major: string | null;
  availability: string | null;
  bookedConsultation: boolean;
  notes: string | null;
  quality: "good" | "ok" | "spam";
  extractedAt: string;
}

function toLead(row: {
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  education_level: string | null;
  major: string | null;
  availability: string | null;
  booked_consultation: boolean;
  notes: string | null;
  quality: string;
  extracted_at: string;
}): Lead {
  return {
    name: row.name,
    email: row.email,
    phone: row.phone,
    country: row.country,
    educationLevel: row.education_level,
    major: row.major,
    availability: row.availability,
    bookedConsultation: row.booked_consultation,
    notes: row.notes,
    quality: row.quality as Lead["quality"],
    extractedAt: row.extracted_at,
  };
}

export async function getLead(conversationId: string): Promise<Lead | null> {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select(
      "name, email, phone, country, education_level, major, availability, booked_consultation, notes, quality, extracted_at",
    )
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toLead(data) : null;
}

export async function extractLead(conversationId: string): Promise<Lead | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY trên server.");

  const messages = await getMessages(conversationId);
  if (messages.length === 0) return null;

  const transcript = messages
    .map((m) => `${m.sender === "user" ? "Khách" : "Trợ lý"}: ${m.content}`)
    .join("\n");

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: transcript }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini extraction API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini không trả về dữ liệu trích xuất.");

  const parsed: ExtractedLead = JSON.parse(text);

  const { data: saved, error } = await supabaseAdmin
    .from("leads")
    .upsert(
      {
        conversation_id: conversationId,
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        country: parsed.country,
        education_level: parsed.educationLevel,
        major: parsed.major,
        availability: parsed.availability,
        booked_consultation: parsed.bookedConsultation,
        notes: parsed.notes,
        quality: parsed.quality,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id" },
    )
    .select(
      "name, email, phone, country, education_level, major, availability, booked_consultation, notes, quality, extracted_at",
    )
    .single();
  if (error) throw new Error(error.message);

  return toLead(saved);
}
