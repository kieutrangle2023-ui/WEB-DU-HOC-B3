import "server-only";
import { createAdminClient } from "@supabase/server/core";
import type { Database } from "@/lib/database.types";

// Dữ liệu học bổng là công khai (bảng scholarships có policy SELECT cho mọi
// người), đọc qua server ở đây cho nhất quán với các module khác trong lib/.
const supabaseAdmin = createAdminClient<Database>();

export interface Scholarship {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
  minGpa: number | null;
  minIelts: number | null;
  supportPercent: number;
  supportLabel: string;
}

export async function listScholarships(): Promise<Scholarship[]> {
  const { data, error } = await supabaseAdmin
    .from("scholarships")
    .select("id, name, min_gpa, min_ielts, support_percent, support_label, school_id, schools(name)")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    schoolId: s.school_id,
    schoolName: s.schools?.name ?? "",
    minGpa: s.min_gpa,
    minIelts: s.min_ielts,
    supportPercent: s.support_percent,
    supportLabel: s.support_label,
  }));
}
