import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { PortalDocuments } from "@/components/portal/portal-documents";
import { emptyProfile, getStudentProfile } from "@/lib/student-profile-store";
import { listSchools } from "@/lib/schools-store";

// Hồ sơ + trạng thái giấy tờ đổi liên tục theo lần nộp — luôn lấy mới,
// không cache tĩnh lúc build.
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const cookieStore = await cookies();
  const profileId = cookieStore.get("duhoc24_student_id")?.value ?? null;

  const [profile, schools] = await Promise.all([getStudentProfile(profileId), listSchools()]);
  const currentProfile = profile ?? emptyProfile("");

  const displayName =
    currentProfile.identity.data?.fullName ?? currentProfile.transcript.data?.fullName ?? "bạn";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-sm text-muted-foreground">Xin chào,</p>
            <h1 className="text-2xl font-medium tracking-tight">{displayName}</h1>
          </div>
          <Button variant="outline">
            <LogOut className="size-4" />
            Đăng xuất
          </Button>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-medium">Giấy tờ cần nộp</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nộp đủ 3 loại giấy tờ dưới đây, hệ thống sẽ tự trích xuất thông tin và đối chiếu điểm chuẩn giúp bạn.
          </p>

          <div className="mt-6">
            <PortalDocuments initialProfile={currentProfile} schools={schools} />
          </div>
        </section>
      </main>
    </>
  );
}
