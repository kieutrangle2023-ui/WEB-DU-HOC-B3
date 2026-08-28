import "server-only";
import { createAdminClient } from "@supabase/server/core";
import type { Database } from "@/lib/database.types";

// Dữ liệu trường tham chiếu là công khai (bảng schools có policy SELECT cho
// mọi người), nhưng vẫn đọc qua server ở đây cho nhất quán với các module
// khác trong lib/ — trang admin là Server Component nên không cần lộ key ra
// trình duyệt.
const supabaseAdmin = createAdminClient<Database>();

export interface ReferenceSchool {
  id: string;
  name: string;
  country: string;
  minGpa: number;
  minIelts: number;
}

export async function listSchools(): Promise<ReferenceSchool[]> {
  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("id, name, country, min_gpa, min_ielts")
    .order("country", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    country: s.country,
    minGpa: s.min_gpa,
    minIelts: s.min_ielts,
  }));
}
