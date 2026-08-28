import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentProfile } from "@/lib/student-profile-store";

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-base font-medium">
        {value ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export function ExtractedInfo({ profile }: { profile: StudentProfile }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin đã trích xuất</CardTitle>
        <p className="text-sm text-muted-foreground">
          Đây là thông tin đọc được từ giấy tờ bạn đã nộp, kiểm tra lại xem có đúng không nhé.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="mb-3 text-sm font-medium text-muted-foreground">Bảng điểm</h4>
          {profile.transcript.data ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field label="Họ tên" value={profile.transcript.data.fullName} />
              <Field label="Ngày sinh" value={profile.transcript.data.dateOfBirth} />
              <Field label="Điểm học tập" value={profile.transcript.data.gpa} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa nộp bảng điểm.</p>
          )}
        </div>

        <div>
          <h4 className="mb-3 text-sm font-medium text-muted-foreground">Chứng chỉ IELTS</h4>
          {profile.ielts.data ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field label="Họ tên" value={profile.ielts.data.fullName} />
              <Field label="Nghe" value={profile.ielts.data.listening} />
              <Field label="Đọc" value={profile.ielts.data.reading} />
              <Field label="Viết" value={profile.ielts.data.writing} />
              <Field label="Nói" value={profile.ielts.data.speaking} />
              <Field label="Điểm tổng" value={profile.ielts.data.overall} />
              <Field label="Ngày thi" value={profile.ielts.data.examDate} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa nộp chứng chỉ IELTS.</p>
          )}
        </div>

        <div>
          <h4 className="mb-3 text-sm font-medium text-muted-foreground">CMND/CCCD/Hộ chiếu</h4>
          {profile.identity.data ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field label="Họ tên" value={profile.identity.data.fullName} />
              <Field label="Ngày sinh" value={profile.identity.data.dateOfBirth} />
              <Field label="Số giấy tờ" value={profile.identity.data.documentNumber} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa nộp giấy tờ tuỳ thân.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
