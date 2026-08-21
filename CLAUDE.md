# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Tổng quan dự án

DuHoc24 — website mẫu "Cổng Tiếp Nhận Hồ Sơ Du Học", dùng cho khoá lập trình 6 tuần. Đây là bản **Tuần 1**: chỉ dựng UI, toàn bộ dữ liệu là mock data viết cứng trong [lib/mock-data.ts](lib/mock-data.ts). Chưa có API hay database thật (xem lộ trình Tuần 2-6 trong [README.md](README.md)).

## Lệnh thường dùng

```bash
npm run dev      # chạy dev server tại http://localhost:3000
npm run build    # build production
npm run lint     # chạy ESLint (eslint.config.mjs, flat config)
```

Không có tsc script riêng — kiểm tra type qua `npm run build` hoặc IDE (dùng `strict: true`). Chưa có test runner nào được cấu hình.

## Kiến trúc

**Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4.** Toàn bộ trang là Server Component tĩnh render trực tiếp từ mock data — không có `"use client"` fetch, không có route handler API trong `app/`.

### Nguồn dữ liệu duy nhất: `lib/mock-data.ts`

Mọi trang (landing, portal, admin) import trực tiếp từ file này. Các type chính:
- `School`, `ServiceOption`, `AdmissionRequest`, `StudentProfile`, `Conversation` — dữ liệu tương ứng các bảng sẽ có ở Supabase (Tuần 3+): `schools`, `requests`, `student_profiles`, `conversations`.
- Các trạng thái dùng union string tiếng Việt không dấu làm enum: `DocStatus` (`chua_nop | dang_xu_ly | hop_le | can_nop_lai`), `RequestStatus` (`cho_duyet | da_duyet | tu_choi`), `ServicePackage` (`co_ban | toan_dien`). Khi thêm trạng thái mới, cập nhật đồng thời type trong `mock-data.ts` và bảng mapping label/tone trong `status-badge.tsx`.
- `currentStudent` là hồ sơ demo cho `/portal` (đóng vai người dùng đã đăng nhập — hiện chưa có auth thật).

### Sơ đồ route (`app/`)

| Route | Vai trò |
|---|---|
| `/` | Landing page (hero, form báo giá, chatbot QnA tĩnh) |
| `/portal` | Cổng học viên — upload giấy tờ, đối chiếu điểm chuẩn |
| `/admin/*` | Layout riêng ([app/admin/layout.tsx](app/admin/layout.tsx)) với sidebar cố định; `/admin` redirect sang `/admin/requests` |

`/login` chưa tồn tại — sẽ dựng ở Tuần 6 kèm Supabase Auth (magic link). Đừng tự thêm auth/middleware trừ khi được yêu cầu.

### Component

- `components/ui/` — component nền shadcn/ui (style `base-nova`, base là [Base UI](https://base-ui.com), không phải Radix). Xem alias trong [components.json](components.json): `@/components`, `@/lib`, `@/components/ui`. Thêm component shadcn mới qua CLI `shadcn`, không tự chép tay trừ khi cần chỉnh sâu.
- `components/landing/`, `components/portal/`, `components/admin/` — component theo từng khu vực, phần lớn nhận props kiểu từ `lib/mock-data.ts` và render qua `status-badge.tsx` / `components/ui/*`.
- `status-badge.tsx` ([components/status-badge.tsx](components/status-badge.tsx)) là nơi tập trung mapping trạng thái → label tiếng Việt + màu (tone) + icon cho cả `DocStatus` và `RequestStatus`. Đây là điểm chạm bắt buộc mỗi khi UI cần hiển thị trạng thái mới.

### Ngôn ngữ & nội dung

Toàn bộ UI, comment trong mock data, và `lang="vi"` ở [app/layout.tsx](app/layout.tsx) đều bằng tiếng Việt. Giữ nguyên văn phong này khi thêm text mới — không chuyển sang tiếng Anh trừ khi được yêu cầu. Font chữ dùng `Be Vietnam Pro` (subset `vietnamese`).

### Việc KHÔNG nên làm ở bản này (trừ khi được yêu cầu rõ)

- Không tự nối Supabase, Gemini API, hay bất kỳ backend thật nào — đó là phạm vi Tuần 2-6, biến môi trường tương ứng liệt kê sẵn trong [.env.example](.env.example) nhưng chưa dùng.
- Không tự dựng `/login` hay logic auth.
- Không thay mock data bằng data fetching thật trừ khi task yêu cầu cụ thể — mock data trong `lib/mock-data.ts` là nguồn thật duy nhất ở giai đoạn này.
