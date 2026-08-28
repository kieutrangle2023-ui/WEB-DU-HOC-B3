import { cookies } from "next/headers";
import { getStudentProfile } from "@/lib/student-profile-store";
import { listSchools } from "@/lib/schools-store";
import { computeSchoolMatches } from "@/lib/school-eligibility";
import { suggestScholarships } from "@/lib/scholarship-suggestions";

export async function GET() {
  const cookieStore = await cookies();
  const profileId = cookieStore.get("duhoc24_student_id")?.value ?? null;
  const profile = await getStudentProfile(profileId);

  const isComplete =
    profile?.transcript.status === "hop_le" &&
    profile?.ielts.status === "hop_le" &&
    profile?.identity.status === "hop_le";

  const gpa = profile?.transcript.data?.gpa ?? null;
  const ielts = profile?.ielts.data?.overall ?? null;

  if (!isComplete || gpa == null || ielts == null) {
    return Response.json(
      { error: "Hồ sơ chưa nộp đầy đủ và hợp lệ, chưa thể gợi ý học bổng." },
      { status: 400 },
    );
  }

  const schools = await listSchools();
  const qualifyingSchools = computeSchoolMatches(schools, gpa, ielts)
    .filter((m) => m.passed)
    .map((m) => m.school.name);

  if (qualifyingSchools.length === 0) {
    return Response.json({ suggestions: [] });
  }

  try {
    const suggestions = await suggestScholarships({ gpa, ielts }, qualifyingSchools);
    return Response.json({ suggestions });
  } catch (err) {
    console.error("Scholarship suggestion failed", err);
    return Response.json({ error: "Tìm học bổng thất bại, bạn thử lại giúp mình nhé." }, { status: 500 });
  }
}
