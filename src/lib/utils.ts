import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatCompactCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

export function formatPreciseCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: Math.abs(value || 0) < 1 ? 4 : 2,
    maximumFractionDigits: Math.abs(value || 0) < 1 ? 4 : 2,
  }).format(value || 0);
}

export function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value || 0).toFixed(1)}%`;
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value || 0);
}

export function dateInputValue(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function formatDisplayDate(value: string | Date | null | undefined) {
  if (!value) {
    return "Not set";
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function titleFromSnake(value: string) {
  const title = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return title.replace(/\b(Roi|Hoa|Usd|Id|Url)\b/g, (match) => match.toUpperCase());
}
