"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExtractLeadButton({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/conversations/${conversationId}/lead`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
      {loading ? "Đang trích xuất..." : "Trích xuất lại"}
    </Button>
  );
}
