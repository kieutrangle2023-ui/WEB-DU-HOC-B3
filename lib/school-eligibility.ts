// Hàm thuần (không phụ thuộc server/Supabase) so sánh điểm học viên với điểm
// chuẩn từng trường — dùng chung cho cả UI hiển thị (school-match.tsx, chạy
// ở client) và route gợi ý học bổng bằng AI (chạy ở server), để đảm bảo danh
// sách "trường đạt yêu cầu" luôn nhất quán ở mọi nơi. Đây là phép so sánh số
// học thuần, không qua AI.
import type { ReferenceSchool } from "@/lib/schools-store";

export interface SchoolMatchResult {
  school: ReferenceSchool;
  passed: boolean;
}

export function computeSchoolMatches(
  schools: ReferenceSchool[],
  gpa: number,
  ielts: number,
): SchoolMatchResult[] {
  return schools.map((school) => ({
    school,
    passed: gpa >= school.minGpa && ielts >= school.minIelts,
  }));
}
