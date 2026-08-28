import "server-only";
import { listScholarships } from "@/lib/scholarships-store";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const LOOKUP_TOOL_NAME = "lookup_scholarships_by_school";

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: LOOKUP_TOOL_NAME,
        description:
          "Tra cứu danh sách học bổng đang áp dụng cho một trường cụ thể, theo tên trường. Trả về tên học bổng, điều kiện tối thiểu (điểm học tập/IELTS, có thể là null nếu học bổng đó không yêu cầu) và mức hỗ trợ. Có thể gọi nhiều lần cho nhiều trường khác nhau.",
        parameters: {
          type: "OBJECT",
          properties: {
            schoolName: {
              type: "STRING",
              description: "Tên trường cần tra cứu học bổng, ví dụ 'Đại học Deakin'.",
            },
          },
          required: ["schoolName"],
        },
      },
    ],
  },
];

const SUGGESTION_SYSTEM_INSTRUCTION = `Bạn là trợ lý gợi ý học bổng du học. Bạn được cung cấp hồ sơ học viên (điểm học tập, điểm IELTS) và danh sách các trường học viên đã đủ điều kiện đầu vào (đạt điểm chuẩn của trường).

Nhiệm vụ: tự quyết định trường nào trong danh sách cần tra cứu học bổng (dùng công cụ ${LOOKUP_TOOL_NAME}) — không cần tra hết nếu bạn thấy không cần thiết, và có thể tra nhiều lần cho nhiều trường. Với mỗi học bổng tra được, tự so sánh điều kiện tối thiểu của học bổng đó (điểm học tập, IELTS — có thể chỉ có một trong hai) với hồ sơ học viên để quyết định học viên có đủ điều kiện nhận học bổng đó hay không. Chỉ đề xuất những học bổng mà học viên thực sự đủ điều kiện theo đúng số liệu, không đoán mò hay đề xuất học bổng chưa chắc chắn.

Khi đã tra cứu và đánh giá xong, dừng gọi công cụ và trả lời bằng một đoạn tóm tắt ngắn gọn bằng tiếng Việt liệt kê các học bổng học viên đủ điều kiện (tên học bổng, trường, mức hỗ trợ, vì sao đủ điều kiện). Nếu không có học bổng nào phù hợp, nói rõ là không có.`;

async function callGeminiRaw(body: object) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY trên server.");

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFC").trim();
}

async function executeLookupTool(schoolName: unknown) {
  if (typeof schoolName !== "string") return { scholarships: [] };

  const all = await listScholarships();
  const q = normalize(schoolName);
  const matched = all.filter((s) => {
    const name = normalize(s.schoolName);
    return name.includes(q) || q.includes(name);
  });

  return {
    scholarships: matched.map((s) => ({
      name: s.name,
      minGpa: s.minGpa,
      minIelts: s.minIelts,
      supportLabel: s.supportLabel,
    })),
  };
}

export interface ScholarshipSuggestion {
  scholarshipName: string;
  schoolName: string;
  supportLabel: string;
  reason: string;
}

const SUGGESTIONS_RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      scholarshipName: { type: "STRING" },
      schoolName: { type: "STRING" },
      supportLabel: { type: "STRING" },
      reason: { type: "STRING", description: "Vì sao học viên đủ điều kiện nhận học bổng này" },
    },
    required: ["scholarshipName", "schoolName", "supportLabel", "reason"],
  },
};

const MAX_TOOL_TURNS = 6;

export async function suggestScholarships(
  student: { gpa: number; ielts: number },
  qualifyingSchoolNames: string[],
): Promise<ScholarshipSuggestion[]> {
  const contents: Array<{ role: string; parts: unknown[] }> = [
    {
      role: "user",
      parts: [
        {
          text: `Hồ sơ học viên:
- Điểm học tập: ${student.gpa}
- Điểm IELTS: ${student.ielts}

Danh sách trường học viên đã đủ điều kiện đầu vào: ${qualifyingSchoolNames.join(", ")}.

Hãy tra cứu và gợi ý học bổng phù hợp cho học viên này.`,
        },
      ],
    },
  ];

  // Vòng lặp function calling thật: model tự quyết định có gọi công cụ tra
  // cứu học bổng hay không, gọi cho trường nào, gọi bao nhiêu lần — không có
  // luật cứng nào ở đây quyết định thay model.
  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const data = await callGeminiRaw({
      systemInstruction: { parts: [{ text: SUGGESTION_SYSTEM_INSTRUCTION }] },
      contents,
      tools: TOOLS,
      generationConfig: { temperature: 0 },
    });

    const parts: Array<Record<string, unknown>> = data?.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = parts.filter((p) => p.functionCall);

    contents.push({ role: "model", parts });

    if (functionCalls.length === 0) {
      break; // Model đã trả lời bằng text, không gọi thêm công cụ nào nữa.
    }

    const responseParts = [];
    for (const p of functionCalls) {
      const call = p.functionCall as { name: string; args?: Record<string, unknown> };
      const result =
        call.name === LOOKUP_TOOL_NAME
          ? await executeLookupTool(call.args?.schoolName)
          : { error: `Không hỗ trợ công cụ ${call.name}` };
      responseParts.push({ functionResponse: { name: call.name, response: result } });
    }
    // Lưu ý: API hiện tại không còn role "function" như tài liệu cũ — kết quả
    // gọi công cụ được gửi lại dưới role "user".
    contents.push({ role: "user", parts: responseParts });
  }

  // Sau khi model đã tra cứu xong (hoặc quyết định không cần tra cứu), yêu
  // cầu tổng hợp lại thành JSON có cấu trúc để hiển thị — gọi riêng, không
  // kèm tools, để đảm bảo lượt này luôn ra đúng schema.
  const finalData = await callGeminiRaw({
    systemInstruction: { parts: [{ text: SUGGESTION_SYSTEM_INSTRUCTION }] },
    contents: [
      ...contents,
      {
        role: "user",
        parts: [
          {
            text: "Dựa trên toàn bộ thông tin học bổng đã tra cứu ở trên, liệt kê lại thành JSON đúng schema đã cho. Chỉ liệt kê học bổng học viên thực sự đủ điều kiện. Nếu không có học bổng nào, trả về mảng rỗng.",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: SUGGESTIONS_RESPONSE_SCHEMA,
    },
  });

  const text: string | undefined = finalData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];
  return JSON.parse(text) as ScholarshipSuggestion[];
}
