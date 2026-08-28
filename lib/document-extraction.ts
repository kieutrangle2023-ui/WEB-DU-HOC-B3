import "server-only";
import type { DocStatus } from "@/lib/mock-data";
import type { IdentityData, IeltsData, TranscriptData } from "@/lib/student-profile-store";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Ảnh chụp thật (điện thoại, có thể hơi nghiêng/loá sáng/nền lộn xộn) khác hẳn
// file scan phẳng phiu — nhắc Gemini cố đọc hết mức có thể thay vì bỏ cuộc sớm.
const REAL_WORLD_PHOTO_NOTE =
  "Đây có thể là ảnh chụp bằng điện thoại (không phải bản scan phẳng): có thể hơi nghiêng, loá sáng, có nền xung quanh, hoặc chỉ chụp một phần giấy tờ. Cố gắng đọc hết mức có thể trong điều kiện đó — chỉ để null khi thực sự không thấy hoặc không đọc nổi ký tự nào, đừng bỏ cuộc chỉ vì ảnh không hoàn hảo.";

async function callGemini<T>(
  base64Data: string,
  mimeType: string,
  systemInstruction: string,
  responseSchema: object,
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY trên server.");

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: "Đọc file đính kèm và trích xuất thông tin theo đúng schema đã cho." },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini document extraction error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini không trả về dữ liệu trích xuất.");
  return JSON.parse(text);
}

function unreadableReason(missingFields: string[]): string {
  return `Không đọc được ${missingFields.join(", ")} từ file này, bạn thử chụp/scan lại rõ hơn (đủ sáng, không nghiêng, lấy trọn giấy tờ trong khung hình) nhé.`;
}

// --- Bảng điểm (PDF) ---

const TRANSCRIPT_SYSTEM_INSTRUCTION = `Bạn là công cụ trích xuất dữ liệu từ bảng điểm học tập (PDF). ${REAL_WORLD_PHOTO_NOTE}

Trả về đúng object JSON theo schema:
- fullName: họ tên học sinh/sinh viên ghi trên bảng điểm.
- dateOfBirth: ngày sinh nếu bảng điểm có ghi, định dạng dd/mm/yyyy.
- gpa: điểm học tập tổng kết/điểm trung bình tích lũy (thang điểm ghi trên bảng điểm, giữ nguyên, không tự quy đổi thang điểm).
Nếu file không phải bảng điểm, để tất cả là null. Không suy đoán hay bịa số liệu.`;

const TRANSCRIPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    fullName: { type: "STRING", nullable: true },
    dateOfBirth: { type: "STRING", nullable: true },
    gpa: { type: "NUMBER", nullable: true },
  },
};

export async function extractTranscript(
  base64Data: string,
  mimeType: string,
): Promise<{ status: DocStatus; reason: string | null; data: TranscriptData }> {
  const parsed = await callGemini<TranscriptData>(
    base64Data,
    mimeType,
    TRANSCRIPT_SYSTEM_INSTRUCTION,
    TRANSCRIPT_SCHEMA,
  );

  const data: TranscriptData = {
    fullName: parsed.fullName ?? null,
    dateOfBirth: parsed.dateOfBirth ?? null,
    gpa: parsed.gpa ?? null,
  };

  const missing = [
    !data.fullName && "họ tên",
    data.gpa == null && "điểm học tập",
  ].filter((v): v is string => Boolean(v));

  return {
    status: missing.length === 0 ? "hop_le" : "can_nop_lai",
    reason: missing.length === 0 ? null : unreadableReason(missing),
    data,
  };
}

// --- Chứng chỉ IELTS (ảnh) ---

const IELTS_SYSTEM_INSTRUCTION = `Bạn là công cụ trích xuất dữ liệu từ ảnh chứng chỉ/Test Report Form IELTS. ${REAL_WORLD_PHOTO_NOTE}

Trả về đúng object JSON theo schema:
- fullName: họ tên thí sinh ghi trên chứng chỉ (Candidate Name).
- listening, reading, writing, speaking: điểm từng kỹ năng (Listening, Reading, Writing, Speaking).
- overall: điểm tổng (Overall Band Score).
- examDate: ngày thi (Test Date), định dạng dd/mm/yyyy.
Nếu file không phải chứng chỉ IELTS, để tất cả là null. Không suy đoán hay bịa số liệu.`;

