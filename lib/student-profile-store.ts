import "server-only";
import { createAdminClient } from "@supabase/server/core";
import type { Database, Tables } from "@/lib/database.types";
import type { DocStatus } from "@/lib/mock-data";

const supabaseAdmin = createAdminClient<Database>();

export type DocType = "transcript" | "ielts" | "identity";

export interface TranscriptData {
  fullName: string | null;
  dateOfBirth: string | null;
  gpa: number | null;
}

export interface IeltsData {
  fullName: string | null;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
  examDate: string | null;
}

export interface IdentityData {
  fullName: string | null;
  dateOfBirth: string | null;
  documentNumber: string | null;
}

export interface DocumentSlot<T> {
  status: DocStatus;
  fileName: string | null;
  reason: string | null;
  data: T | null;
}

export interface StudentProfile {
  id: string;
  transcript: DocumentSlot<TranscriptData>;
  ielts: DocumentSlot<IeltsData>;
  identity: DocumentSlot<IdentityData>;
}

const EMPTY_PROFILE: Omit<StudentProfile, "id"> = {
  transcript: { status: "chua_nop", fileName: null, reason: null, data: null },
  ielts: { status: "chua_nop", fileName: null, reason: null, data: null },
  identity: { status: "chua_nop", fileName: null, reason: null, data: null },
};

function rowToProfile(row: Tables<"student_profiles">): StudentProfile {
  return {
    id: row.id,
    transcript: {
      status: row.transcript_status as DocStatus,
      fileName: row.transcript_file_name,
      reason: row.transcript_reason,
      data:
        row.transcript_status === "chua_nop"
          ? null
          : {
              fullName: row.transcript_full_name,
              dateOfBirth: row.transcript_date_of_birth,
              gpa: row.transcript_gpa,
            },
    },
    ielts: {
      status: row.ielts_status as DocStatus,
      fileName: row.ielts_file_name,
      reason: row.ielts_reason,
      data:
        row.ielts_status === "chua_nop"
          ? null
          : {
              fullName: row.ielts_full_name,
              listening: row.ielts_listening,
              reading: row.ielts_reading,
              writing: row.ielts_writing,
              speaking: row.ielts_speaking,
              overall: row.ielts_overall,
              examDate: row.ielts_exam_date,
            },
    },
    identity: {
      status: row.identity_status as DocStatus,
      fileName: row.identity_file_name,
      reason: row.identity_reason,
      data:
        row.identity_status === "chua_nop"
          ? null
          : {
              fullName: row.identity_full_name,
              dateOfBirth: row.identity_date_of_birth,
              documentNumber: row.identity_document_number,
            },
    },
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getStudentProfile(profileId: string | null): Promise<StudentProfile | null> {
  if (!profileId || !UUID_RE.test(profileId)) return null;
  const { data, error } = await supabaseAdmin
    .from("student_profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToProfile(data) : null;
}

export async function getOrCreateStudentProfile(profileId: string | null): Promise<string> {
  if (profileId && UUID_RE.test(profileId)) {
    const { data } = await supabaseAdmin
      .from("student_profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();
    if (data) return data.id;
  }

  const { data, error } = await supabaseAdmin
    .from("student_profiles")
    .insert({})
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Không tạo được hồ sơ học viên mới");
  return data.id;
}

export async function saveTranscript(
  profileId: string,
  fileName: string,
  result: { status: DocStatus; reason: string | null; data: TranscriptData },
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("student_profiles")
    .update({
      transcript_status: result.status,
      transcript_file_name: fileName,
      transcript_reason: result.reason,
      transcript_full_name: result.data.fullName,
      transcript_date_of_birth: result.data.dateOfBirth,
      transcript_gpa: result.data.gpa,
    })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}

export async function saveIelts(
  profileId: string,
  fileName: string,
  result: { status: DocStatus; reason: string | null; data: IeltsData },
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("student_profiles")
    .update({
      ielts_status: result.status,
      ielts_file_name: fileName,
      ielts_reason: result.reason,
      ielts_full_name: result.data.fullName,
      ielts_listening: result.data.listening,
      ielts_reading: result.data.reading,
      ielts_writing: result.data.writing,
      ielts_speaking: result.data.speaking,
      ielts_overall: result.data.overall,
      ielts_exam_date: result.data.examDate,
    })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}

export async function saveIdentity(
  profileId: string,
  fileName: string,
  result: { status: DocStatus; reason: string | null; data: IdentityData },
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("student_profiles")
    .update({
      identity_status: result.status,
      identity_file_name: fileName,
      identity_reason: result.reason,
      identity_full_name: result.data.fullName,
      identity_date_of_birth: result.data.dateOfBirth,
      identity_document_number: result.data.documentNumber,
    })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}

export function emptyProfile(id: string): StudentProfile {
  return { id, ...EMPTY_PROFILE };
}
