"use client";

import React from "react";
import { FileText, IdCard, Loader2, Medal, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DocStatusBadge } from "@/components/status-badge";
import { ExtractedInfo } from "@/components/portal/extracted-info";
import { SchoolMatch } from "@/components/portal/school-match";
import type { DocType, StudentProfile } from "@/lib/student-profile-store";
import type { ReferenceSchool } from "@/lib/schools-store";

const SLOTS: {
  docType: DocType;
  icon: LucideIcon;
  title: string;
  accept: string;
  inputAccept: string;
}[] = [
  {
    docType: "transcript",
    icon: FileText,
    title: "Bảng điểm (PDF)",
    accept: "Chấp nhận PDF",
    inputAccept: "application/pdf",
  },
  {
    docType: "ielts",
    icon: Medal,
    title: "Ảnh chứng chỉ IELTS",
    accept: "Chấp nhận JPG, PNG, WebP",
    inputAccept: "image/jpeg,image/png,image/webp",
  },
  {
    docType: "identity",
    icon: IdCard,
    title: "Ảnh CMND/CCCD hoặc hộ chiếu",
    accept: "Chấp nhận JPG, PNG, WebP",
    inputAccept: "image/jpeg,image/png,image/webp",
  },
];

export function PortalDocuments({
  initialProfile,
  schools,
}: {
  initialProfile: StudentProfile;
  schools: ReferenceSchool[];
}) {
  const [profile, setProfile] = React.useState(initialProfile);
  const [uploading, setUploading] = React.useState<Record<DocType, boolean>>({
    transcript: false,
    ielts: false,
    identity: false,
  });
  const [errors, setErrors] = React.useState<Partial<Record<DocType, string>>>({});

  async function handleFile(docType: DocType, file: File) {
    setUploading((u) => ({ ...u, [docType]: true }));
    setErrors((e) => ({ ...e, [docType]: undefined }));

    try {
      const formData = new FormData();
      formData.append("docType", docType);
      formData.append("file", file);
      const res = await fetch("/api/portal/documents", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setErrors((e) => ({ ...e, [docType]: data.error ?? "Có lỗi xảy ra." }));
        return;
      }

      setProfile((p) => ({
        ...p,
        [docType]: { status: data.status, fileName: data.fileName, reason: data.reason, data: data.data },
      }));
    } catch {
      setErrors((e) => ({ ...e, [docType]: "Có lỗi xảy ra, bạn thử lại giúp mình nhé." }));
    } finally {
      setUploading((u) => ({ ...u, [docType]: false }));
    }
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-3">
        {SLOTS.map((slot) => {
          const info = profile[slot.docType];
          const isUploading = uploading[slot.docType];
          const error = errors[slot.docType];

          return (
            <div key={slot.docType}>
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept={slot.inputAccept}
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(slot.docType, file);
                    e.target.value = "";
                  }}
                />
                <Card className="flex aspect-video flex-col items-center justify-center gap-2 border-none bg-foreground/5 p-6 shadow-none ring-0 duration-150 hover:bg-foreground/10">
                  {isUploading ? (
                    <Loader2 className="size-7 animate-spin text-muted-foreground" />
                  ) : (
                    <slot.icon className="size-7 text-muted-foreground" />
                  )}
                  <span className="max-w-full truncate px-4 text-xs text-muted-foreground">
                    {isUploading ? "Đang xử lý..." : (info.fileName ?? "Bấm để chọn file")}
                  </span>
                </Card>
              </label>

              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{slot.title}</h3>
                  <DocStatusBadge status={info.status} />
                </div>
                <p className="mt-3 text-balance text-muted-foreground">
                  {error ? (
                    <span className="text-red-600">{error}</span>
                  ) : info.status === "can_nop_lai" && info.reason ? (
                    <>
                      Cần nộp lại: <span className="text-red-600">{info.reason}</span>
                    </>
                  ) : (
                    slot.accept
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-12 space-y-6">
        <ExtractedInfo profile={profile} />
        <SchoolMatch schools={schools} profile={profile} />
      </section>
    </>
  );
}
