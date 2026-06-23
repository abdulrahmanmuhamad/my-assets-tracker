"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PriceRefreshButton() {
  const [pending, setPending] = useState(false);

  async function refresh() {
    setPending(true);
    try {
      await fetch("/api/prices/refresh", { method: "POST" });
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={refresh}
      disabled={pending}
      icon={<RefreshCcw className={cn("h-4 w-4", pending && "animate-spin")} />}
    >
      Refresh Prices
    </Button>
  );
}

