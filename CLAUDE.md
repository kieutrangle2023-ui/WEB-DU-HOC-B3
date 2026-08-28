# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Tổng quan dự án

DuHoc24 — website mẫu "Cổng Tiếp Nhận Hồ Sơ Du Học", dùng cho khoá lập trình 6 tuần. Ban đầu (Tuần 1) là bản UI thuần với mock data trong [lib/mock-data.ts](lib/mock-data.ts), nhưng đã được nối backend thật (Supabase + Gemini) sớm hơn lộ trình gốc — xem "Trạng thái thật vs mock" bên dưới để biết phần nào đã thật, phần nào còn là UI/mock. Lộ trình gốc theo tuần vẫn còn trong [README.md](README.md) nhưng không còn phản ánh đúng tiến độ hiện tại.

## Lệnh thường dùng

```bash
npm run dev      # chạy dev server tại http://localhost:3000
npm run build    # build production
npm run lint     # chạy ESLint (eslint.config.mjs, flat config)
```

Không có tsc script riêng — kiểm tra type qua `npm run build` hoặc IDE (dùng `strict: true`). Chưa có test runner nào được cấu hình.

## Kiến trúc

**Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4.** Phần lớn trang vẫn là Server Component, nhưng các khu vực đã nối backend thật dùng kết hợp Route Handler (`app/api/**/route.ts`) + Client Component quản lý state (chat widget, upload giấy tờ ở `/portal`).

### Trạng thái thật vs mock

| Khu vực | Nguồn dữ liệu | Ghi chú |
|---|---|---|
| Chatbot trang chủ (`components/landing/chat-widget.tsx`, `app/api/chat/route.ts`) | Thật — Gemini + Supabase | Lưu hội thoại vào bảng `conversations`/`chat_messages`, nhận diện khách qua cookie httpOnly (chưa có auth) |
| `/admin/conversations` (+ `[id]`) | Thật | Đọc `conversations`/`chat_messages`; tự trích xuất lead qua Gemini (`lib/lead-extraction.ts`) lưu vào bảng `leads`, hiện cạnh khung tin nhắn |
| `/admin/schools` | Thật | Bảng `schools`, dữ liệu **công khai** (có policy SELECT cho `anon`) |
| Học bổng (`lib/scholarships-store.ts`) | Thật | Bảng `scholarships` (khoá ngoại `school_id` → `schools`), công khai như `schools` |
| Gợi ý học bổng bằng AI (`components/portal/school-match.tsx`, `lib/scholarship-suggestions.ts`) | Thật — Gemini function calling | Sau khi biết học viên đạt trường nào (so sánh số học thuần, xem bên dưới), Gemini tự quyết định cần tra học bổng trường nào qua tool `lookup_scholarships_by_school`, tự đánh giá đủ điều kiện hay không — không có luật so sánh viết cứng cho bước này |
| `/portal` (upload giấy tờ) | Thật | Upload PDF/ảnh → Gemini đa phương thức trích xuất (`lib/document-extraction.ts`) → lưu bảng `student_profiles`; nhận diện học viên qua cookie httpOnly |
| `/admin/requests`, `/admin/profiles` | **Mock** | Vẫn đọc `admissionRequests`, `studentProfiles` từ `lib/mock-data.ts`, nút Duyệt/Từ chối/Sửa/Xoá chỉ là UI, chưa nối hành động thật |

Lưu ý: bảng Supabase `student_profiles` (hồ sơ giấy tờ thật của phiên `/portal` hiện tại) khác với type `StudentProfile`/mảng `studentProfiles` trong `lib/mock-data.ts` (danh sách nhiều học viên demo cho trang admin) — hai thứ trùng tên nhưng không liên quan tới nhau, đừng nhầm lẫn khi sửa.

### Mẫu kiến trúc dùng chung cho các tính năng đã nối Supabase

Mỗi tính năng thật (chat, lead, portal) theo cùng một khuôn:
- Một module `lib/*-store.ts` (hoặc `*-extraction.ts`) bắt đầu bằng `import "server-only"`, tạo client qua `createAdminClient<Database>()` từ `@supabase/server/core` (secret key, bypass RLS). **Trước khi sửa các file này, đọc skill `supabase-server`** (mô tả cách dùng package `@supabase/server`, đã cài trong `.agents/skills/`).
- Bảng tương ứng bật RLS **không có policy nào** (dữ liệu riêng tư: `conversations`, `chat_messages`, `leads`, `student_profiles`) — chỉ server bằng secret key mới đọc/ghi được, trình duyệt không có cách nào truy cập trực tiếp dù biết URL project. Ngoại lệ: `schools`, `scholarships` có policy SELECT công khai vì là dữ liệu tham chiếu, ai xem cũng được.
- Danh tính "khách/học viên nào" xác định qua cookie `httpOnly` chỉ chứa UUID vô nghĩa (`duhoc24_conv_id`, `duhoc24_student_id`) — chưa có đăng nhập thật nên đây là cách duy nhất nối các lượt tương tác về cùng một hồ sơ.
- Type `Database` sinh từ Supabase nằm ở [lib/database.types.ts](lib/database.types.ts) — chạy lại `npx supabase gen types typescript --project-id <ref>` và dán đè khi đổi schema (không tự sửa tay).
- Gemini gọi trực tiếp qua REST (`fetch` tới `generativelanguage.googleapis.com`, model `gemini-3.5-flash-lite`), dùng `responseMimeType: "application/json"` + `responseSchema` để lấy structured output thay vì parse text tự do. Không dùng SDK `@google/generative-ai`.
- **Function calling (`lib/scholarship-suggestions.ts`):** API hiện tại (bản Gemini đang dùng ở dự án này) **không dùng role `"function"`** cho lượt gửi kết quả tool như tài liệu/kiến thức huấn luyện cũ — gửi `functionResponse` dưới role `"user"`, nếu không sẽ bị lỗi 400 "Role 'function' is not supported". Việc quyết định "trường/mục nào cần tra cứu" và "có đủ điều kiện hay không" phải để model tự suy luận qua vòng lặp gọi tool thật — không viết luật so sánh cứng thay model (khác với đối chiếu điểm chuẩn ở `lib/school-eligibility.ts`, nơi phép so sánh BẮT BUỘC phải là code thuần, không qua AI).
- Trang admin đọc các bảng này đều đánh dấu `export const dynamic = "force-dynamic"` để tránh Next cache tĩnh lúc build (dữ liệu đổi liên tục).

