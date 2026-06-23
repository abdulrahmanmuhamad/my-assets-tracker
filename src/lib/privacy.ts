export type SensitiveKind = "currency" | "percent" | "number" | "shares";

export function maskForKind(kind: SensitiveKind) {
  if (kind === "currency") return "$••••••";
  if (kind === "percent") return "••••%";
  if (kind === "shares") return "•••• shares";
  return "••••";
}

export function resolveSensitiveHidden(globalHidden: boolean, localHidden: boolean | null) {
  return localHidden ?? globalHidden;
}
