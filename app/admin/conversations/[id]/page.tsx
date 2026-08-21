import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, formatDateTime } from "@/lib/utils";
import { getConversationDetail } from "@/lib/chat-store";

export default async function AdminConversationDetailPage({
  params,
}: PageProps<"/admin/conversations/[id]">) {
  const { id } = await params;
  const conversation = await getConversationDetail(id);

  if (!conversation) {
    notFound();
  }

  return (
    <>
      <AdminPageHeader
        title={`Hội thoại kênh ${conversation.channel}`}
        description={`Bắt đầu lúc ${formatDateTime(conversation.startedAt)} · ${conversation.messages.length} tin nhắn`}
        action={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link href="/admin/conversations">
                <ArrowLeft data-icon="inline-start" />
                Quay lại danh sách
              </Link>
            }
          />
        }
      />

      <Card className="p-4 sm:p-6">
        {conversation.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Cuộc hội thoại này chưa có tin nhắn nào.
          </p>
        ) : (
          <div className="space-y-4">
            {conversation.messages.map((m, i) => (
              <div key={i} className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[75%]", m.sender === "user" ? "text-right" : "text-left")}>
                  <p
                    className={cn(
                      "inline-block rounded-2xl px-4 py-2.5 text-sm",
                      m.sender === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground",
                    )}
                  >
                    {m.content}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.sender === "user" ? "Khách" : "Chatbot"} · {formatDateTime(m.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
