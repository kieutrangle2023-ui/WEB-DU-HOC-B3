"use client";

import React from "react";
import { Check, Sparkles, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReferenceSchool } from "@/lib/schools-store";
import type { StudentProfile } from "@/lib/student-profile-store";
import { computeSchoolMatches } from "@/lib/school-eligibility";

interface ScholarshipSuggestion {
  scholarshipName: string;
  schoolName: string;
  supportLabel: string;
  reason: string;
}

export function SchoolMatch({ schools, profile }: { schools: ReferenceSchool[]; profile: StudentProfile }) {
  // Chỉ đối chiếu khi cả 3 giấy tờ đã nộp và hợp lệ — không chỉ cần có số
  // điểm. Phép so sánh dưới đây là so sánh số học thuần (>=), không hỏi lại
  // AI, để kết quả luôn chính xác và kiểm tra lại được.
  const isProfileComplete =
    profile.transcript.status === "hop_le" &&
    profile.ielts.status === "hop_le" &&
    profile.identity.status === "hop_le";

  const gpa = profile.transcript.data?.gpa ?? null;
  const ielts = profile.ielts.data?.overall ?? null;
  const canCompare = isProfileComplete && gpa != null && ielts != null;
  const matches = canCompare ? computeSchoolMatches(schools, gpa, ielts) : [];
  const hasQualifyingSchool = matches.some((m) => m.passed);

  const [suggestions, setSuggestions] = React.useState<ScholarshipSuggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);
  const [suggestionError, setSuggestionError] = React.useState<string | null>(null);

  async function fetchSuggestions() {
    setLoadingSuggestions(true);
    setSuggestionError(null);
    try {
      const res = await fetch("/api/portal/scholarship-suggestions");
      const data = await res.json();
      if (!res.ok) {
        setSuggestionError(data.error ?? "Có lỗi xảy ra.");
        return;
      }
      setSuggestions(data.suggestions);
    } catch {
      setSuggestionError("Có lỗi xảy ra, bạn thử lại giúp mình nhé.");
    } finally {
      setLoadingSuggestions(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đối chiếu điểm chuẩn</CardTitle>
        <p className="text-sm text-muted-foreground">
          So sánh điểm học tập và IELTS của bạn với điểm chuẩn từng trường.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!canCompare ? (
          <p className="text-sm text-muted-foreground">
            Nộp đầy đủ và hợp lệ cả 3 loại giấy tờ (bảng điểm, IELTS, CMND/CCCD/hộ chiếu) để xem đối chiếu điểm chuẩn.
          </p>
        ) : (
          matches.map(({ school, passed }) => (
            <div
              key={school.id}
              className={cn(
                "flex items-center justify-between gap-4 rounded-xl border p-4",
                passed ? "border-green-200 bg-green-50" : "border-border bg-muted/30",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    passed ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500",
                  )}
                >
                  {passed ? <Check className="size-4" /> : <X className="size-4" />}
                </span>
                <div>
                  <p className="font-medium">{school.name}</p>
                  <p className="text-sm text-muted-foreground">{school.country}</p>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Yêu cầu GPA ≥ {school.minGpa.toFixed(1)}</p>
                <p>IELTS ≥ {school.minIelts.toFixed(1)}</p>
              </div>
            </div>
          ))
        )}

        {canCompare && hasQualifyingSchool && (
          <div className="mt-2 border-t pt-4">
            {suggestions === null ? (
              <Button variant="outline" onClick={fetchSuggestions} disabled={loadingSuggestions}>
                <Sparkles className="size-4" />
                {loadingSuggestions ? "AI đang tra cứu học bổng..." : "Tìm học bổng phù hợp (AI)"}
              </Button>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Không tìm thấy học bổng nào bạn đủ điều kiện ở các trường trên.
              </p>
            ) : (
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Học bổng gợi ý</h4>
                {suggestions.map((s, i) => (
                  <div key={i} className="rounded-xl border bg-muted/20 p-4">
                    <p className="font-medium">
                      {s.scholarshipName} <span className="text-muted-foreground">— {s.schoolName}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">Mức hỗ trợ: {s.supportLabel}</p>
                    <p className="mt-1 text-sm">{s.reason}</p>
                  </div>
                ))}
              </div>
            )}
            {suggestionError && <p className="mt-2 text-sm text-red-600">{suggestionError}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