### Nguồn dữ liệu mock còn lại: `lib/mock-data.ts`

Vẫn là nguồn cho `/admin/requests`, `/admin/profiles`, và các phần chưa nối thật khác (gói dịch vụ, danh sách quốc gia trên form báo giá...). Các type chính:
- `School`, `ServiceOption`, `AdmissionRequest`, `StudentProfile`, `Conversation` — một số đã có bảng Supabase thật tương ứng (xem bảng ở trên), số khác vẫn chỉ là mock.
- Các trạng thái dùng union string tiếng Việt không dấu làm enum: `DocStatus` (`chua_nop | dang_xu_ly | hop_le | can_nop_lai`), `RequestStatus` (`cho_duyet | da_duyet | tu_choi`), `ServicePackage` (`co_ban | toan_dien`). `DocStatus` cũng được tái dùng cho dữ liệu thật ở `/portal` (không định nghĩa lại). Khi thêm trạng thái mới, cập nhật đồng thời type và bảng mapping label/tone trong `status-badge.tsx`.
- `currentStudent` không còn được `/portal` dùng (đã thay bằng dữ liệu Supabase thật) nhưng vẫn giữ trong file làm dữ liệu tham khảo.

### Sơ đồ route (`app/`)

| Route | Vai trò |
|---|---|
| `/` | Landing page (hero, form báo giá, chatbot AI thật) |
| `/portal` | Cổng học viên — upload giấy tờ thật (Gemini trích xuất), đối chiếu điểm chuẩn với bảng `schools` |
| `/admin/*` | Layout riêng ([app/admin/layout.tsx](app/admin/layout.tsx)) với sidebar cố định; `/admin` redirect sang `/admin/requests` |

`/login` chưa tồn tại — sẽ dựng ở Tuần 6 kèm Supabase Auth (magic link). Đừng tự thêm auth/middleware trừ khi được yêu cầu — các tính năng thật ở trên đều dùng cookie ẩn danh thay vì auth thật.

### Component

- `components/ui/` — component nền shadcn/ui (style `base-nova`, base là [Base UI](https://base-ui.com), không phải Radix). Xem alias trong [components.json](components.json): `@/components`, `@/lib`, `@/components/ui`. Thêm component shadcn mới qua CLI `shadcn`, không tự chép tay trừ khi cần chỉnh sâu. Nút dùng làm link phải viết `<Button nativeButton={false} render={<Link href="...">...</Link>} />`, không lồng `<Link><Button/></Link>`.
- `components/landing/`, `components/portal/`, `components/admin/` — component theo từng khu vực. Phần đã nối thật nhận state từ Client Component quản lý riêng (`portal-documents.tsx`, `chat-widget.tsx`); phần còn mock vẫn nhận props kiểu từ `lib/mock-data.ts`.
- `status-badge.tsx` ([components/status-badge.tsx](components/status-badge.tsx)) là nơi tập trung mapping trạng thái → label tiếng Việt + màu (tone) + icon cho cả `DocStatus` và `RequestStatus`. Đây là điểm chạm bắt buộc mỗi khi UI cần hiển thị trạng thái mới.

### Ngôn ngữ & nội dung

Toàn bộ UI, comment, và `lang="vi"` ở [app/layout.tsx](app/layout.tsx) đều bằng tiếng Việt. Giữ nguyên văn phong này khi thêm text mới — không chuyển sang tiếng Anh trừ khi được yêu cầu. Font chữ dùng `Be Vietnam Pro` (subset `vietnamese`).

### Việc KHÔNG nên làm (trừ khi được yêu cầu rõ)

- Không tự dựng `/login` hay logic auth thật — các tính năng cần "nhớ người dùng" đều dùng cookie ẩn danh, không phải session đăng nhập.
- Không thay `/admin/requests`, `/admin/profiles` bằng data fetching thật trừ khi task yêu cầu cụ thể — hai trang này vẫn cố ý dùng mock.
- Không tạo policy SELECT/INSERT/UPDATE công khai cho `conversations`, `chat_messages`, `leads`, `student_profiles` — đây là dữ liệu riêng tư, phải giữ nguyên tắc "RLS bật, không policy, chỉ server bằng secret key truy cập".
- Không dùng `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (key cũ) — dùng `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY` (xem skill `supabase-server`).
