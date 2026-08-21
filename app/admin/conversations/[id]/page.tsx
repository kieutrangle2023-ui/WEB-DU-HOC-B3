import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ExtractLeadButton } from "@/components/admin/extract-lead-button";
import { cn, formatDateTime } from "@/lib/utils";
import { getConversationDetail } from "@/lib/chat-store";
import { getLead, extractLead, type Lead } from "@/lib/lead-extraction";

// Trang admin, dữ liệu (hội thoại + lead) thay đổi liên tục — luôn lấy mới,
// không cache tĩnh lúc build.
export const dynamic = "force-dynamic";

const qualityMeta: Record<Lead["quality"], { label: string; tone: "green" | "yellow" | "red" }> = {
  good: { label: "Lead tốt", tone: "green" },
  ok: { label: "Bình thường", tone: "yellow" },
  spam: { label: "Spam", tone: "red" },
};

function LeadField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export default async function AdminConversationDetailPage({
  params,
}: PageProps<"/admin/conversations/[id]">) {
  const { id } = await params;
  const conversation = await getConversationDetail(id);

  if (!conversation) {
    notFound();
  }

  let lead = await getLead(id);
  if (!lead && conversation.messages.length > 0) {
    lead = await extractLead(id);
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

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Thông tin lead (AI trích xuất)</h2>
            <ExtractLeadButton conversationId={id} />
          </div>

          {!lead ? (
            <p className="text-sm text-muted-foreground">
              Chưa có dữ liệu — bấm &quot;Trích xuất lại&quot; để phân tích hội thoại này.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={qualityMeta[lead.quality].tone} label={qualityMeta[lead.quality].label} />
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    lead.bookedConsultation ? "text-green-700" : "text-muted-foreground",
                  )}
                >
                  {lead.bookedConsultation ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <XCircle className="size-3.5" />
                  )}
                  Đã đặt lịch tư vấn
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
                <LeadField label="Họ tên" value={lead.name} />
                <LeadField label="Email" value={lead.email} />
                <LeadField label="Số điện thoại" value={lead.phone} />
                <LeadField label="Nước du học" value={lead.country} />
                <LeadField label="Bậc học" value={lead.educationLevel} />
                <LeadField label="Ngành học" value={lead.major} />
                <div className="col-span-2">
                  <LeadField label="Thời gian rảnh" value={lead.availability} />
                </div>
                <div className="col-span-2">
                  <LeadField label="Ghi chú" value={lead.notes} />
                </div>
              </dl>

              <p className="text-xs text-muted-foreground">
                Trích xuất lúc {formatDateTime(lead.extractedAt)}
              </p>
            </div>
          )}
        </Card>

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
      </div>
    </>
  );
}