const IELTS_SCHEMA = {
  type: "OBJECT",
  properties: {
    fullName: { type: "STRING", nullable: true },
    listening: { type: "NUMBER", nullable: true },
    reading: { type: "NUMBER", nullable: true },
    writing: { type: "NUMBER", nullable: true },
    speaking: { type: "NUMBER", nullable: true },
    overall: { type: "NUMBER", nullable: true },
    examDate: { type: "STRING", nullable: true },
  },
};

export async function extractIelts(
  base64Data: string,
  mimeType: string,
): Promise<{ status: DocStatus; reason: string | null; data: IeltsData }> {
  const parsed = await callGemini<IeltsData>(base64Data, mimeType, IELTS_SYSTEM_INSTRUCTION, IELTS_SCHEMA);

  const data: IeltsData = {
    fullName: parsed.fullName ?? null,
    listening: parsed.listening ?? null,
    reading: parsed.reading ?? null,
    writing: parsed.writing ?? null,
    speaking: parsed.speaking ?? null,
    overall: parsed.overall ?? null,
    examDate: parsed.examDate ?? null,
  };

  const missing = [data.overall == null && "điểm tổng (Overall)"].filter((v): v is string => Boolean(v));

  return {
    status: missing.length === 0 ? "hop_le" : "can_nop_lai",
    reason: missing.length === 0 ? null : unreadableReason(missing),
    data,
  };
}

// --- CMND/CCCD/hộ chiếu (ảnh) ---

const IDENTITY_SYSTEM_INSTRUCTION = `Bạn là công cụ trích xuất dữ liệu từ ảnh CMND/CCCD (mặt trước, thẻ cứng có ảnh chân dung + chip) hoặc hộ chiếu Việt Nam. ${REAL_WORLD_PHOTO_NOTE}

Vị trí thông tin thường gặp trên CCCD/CMND mặt trước: "Số/No." ở gần góc trên bên phải hoặc dưới ảnh chân dung là số định danh cá nhân/số CMND; "Họ và tên/Full name" và "Ngày sinh/Date of birth" nằm bên phải ảnh chân dung. Trên hộ chiếu, các trường này nằm ở dòng thông tin phía dưới hoặc dòng MRZ (2 dòng ký tự in hoa + số + dấu < ở cuối trang) — có thể đọc số hộ chiếu và ngày sinh từ MRZ nếu phần chữ in thường bị mờ.

Trả về đúng object JSON theo schema:
- fullName: họ tên ghi trên giấy tờ.
- dateOfBirth: ngày sinh, định dạng dd/mm/yyyy.
- documentNumber: số CMND/CCCD hoặc số hộ chiếu.
Nếu file không phải CMND/CCCD/hộ chiếu, để tất cả là null. Không suy đoán hay bịa số liệu.`;

const IDENTITY_SCHEMA = {
  type: "OBJECT",
  properties: {
    fullName: { type: "STRING", nullable: true },
    dateOfBirth: { type: "STRING", nullable: true },
    documentNumber: { type: "STRING", nullable: true },
  },
};

export async function extractIdentity(
  base64Data: string,
  mimeType: string,
): Promise<{ status: DocStatus; reason: string | null; data: IdentityData }> {
  const parsed = await callGemini<IdentityData>(
    base64Data,
    mimeType,
    IDENTITY_SYSTEM_INSTRUCTION,
    IDENTITY_SCHEMA,
  );

  const data: IdentityData = {
    fullName: parsed.fullName ?? null,
    dateOfBirth: parsed.dateOfBirth ?? null,
    documentNumber: parsed.documentNumber ?? null,
  };

  const missing = [
    !data.fullName && "họ tên",
    !data.documentNumber && "số giấy tờ",
  ].filter((v): v is string => Boolean(v));

  return {
    status: missing.length === 0 ? "hop_le" : "can_nop_lai",
    reason: missing.length === 0 ? null : unreadableReason(missing),
    data,
  };
}
