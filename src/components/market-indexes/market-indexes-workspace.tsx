"use client";

import { useState } from "react";
import { BellPlus, RefreshCcw, TrendingDown, TrendingUp } from "lucide-react";
import { AlertRuleForm } from "@/components/alerts/alert-rule-form";
import type { AlertTarget } from "@/lib/alerts/client-types";
import type { MarketIndexQuote } from "@/lib/market-data/index-prices";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/patterns";
import { cn, formatDisplayDate } from "@/lib/utils";
import { SensitiveCurrency, SensitiveNumber, SensitivePercent } from "@/components/privacy/sensitive-value";

export function MarketIndexesWorkspace({ initialQuotes }: { initialQuotes: MarketIndexQuote[] }) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [pending, setPending] = useState(false);
  const [target, setTarget] = useState<AlertTarget | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/market-indexes/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Index refresh failed");
      setQuotes(data);
      setMessage("Market indexes refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Index refresh failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Market watchlist" title="Market Indexes" subtitle="Track major US indexes without adding them to owned portfolio value." actions={<><LinkButton href="/alerts" icon={<BellPlus className="h-4 w-4" />}>View Alerts</LinkButton><Button onClick={refresh} disabled={pending} icon={<RefreshCcw className={cn("h-4 w-4", pending && "animate-spin")} />}>Refresh</Button></>} />
      {message ? <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quotes.map((quote) => {
          const positive = quote.changeAmount >= 0;
          return (
            <Card key={quote.symbol}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div><h2 className="text-base font-semibold text-slate-950">{quote.name}</h2><div className="mt-1 text-sm text-slate-500">{quote.symbol}</div></div>
                <Badge tone={positive ? "positive" : "negative"}>{positive ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}<SensitivePercent value={quote.changePercent} label="daily index change" /></Badge>
              </CardHeader>
              <CardContent>
                <SensitiveNumber value={quote.price} className="font-mono text-3xl font-semibold text-slate-950" label="market index value" />
                <div className={positive ? "mt-2 text-sm font-semibold text-emerald-700" : "mt-2 text-sm font-semibold text-rose-700"}><SensitiveCurrency value={quote.changeAmount} label="daily index change amount" /> today</div>
                <div className="mt-4 text-xs text-slate-400">Updated {formatDisplayDate(quote.fetchedAt)} · {quote.source}</div>
                <Button className="mt-5 w-full" variant="secondary" icon={<BellPlus className="h-4 w-4" />} onClick={() => setTarget({ assetCategory: "market_index", symbol: quote.symbol, label: quote.name, baselineValue: quote.price, baselineRoi: quote.changePercent })}>Add Alert</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!quotes.length ? <Card><CardContent className="text-sm text-slate-500">Market index data is unavailable. Use Refresh after confirming network access.</CardContent></Card> : null}
      <AlertRuleForm open={Boolean(target)} target={target} onClose={() => setTarget(null)} onSaved={() => setMessage("Index alert created.")} />
    </div>
  );
}
