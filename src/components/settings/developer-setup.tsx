import { CheckCircle2, CircleAlert } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type DeveloperReadiness = Record<"clerk" | "ownerEmails" | "clerkWebhook" | "plaid" | "tokenEncryption" | "resend" | "alerts", boolean>;

const labels: Record<keyof DeveloperReadiness, string> = {
  clerk: "Clerk authentication keys",
  ownerEmails: "Owner bootstrap emails",
  clerkWebhook: "Clerk webhook signing secret",
  plaid: "Plaid provider credentials",
  tokenEncryption: "Provider token encryption key",
  resend: "Resend email provider",
  alerts: "Alert evaluation secret",
};

export function DeveloperSetup({ readiness }: { readiness: DeveloperReadiness }) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader><h2 className="text-base font-semibold text-slate-950">Developer / API Setup</h2><p className="mt-1 text-sm text-slate-500">Configuration status only. Secret values are never returned to this page.</p></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {Object.entries(labels).map(([key, label]) => {
          const ready = readiness[key as keyof DeveloperReadiness];
          return <div key={key} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700">{ready ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-600" />}<span>{label}</span><span className="ml-auto text-xs text-slate-500">{ready ? "Configured" : "Required / optional"}</span></div>;
        })}
        <p className="md:col-span-2 text-xs leading-5 text-slate-500">See <code>docs/THIRD_PARTY_KEYS_SETUP.md</code> for exact local and production setup. Secrets belong in environment variables or a deployment secret manager.</p>
      </CardContent>
    </Card>
  );
}
