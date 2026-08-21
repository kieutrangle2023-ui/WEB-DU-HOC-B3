import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listConversations } from "@/lib/chat-store";
import { formatDateTime } from "@/lib/utils";

// Danh sách hội thoại thay đổi liên tục theo khách truy cập — luôn lấy dữ
// liệu mới nhất từ Supabase mỗi lần tải trang, không cache tĩnh lúc build.
export const dynamic = "force-dynamic";

export default async function AdminConversationsPage() {
  const conversations = await listConversations();

  return (
    <>
      <AdminPageHeader
        title="Hội thoại"
        description="Lịch sử hội thoại thật của khách với chatbot hỏi đáp trên trang chủ, lưu trong Supabase."
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kênh</TableHead>
              <TableHead>Số tin nhắn</TableHead>
              <TableHead>Thời gian bắt đầu</TableHead>
              <TableHead>Tin nhắn gần nhất</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Chưa có cuộc hội thoại nào.
                </TableCell>
              </TableRow>
            ) : (
              conversations.map((conv) => (
                <TableRow key={conv.id}>
                  <TableCell className="font-medium">{conv.channel}</TableCell>
                  <TableCell>{conv.messageCount} tin nhắn</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(conv.startedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(conv.lastMessageAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/admin/conversations/${conv.id}`}>Xem hội thoại</Link>}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
