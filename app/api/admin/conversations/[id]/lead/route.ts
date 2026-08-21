import { extractLead } from "@/lib/lead-extraction";

// Route nội bộ cho admin dashboard — chưa có hệ thống đăng nhập/phân quyền
// (Tuần 6 mới có), nên tạm thời chỉ dùng để admin bấm nút "Trích xuất lại"
// trên trang /admin/conversations/[id]. Không lộ ra UI công khai nào.
export async function POST(_request: Request, { params }: RouteContext<"/api/admin/conversations/[id]/lead">) {
  const { id } = await params;

  try {
    const lead = await extractLead(id);
    if (!lead) {
      return Response.json({ error: "Cuộc hội thoại chưa có tin nhắn nào." }, { status: 404 });
    }
    return Response.json({ lead });
  } catch (err) {
    console.error("Lead extraction failed", err);
    return Response.json({ error: "Trích xuất lead thất bại." }, { status: 500 });
  }
}
