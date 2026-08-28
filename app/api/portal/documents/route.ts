import { cookies } from "next/headers";
import { extractIdentity, extractIelts, extractTranscript } from "@/lib/document-extraction";
import { getOrCreateStudentProfile, saveIdentity, saveIelts, saveTranscript } from "@/lib/student-profile-store";

// Cookie chỉ mang một UUID vô nghĩa để nối các lần nộp giấy tờ về cùng một hồ
// sơ học viên (chưa có đăng nhập ở bản này) — toàn bộ nội dung trích xuất nằm
// trong Supabase, đọc/ghi riêng bằng secret key ở lib/student-profile-store.ts.
// Trình duyệt không đọc được cookie này (httpOnly) và không truy vấn được
// database trực tiếp.
const COOKIE_NAME = "duhoc24_student_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 ngày

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB — ảnh chụp thẳng từ điện thoại có thể khá nặng

// Gemini chỉ đọc được PNG/JPEG/WebP cho ảnh — không đọc được HEIC/HEIF (định
// dạng mặc định camera iPhone).
const ACCEPTED_MIME: Record<string, string[]> = {
  transcript: ["application/pdf"],
  ielts: ["image/jpeg", "image/png", "image/webp"],
  identity: ["image/jpeg", "image/png", "image/webp"],
};

const HEIC_TYPES = ["image/heic", "image/heif"];

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const docType = formData.get("docType");
  const file = formData.get("file");

  if (docType !== "transcript" && docType !== "ielts" && docType !== "identity") {
    return Response.json({ error: "Loại giấy tờ không hợp lệ." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Thiếu file." }, { status: 400 });
  }
  if (!ACCEPTED_MIME[docType].includes(file.type)) {
    if (docType !== "transcript" && HEIC_TYPES.includes(file.type)) {
      return Response.json(
        {
          error:
            "File này ở định dạng HEIC (định dạng ảnh mặc định của iPhone), hệ thống chưa đọc được. Bạn vào Cài đặt → Máy ảnh → Định dạng, chọn \"Tương thích cao nhất\" rồi chụp lại, hoặc chọn ảnh có sẵn và lưu lại dưới dạng JPG trước khi nộp nhé.",
        },
        { status: 400 },
      );
    }
    return Response.json(
      {
        error:
          docType === "transcript"
            ? "Chỉ chấp nhận file PDF."
            : "Chỉ chấp nhận file ảnh JPG, PNG hoặc WebP.",
      },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File vượt quá 15MB." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const profileId = await getOrCreateStudentProfile(cookieStore.get(COOKIE_NAME)?.value ?? null);
  cookieStore.set(COOKIE_NAME, profileId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  const base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    if (docType === "transcript") {
      const result = await extractTranscript(base64Data, file.type);
      await saveTranscript(profileId, file.name, result);
      return Response.json({ docType, fileName: file.name, ...result });
    }

    if (docType === "ielts") {
      const result = await extractIelts(base64Data, file.type);
      await saveIelts(profileId, file.name, result);
      return Response.json({ docType, fileName: file.name, ...result });
    }

    const result = await extractIdentity(base64Data, file.type);
    await saveIdentity(profileId, file.name, result);
    return Response.json({ docType, fileName: file.name, ...result });
  } catch (err) {
    console.error("Document extraction failed", err);
    return Response.json(
      { error: "Đọc file thất bại, bạn thử lại giúp mình nhé." },
      { status: 500 },
    );
  }
}
