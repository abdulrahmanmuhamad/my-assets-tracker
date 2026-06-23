"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Building2,
  BellPlus,
  BellRing,
  Copy,
  Eye,
  FileUp,
  Gem,
  GripVertical,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type { FileRecord, JewelryRecord, MineralRecord, RealEstateRecord } from "@/lib/data";
import { AlertRuleForm } from "@/components/alerts/alert-rule-form";
import type { AlertRuleRecord, AlertTarget } from "@/lib/alerts/client-types";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { MetricCard } from "@/components/ui/card";
import { EmptyState, PageHeader, RoiBadge } from "@/components/ui/patterns";
import { SensitiveCurrency, SensitiveNumber, SensitiveValue } from "@/components/privacy/sensitive-value";
import {
  JEWELRY_TYPES,
  JEWELRY_UNITS,
  MINERAL_TYPES,
  METAL_SYMBOL_BY_NAME,
  REAL_ESTATE_TYPES,
  WEIGHT_UNITS,
} from "@/lib/constants";
import {
  cn,
  formatCurrency,
  formatDisplayDate,
  formatNumber,
  formatPercent,
  titleFromSnake,
} from "@/lib/utils";

type Mode = "minerals" | "real-estate" | "jewelry";
type ManagedAsset = (MineralRecord | RealEstateRecord | JewelryRecord) & Record<string, unknown>;
type FormValues = Record<string, unknown>;

type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "checkbox";
  options?: readonly string[];
  step?: string;
  visible?: (values: FormValues) => boolean;
  span?: "full";
};

const endpoints: Record<Mode, string> = {
  minerals: "/api/minerals",
  "real-estate": "/api/real-estate",
  jewelry: "/api/jewelry",
};

const reorderEndpoints: Record<Mode, string> = {
  minerals: "/api/minerals/reorder",
  "real-estate": "/api/real-estate/reorder",
  jewelry: "/api/jewelry/reorder",
};

const singularAssetType: Record<Mode, string> = {
  minerals: "mineral",
  "real-estate": "real-estate",
  jewelry: "jewelry",
};

const alertCategoryByMode = {
  minerals: "mineral",
  "real-estate": "real_estate",
  jewelry: "jewelry",
} as const;

function alertTargetFor(mode: Mode, row: ManagedAsset): AlertTarget {
  const type = typeFor(mode, row);
  const baselineValue =
    mode === "minerals"
      ? numeric(row.currentPricePerGram)
      : mode === "jewelry"
        ? numeric(row.effectivePricePerGram || row.pricePerGram || row.currentValue)
        : numeric(row.currentValue);
  return {
    assetCategory: alertCategoryByMode[mode],
    assetId: row.id,
    symbol: mode === "real-estate" ? undefined : METAL_SYMBOL_BY_NAME[type],
    label: nameFor(mode, row),
    baselineValue,
    baselineRoi: numeric(row.roiPercent),
  };
}

const defaultValues: Record<Mode, FormValues> = {
  minerals: {
    mineralType: "Gold",
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchasePrice: 0,
    purchaseCurrency: "USD",
    quantity: 1,
    unit: "gram",
    karat: 24,
    purityPercent: 100,
    purchaseLocation: "",
    receiptNumber: "",
    notes: "",
  },
  "real-estate": {
    propertyName: "",
    propertyType: "Residential",
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchasePrice: 0,
    estimatedCurrentPrice: 0,
    address: "",
    isPaidOff: false,
    totalPaymentMonths: "",
    monthsPaid: "",
    monthsLeft: "",
    monthlyPayment: "",
    remainingBalance: "",
    isRented: false,
    monthlyRent: "",
    rentStartDate: "",
    monthlyExpenses: {
      maintenance: 0,
      tax: 0,
      insurance: 0,
      management: 0,
      hoa: 0,
      other: 0,
    },
    notes: "",
  },
  jewelry: {
    jewelryType: "Gold",
    itemName: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchasePrice: 0,
    estimatedPriceNow: "",
    weight: 1,
    unit: "gram",
    pricePerGram: "",
    karat: 24,
    purityPercent: "",
    gemstoneType: "",
    caratWeight: "",
    purchaseLocation: "",
    receiptNumber: "",
    notes: "",
  },
};

const fieldsByMode: Record<Mode, FieldConfig[]> = {
  minerals: [
    { name: "mineralType", label: "Mineral type", type: "select", options: MINERAL_TYPES },
    { name: "purchaseDate", label: "Purchase date", type: "date" },
    { name: "purchasePrice", label: "Purchase price", type: "number", step: "0.01" },
    { name: "purchaseCurrency", label: "Currency", type: "text" },
    { name: "quantity", label: "Quantity", type: "number", step: "0.000001" },
    { name: "unit", label: "Unit", type: "select", options: WEIGHT_UNITS },
    { name: "karat", label: "Karat", type: "number", step: "0.01", visible: (values) => values.mineralType === "Gold" },
    {
      name: "purityPercent",
      label: "Purity %",
      type: "number",
      step: "0.001",
      visible: (values) => values.mineralType !== "Gold",
    },
    { name: "purchaseLocation", label: "Purchase location", type: "text" },
    { name: "receiptNumber", label: "Receipt number", type: "text" },
    { name: "notes", label: "Notes", type: "textarea", span: "full" },
  ],
  "real-estate": [
    { name: "propertyName", label: "Property name", type: "text" },
    { name: "propertyType", label: "Property type", type: "select", options: REAL_ESTATE_TYPES },
    { name: "purchaseDate", label: "Purchase date", type: "date" },
    { name: "purchasePrice", label: "Purchase price", type: "number", step: "0.01" },
    { name: "estimatedCurrentPrice", label: "Estimated current price", type: "number", step: "0.01" },
    { name: "address", label: "Address / location", type: "text" },
    { name: "isPaidOff", label: "Paid off", type: "checkbox" },
    { name: "isRented", label: "Rented", type: "checkbox" },
    { name: "totalPaymentMonths", label: "Total payment months", type: "number", visible: (values) => !values.isPaidOff },
    { name: "monthlyPayment", label: "Monthly payment", type: "number", step: "0.01", visible: (values) => !values.isPaidOff },
    { name: "monthsPaid", label: "Months paid", type: "number", visible: (values) => !values.isPaidOff },
    { name: "monthsLeft", label: "Months left", type: "number", visible: (values) => !values.isPaidOff },
    { name: "remainingBalance", label: "Remaining balance", type: "number", step: "0.01", visible: (values) => !values.isPaidOff },
    { name: "monthlyRent", label: "Monthly rent", type: "number", step: "0.01", visible: (values) => Boolean(values.isRented) },
    { name: "rentStartDate", label: "Rent start date", type: "date", visible: (values) => Boolean(values.isRented) },
    { name: "monthlyExpenses.maintenance", label: "Maintenance", type: "number", step: "0.01" },
    { name: "monthlyExpenses.tax", label: "Tax", type: "number", step: "0.01" },
    { name: "monthlyExpenses.insurance", label: "Insurance", type: "number", step: "0.01" },
    { name: "monthlyExpenses.management", label: "Management", type: "number", step: "0.01" },
    { name: "monthlyExpenses.hoa", label: "HOA", type: "number", step: "0.01" },
    { name: "monthlyExpenses.other", label: "Other expenses", type: "number", step: "0.01" },
    { name: "notes", label: "Notes", type: "textarea", span: "full" },
  ],
  jewelry: [
    { name: "jewelryType", label: "Jewelry type", type: "select", options: JEWELRY_TYPES },
    { name: "itemName", label: "Item name", type: "text" },
    { name: "purchaseDate", label: "Purchase date", type: "date" },
    { name: "purchasePrice", label: "Purchase price", type: "number", step: "0.01" },
    {
      name: "estimatedPriceNow",
      label: "Estimated price now",
      type: "number",
      step: "0.01",
      visible: (values) => values.jewelryType !== "Gold" && values.jewelryType !== "Silver",
    },
    { name: "weight", label: "Weight", type: "number", step: "0.000001" },
    { name: "unit", label: "Unit", type: "select", options: JEWELRY_UNITS },
    {
      name: "pricePerGram",
      label: "Price per gram",
      type: "number",
      step: "0.000001",
      visible: (values) => values.jewelryType !== "Gold" && values.jewelryType !== "Silver",
    },
    { name: "karat", label: "Karat", type: "number", step: "0.01", visible: (values) => values.jewelryType === "Gold" },
    {
      name: "purityPercent",
      label: "Purity %",
      type: "number",
      step: "0.001",
      visible: (values) => values.jewelryType === "Silver" || values.jewelryType === "Gold Plated",
    },
    { name: "gemstoneType", label: "Gemstone type", type: "text", visible: (values) => values.jewelryType === "Gemstone" },
    { name: "caratWeight", label: "Carat weight", type: "number", step: "0.000001", visible: (values) => values.jewelryType === "Gemstone" },
    { name: "purchaseLocation", label: "Purchase location", type: "text" },
    { name: "receiptNumber", label: "Receipt number", type: "text" },
    { name: "notes", label: "Notes", type: "textarea", span: "full" },
  ],
};

function getNested(values: FormValues, name: string) {
  return name.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, values);
}

function setNested(values: FormValues, name: string, value: unknown) {
  const next = structuredClone(values) as FormValues;
  const parts = name.split(".");
  let cursor: Record<string, unknown> = next;
  for (const part of parts.slice(0, -1)) {
    cursor[part] = typeof cursor[part] === "object" && cursor[part] !== null ? cursor[part] : {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumeric(value: unknown) {
  if (value === "" || value === null || value === undefined) return undefined;
  return numeric(value);
}

function typeFor(mode: Mode, row: ManagedAsset) {
  if (mode === "minerals") return String(row.mineralType || "");
  if (mode === "real-estate") return String(row.propertyType || "");
  return String(row.jewelryType || "");
}

function nameFor(mode: Mode, row: ManagedAsset) {
  if (mode === "real-estate") return String(row.propertyName || row.name || "");
  if (mode === "jewelry") return String(row.itemName || row.name || "");
  return String(row.name || `${row.mineralType || "Mineral"} purchase`);
}

function locationFor(row: ManagedAsset) {
  return String(row.purchaseLocation || row.address || "");
}

function searchableText(row: ManagedAsset, mode: Mode) {
  const files = ((row.files as FileRecord[]) || []).map((file) => `${file.fileName} ${file.fileType}`).join(" ");
  return [
    nameFor(mode, row),
    typeFor(mode, row),
    locationFor(row),
    row.receiptNumber,
    row.notes,
    row.purchaseDate,
    row.purchasePrice,
    row.currentValue,
    row.roiPercent,
    row.quantity,
    row.unit,
    row.karat,
    row.purityPercent,
    row.address,
    row.propertyName,
    row.itemName,
    row.gemstoneType,
    row.tenantName,
    files,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();
}

function detailValueLabel(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key.toLowerCase().includes("date")) return formatDisplayDate(String(value));
  if (key === "monthlyExpenses" && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, amount]) => numeric(amount) > 0);
    return entries.length
      ? entries.map(([name, amount]) => `${titleFromSnake(name)}: ${formatCurrency(numeric(amount))}`).join(", ")
      : "No expenses";
  }
  if (key.toLowerCase().includes("price") || key.toLowerCase().includes("value") || key.toLowerCase().includes("rent") || key.toLowerCase().includes("payment") || key.toLowerCase().includes("balance") || key.toLowerCase().includes("equity") || key.toLowerCase().includes("cashflow")) {
    return formatCurrency(numeric(value));
  }
  if (key.toLowerCase().includes("percent") || key.toLowerCase().includes("roi")) {
    return formatPercent(numeric(value));
  }
  if (key.toLowerCase().includes("gram")) {
    return `${formatNumber(numeric(value), 4)} g`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function sensitiveDetailKind(key: string) {
  const normalized = key.toLowerCase();
  if (normalized.includes("percent") || normalized.includes("roi")) return "percent" as const;
  if (normalized.includes("price") || normalized.includes("value") || normalized.includes("rent") || normalized.includes("payment") || normalized.includes("balance") || normalized.includes("equity") || normalized.includes("cashflow") || normalized.includes("expense")) return "currency" as const;
  if (normalized.includes("quantity") || normalized.includes("weight") || normalized.includes("gram") || normalized.includes("karat")) return "number" as const;
  return null;
}

function formValuesFromAsset(mode: Mode, asset?: ManagedAsset) {
  const values = structuredClone(defaultValues[mode]) as FormValues;
  if (!asset) return values;

  for (const field of fieldsByMode[mode]) {
    const raw = getNested(asset, field.name);
    if (raw !== undefined && raw !== null) {
      Object.assign(values, setNested(values, field.name, raw));
    }
  }

  if (mode === "real-estate") {
    values.monthlyExpenses = {
      ...(defaultValues["real-estate"].monthlyExpenses as Record<string, number>),
      ...((asset.monthlyExpenses as Record<string, number>) || {}),
    };
  }

  return values;
}

function normalizePayload(mode: Mode, values: FormValues) {
  let payload: FormValues = {};
  for (const field of fieldsByMode[mode]) {
    const raw = getNested(values, field.name);
    let value: unknown = raw;
    if (field.type === "number") {
      value = optionalNumeric(raw);
    }
    if (field.type === "checkbox") {
      value = Boolean(raw);
    }
    payload = setNested(payload, field.name, value);
  }

  return payload;
}

function sortValue(mode: Mode, row: ManagedAsset, sort: string) {
  if (sort === "name") return nameFor(mode, row).toLowerCase();
  if (sort === "type") return typeFor(mode, row).toLowerCase();
  if (sort === "date") return String(row.purchaseDate || "");
  if (sort === "purchasePrice") return numeric(row.purchasePrice);
  if (sort === "currentValue") return numeric(row.currentValue);
  if (sort === "roi") return numeric(row.roiPercent);
  if (sort === "quantity") return numeric(row.quantityInGrams || row.weightInGrams);
  if (sort === "rent") return numeric(row.monthlyRent);
  return numeric(row.sortOrder);
}

function SummaryCards({ mode, rows }: { mode: Mode; rows: ManagedAsset[] }) {
  const totalCost = rows.reduce((sum, item) => sum + numeric(item.purchasePrice), 0);
  const totalValue = rows.reduce((sum, item) => sum + numeric(item.currentValue), 0);
  const profitLoss = totalValue - totalCost;
  const roi = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

  if (mode === "real-estate") {
    const totalEquity = rows.reduce((sum, item) => sum + numeric(item.equity), 0);
    const monthlyRent = rows.reduce((sum, item) => sum + numeric(item.monthlyRent), 0);
    const payments = rows.reduce((sum, item) => sum + numeric(item.monthlyPayment), 0);
    const expenses = rows.reduce((sum, item) => sum + numeric(item.monthlyExpenseTotal), 0);
    const net = rows.reduce((sum, item) => sum + numeric(item.monthlyNetCashFlow), 0);
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Properties" value={rows.length} detail={`${formatCurrency(totalValue)} value`} tone="info" sensitive={false} />
        <MetricCard label="Total equity" value={formatCurrency(totalEquity)} detail={formatCurrency(profitLoss)} tone={profitLoss >= 0 ? "positive" : "negative"} />
        <MetricCard label="Monthly rent" value={formatCurrency(monthlyRent)} detail={`${formatCurrency(payments + expenses)} outflow`} />
        <MetricCard label="Monthly net cash flow" value={formatCurrency(net)} detail={formatPercent(roi)} tone={net >= 0 ? "positive" : "negative"} />
      </div>
    );
  }

  if (mode === "jewelry") {
    const totalWeight = rows.reduce((sum, item) => sum + numeric(item.weightInGrams), 0);
    const pureMetalWeight = rows.reduce((sum, item) => {
      const karat = numeric(item.karat);
      const purity = karat > 0 ? karat / 24 : numeric(item.purityPercent) / 100;
      return sum + numeric(item.weightInGrams) * (purity || 0);
    }, 0);
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Purchase cost" value={formatCurrency(totalCost)} detail={`${rows.length} items`} />
        <MetricCard label="Estimated value" value={formatCurrency(totalValue)} detail={formatCurrency(profitLoss)} tone={profitLoss >= 0 ? "positive" : "negative"} />
        <MetricCard label="Total weight" value={`${formatNumber(totalWeight)} g`} detail={`${formatNumber(pureMetalWeight)} g pure metal`} tone="info" sensitiveKind="number" />
        <MetricCard label="ROI" value={formatPercent(roi)} detail="Current estimate" tone={roi >= 0 ? "positive" : "negative"} sensitiveKind="percent" />
      </div>
    );
  }

  const grams = rows.reduce((sum, item) => sum + numeric(item.quantityInGrams), 0);
  const averageCost = grams > 0 ? totalCost / grams : 0;
  const averageLive = grams > 0 ? totalValue / grams : 0;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total quantity" value={`${formatNumber(grams)} g`} detail={`${rows.length} transactions`} tone="info" sensitiveKind="number" />
      <MetricCard label="Purchase cost" value={formatCurrency(totalCost)} detail={`${formatPrecise(averageCost)} / g`} />
      <MetricCard label="Current value" value={formatCurrency(totalValue)} detail={`${formatPrecise(averageLive)} / g`} tone={profitLoss >= 0 ? "positive" : "negative"} />
      <MetricCard label="ROI" value={formatPercent(roi)} detail={formatCurrency(profitLoss)} tone={roi >= 0 ? "positive" : "negative"} sensitiveKind="percent" />
    </div>
  );
}

function formatPrecise(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value || 0);
}

function firstImage(files: FileRecord[] = [], preferredTypes: string[]) {
  return files.find((file) => preferredTypes.includes(file.fileType) && file.mimeType.startsWith("image/")) || files.find((file) => file.mimeType.startsWith("image/"));
}

function AssetPreviewCard({
  mode,
  row,
  onView,
  onEdit,
}: {
  mode: Mode;
  row: ManagedAsset;
  onView: () => void;
  onEdit: () => void;
}) {
  const files = (row.files as FileRecord[]) || [];
  const image = firstImage(files, mode === "real-estate" ? ["property_photo"] : mode === "jewelry" ? ["jewelry_photo"] : ["receipt"]);
  const cashFlow = numeric(row.monthlyNetCashFlow);

  return (
    <Card className="group overflow-hidden transition hover:-translate-y-1 hover:shadow-[0_28px_80px_-48px_rgba(15,23,42,0.6)]">
      <button className="block w-full text-left" onClick={onView}>
        <div className="relative h-36 overflow-hidden bg-slate-100">
          {image ? (
            <Image src={image.url} alt={image.fileName} fill unoptimized className="object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-sky-50 text-slate-400">
              {mode === "real-estate" ? (
                <Building2 className="h-9 w-9" />
              ) : mode === "jewelry" ? (
                <Gem className="h-9 w-9" />
              ) : (
                <Sparkles className="h-9 w-9" />
              )}
            </div>
          )}
          <div className="absolute left-3 top-3">
            <Badge tone="info">{typeFor(mode, row)}</Badge>
          </div>
          {mode === "real-estate" ? (
            <div className="absolute right-3 top-3 flex gap-1">
              <Badge tone={row.isPaidOff ? "positive" : "warning"}>{row.isPaidOff ? "Paid off" : "Financed"}</Badge>
              <Badge tone={row.isRented ? "positive" : "neutral"}>{row.isRented ? "Rented" : "Vacant"}</Badge>
            </div>
          ) : null}
        </div>
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-950">{nameFor(mode, row)}</div>
            <div className="mt-1 truncate text-sm text-slate-500">{locationFor(row) || formatDisplayDate(String(row.purchaseDate || ""))}</div>
          </div>
          <RoiBadge value={numeric(row.roiPercent)} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Value</div>
            <SensitiveCurrency value={numeric(row.currentValue)} className="mt-1 font-mono text-lg font-semibold text-slate-950" label="asset current value" />
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
              {mode === "real-estate" ? "Equity" : "Cost"}
            </div>
            <SensitiveCurrency value={mode === "real-estate" ? numeric(row.equity) : numeric(row.purchasePrice)} className="mt-1 font-mono text-lg font-semibold text-slate-950" label={mode === "real-estate" ? "property equity" : "purchase cost"} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
          <span>
            {mode === "real-estate"
              ? <><SensitiveCurrency value={cashFlow} label="monthly cash flow" /> / mo</>
              : mode === "minerals"
                ? <><SensitiveNumber value={numeric(row.effectiveQuantityInGrams || row.quantityInGrams)} label="effective mineral quantity" /> g effective</>
                : <><SensitiveNumber value={numeric(row.weightInGrams)} label="jewelry weight" /> g</>}
          </span>
          <div className="flex gap-1">
            <Button title="View details" aria-label="View details" variant="ghost" size="icon" onClick={onView}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button title="Edit" aria-label="Edit" variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SortableTableRow({
  row,
  children,
  disabled,
}: {
  row: ManagedAsset;
  children: React.ReactNode;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style} className={cn("border-t border-slate-100 transition hover:bg-slate-50/80", isDragging && "bg-sky-50")}>
      <td className="w-11 px-3 py-3 align-middle">
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
          aria-label="Reorder"
          title="Reorder"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      {children}
    </tr>
  );
}

export function AssetsWorkspace({
  mode,
  title,
  subtitle,
  tabs,
  initialAssets,
}: {
  mode: Mode;
  title: string;
  subtitle: string;
  tabs: readonly string[];
  initialAssets: ManagedAsset[];
}) {
  const [rows, setRows] = useState<ManagedAsset[]>(initialAssets);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("manual");
  const [roiFilter, setRoiFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [valueMin, setValueMin] = useState("");
  const [valueMax, setValueMax] = useState("");
  const [location, setLocation] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [rentalFilter, setRentalFilter] = useState("all");
  const [editing, setEditing] = useState<ManagedAsset | null>(null);
  const [viewing, setViewing] = useState<ManagedAsset | null>(null);
  const [deleting, setDeleting] = useState<ManagedAsset | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(defaultValues[mode]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState("receipt");
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [alertTarget, setAlertTarget] = useState<AlertTarget | null>(null);
  const [alertRules, setAlertRules] = useState<AlertRuleRecord[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    fetch(`/api/alerts?assetCategory=${alertCategoryByMode[mode]}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((rules) => setAlertRules(Array.isArray(rules) ? rules : []))
      .catch(() => setAlertRules([]));
  }, [mode]);

  const visibleRows = useMemo(() => {
    const query = search.toLowerCase().trim();
    const filtered = rows.filter((row) => {
      const rowType = typeFor(mode, row);
      const rowLocation = locationFor(row);
      const rowDate = String(row.purchaseDate || "");
      const value = numeric(row.currentValue);
      const roi = numeric(row.roiPercent);
      const matchesTab = activeTab === "All" || rowType === activeTab;
      const matchesSearch = !query || searchableText(row, mode).includes(query);
      const matchesRoi = roiFilter === "all" || (roiFilter === "positive" ? roi >= 0 : roi < 0);
      const matchesDate = (!dateFrom || rowDate >= dateFrom) && (!dateTo || rowDate <= dateTo);
      const matchesValue = (!valueMin || value >= Number(valueMin)) && (!valueMax || value <= Number(valueMax));
      const matchesLocation = !location || rowLocation.toLowerCase().includes(location.toLowerCase());
      const matchesPayment =
        mode !== "real-estate" ||
        paymentFilter === "all" ||
        (paymentFilter === "paid-off" ? Boolean(row.isPaidOff) : !Boolean(row.isPaidOff));
      const matchesRental =
        mode !== "real-estate" ||
        rentalFilter === "all" ||
        (rentalFilter === "rented" ? Boolean(row.isRented) : !Boolean(row.isRented));

      return matchesTab && matchesSearch && matchesRoi && matchesDate && matchesValue && matchesLocation && matchesPayment && matchesRental;
    });

    if (sort === "manual") {
      return filtered;
    }

    return filtered.slice().sort((a, b) => {
      const aValue = sortValue(mode, a, sort);
      const bValue = sortValue(mode, b, sort);
      if (typeof aValue === "string" && typeof bValue === "string") return aValue.localeCompare(bValue);
      return Number(bValue) - Number(aValue);
    });
  }, [rows, activeTab, search, sort, roiFilter, dateFrom, dateTo, valueMin, valueMax, location, paymentFilter, rentalFilter, mode]);

  async function refreshRows() {
    const response = await fetch(endpoints[mode], { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to refresh assets");
    setRows(await response.json());
  }

  function openAdd() {
    setEditing(null);
    setFormValues(structuredClone(defaultValues[mode]) as FormValues);
    setError("");
  }

  function openEdit(asset: ManagedAsset) {
    setEditing(asset);
    setFormValues(formValuesFromAsset(mode, asset));
    setError("");
  }

  function closeForm() {
    setEditing(null);
    setFormValues(defaultValues[mode]);
  }

  async function saveAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const payload = normalizePayload(mode, formValues);
      const url = editing ? `${endpoints[mode]}/${editing.id}` : endpoints[mode];
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed");
      await refreshRows();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function duplicateAsset(asset: ManagedAsset) {
    const payload = normalizePayload(mode, formValuesFromAsset(mode, asset));
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoints[mode], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Duplicate failed");
      await refreshRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${endpoints[mode]}/${deleting.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete failed");
      setRows((current) => current.filter((row) => row.id !== deleting.id));
      setDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setPending(false);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((row) => row.id === active.id);
    const newIndex = rows.findIndex((row) => row.id === over.id);
    const next = arrayMove(rows, oldIndex, newIndex);
    setRows(next);
    await fetch(reorderEndpoints[mode], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((row) => row.id) }),
    });
  }

  async function uploadSelectedFile() {
    if (!viewing || !uploadFile) return;
    setPending(true);
    setError("");
    try {
      const body = new FormData();
      body.set("assetType", singularAssetType[mode]);
      body.set("assetId", viewing.id);
      body.set("fileType", uploadType);
      body.set("file", uploadFile);
      const response = await fetch("/api/files/upload", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");
      await refreshRows();
      setViewing((current) =>
        current ? ({ ...current, files: [...((current.files as FileRecord[]) || []), data] } as ManagedAsset) : current,
      );
      setUploadFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  async function deleteFile(file: FileRecord) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete file failed");
      await refreshRows();
      setViewing((current) =>
        current ? ({ ...current, files: ((current.files as FileRecord[]) || []).filter((item) => item.id !== file.id) } as ManagedAsset) : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete file failed");
    } finally {
      setPending(false);
    }
  }

  const formOpen = Boolean(editing) || formValues !== defaultValues[mode];
  const modalTitle = editing ? `Edit ${nameFor(mode, editing)}` : `Add ${title.replace(/s$/, "")}`;
  const scopedRows = activeTab === "All" ? visibleRows : visibleRows.filter((row) => typeFor(mode, row) === activeTab);
  const pageEyebrow =
    mode === "minerals" ? "Metals inventory" : mode === "real-estate" ? "Property portfolio" : "Collectibles ledger";
  const addLabel =
    mode === "minerals" ? "Add Transaction" : mode === "real-estate" ? "Add Property" : "Add Item";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={pageEyebrow}
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <LinkButton href="/alerts" icon={<BellRing className="h-4 w-4" />}>View Alerts</LinkButton>
            <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>{addLabel}</Button>
          </>
        }
      />

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70 p-2 shadow-sm backdrop-blur">
        {["All", ...tabs].map((tab) => (
          <button
            key={tab}
            className={cn(
              "h-10 rounded-xl border px-4 text-sm font-semibold transition",
              activeTab === tab
                ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                : "border-transparent bg-transparent text-slate-600 hover:bg-white hover:text-slate-950",
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <SummaryCards mode={mode} rows={scopedRows} />

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-950">Search and filters</div>
            <div className="text-xs text-slate-500">Refine by ROI, date, value, location, and status.</div>
          </div>
          <Badge tone="neutral">{visibleRows.length} shown</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
            />
          </label>
          <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="manual">Manual order</option>
            <option value="date">Date</option>
            <option value="purchasePrice">Purchase price</option>
            <option value="currentValue">Current value</option>
            <option value="roi">ROI</option>
            <option value="type">Type</option>
            <option value="name">Name</option>
            <option value="quantity">Quantity / weight</option>
            {mode === "real-estate" ? <option value="rent">Rent income</option> : null}
          </select>
          <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" value={roiFilter} onChange={(event) => setRoiFilter(event.target.value)}>
            <option value="all">All ROI</option>
            <option value="positive">Positive ROI</option>
            <option value="negative">Negative ROI</option>
          </select>
          <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} type="date" />
          <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" value={dateTo} onChange={(event) => setDateTo(event.target.value)} type="date" />
          <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" value={valueMin} onChange={(event) => setValueMin(event.target.value)} placeholder="Min value" type="number" />
          <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" value={valueMax} onChange={(event) => setValueMax(event.target.value)} placeholder="Max value" type="number" />
          <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 xl:col-span-2" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" />
          {mode === "real-estate" ? (
            <>
              <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                <option value="all">All payments</option>
                <option value="paid-off">Paid off</option>
                <option value="financed">Financed</option>
              </select>
              <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" value={rentalFilter} onChange={(event) => setRentalFilter(event.target.value)}>
                <option value="all">All rental status</option>
                <option value="rented">Rented</option>
                <option value="vacant">Vacant</option>
              </select>
            </>
          ) : null}
        </div>
      </Card>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleRows.slice(0, 6).map((row) => (
          <AssetPreviewCard
            key={`card-${row.id}`}
            mode={mode}
            row={row}
            onView={() => setViewing(row)}
            onEdit={() => openEdit(row)}
          />
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Asset Register</h2>
            <p className="text-sm text-slate-500">Sortable ledger with manual ordering and quick actions.</p>
          </div>
          <Badge tone="info">{activeTab}</Badge>
        </div>
        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={visibleRows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
              <table className="financial-table min-w-[980px] w-full table-fixed text-left text-sm">
                <thead className="bg-slate-50/95 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="w-11 px-3 py-3" />
                    <th className="w-[250px] px-3 py-3">Asset</th>
                    <th className="w-28 px-3 py-3">Date</th>
                    <th className="w-32 px-3 py-3">Cost</th>
                    <th className="w-32 px-3 py-3">Value</th>
                    <th className="w-28 px-3 py-3">ROI</th>
                    <th className="w-40 px-3 py-3">{mode === "real-estate" ? "Cash flow" : "Quantity"}</th>
                    {mode === "minerals" || mode === "jewelry" ? <th className="w-40 px-3 py-3">Purity / Live Price</th> : null}
                    <th className="w-24 px-3 py-3">Files</th>
                    <th className="w-52 px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <SortableTableRow key={row.id} row={row} disabled={sort !== "manual"}>
                      <td className="px-3 py-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-950">{nameFor(mode, row)}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge tone="info">{typeFor(mode, row)}</Badge>
                            <span className="truncate text-xs text-slate-500">{locationFor(row)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatDisplayDate(String(row.purchaseDate || ""))}</td>
                      <td className="px-3 py-3 font-medium text-slate-800"><SensitiveCurrency value={numeric(row.purchasePrice)} label="purchase cost" /></td>
                      <td className="px-3 py-3 font-medium text-slate-800"><SensitiveCurrency value={numeric(row.currentValue)} label="current value" /></td>
                      <td className="px-3 py-3">
                        <RoiBadge value={numeric(row.roiPercent)} />
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {mode === "real-estate"
                          ? <SensitiveCurrency value={numeric(row.monthlyNetCashFlow)} label="monthly cash flow" />
                          : <SensitiveNumber value={numeric(row.quantityInGrams || row.weightInGrams)} label="asset quantity" />}
                      </td>
                      {mode === "minerals" ? (
                        <td className="px-3 py-3 text-slate-600">
                          <div className="text-xs font-medium text-slate-900">
                            {row.mineralType === "Gold"
                              ? `${formatNumber(numeric(row.karat), 2)}K`
                              : `${formatNumber(numeric(row.purityPercent || 100), 3)}%`}
                          </div>
                          <div className="mt-1 text-xs text-slate-500"><SensitiveCurrency value={numeric(row.currentPricePerGram)} label="live price per gram" /> / g</div>
                        </td>
                      ) : null}
                      {mode === "jewelry" ? (
                        <td className="px-3 py-3 text-slate-600">
                          <div className="text-xs font-medium text-slate-900">
                            {row.jewelryType === "Gold"
                              ? `${formatNumber(numeric(row.karat || 24), 2)}K`
                              : row.jewelryType === "Silver" || row.jewelryType === "Gold Plated"
                                ? `${formatNumber(numeric(row.purityPercent || 100), 3)}%`
                                : "Manual"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {numeric(row.effectivePricePerGram || row.pricePerGram) > 0
                              ? <><SensitiveCurrency value={numeric(row.effectivePricePerGram || row.pricePerGram)} label="live price per gram" /> / g</>
                              : "No live price"}
                          </div>
                        </td>
                      ) : null}
                      <td className="px-3 py-3 text-slate-600">{(row.files as FileRecord[]).length}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <Button title="View details" aria-label="View details" variant="ghost" size="icon" onClick={() => setViewing(row)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button title={`Add alert (${alertRules.filter((rule) => rule.assetId === row.id).length} existing)`} aria-label="Add alert" variant="ghost" size="icon" onClick={() => setAlertTarget(alertTargetFor(mode, row))}>
                            <BellPlus className="h-4 w-4" />
                          </Button>
                          <Button title="Upload file" aria-label="Upload file" variant="ghost" size="icon" onClick={() => setViewing(row)}>
                            <FileUp className="h-4 w-4" />
                          </Button>
                          <Button title="Edit" aria-label="Edit" variant="ghost" size="icon" onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button title="Duplicate" aria-label="Duplicate" variant="ghost" size="icon" onClick={() => duplicateAsset(row)} disabled={pending}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button title="Delete" aria-label="Delete" variant="ghost" size="icon" onClick={() => setDeleting(row)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </SortableTableRow>
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
          {!visibleRows.length ? (
            <div className="p-5">
              <EmptyState
                title="No transactions yet"
                description="No assets match the current filters. Add a new item or clear filters to rebuild this view."
                actionLabel={addLabel}
                onAction={openAdd}
              />
            </div>
          ) : null}
        </div>
      </Card>

      <Modal open={formOpen} title={modalTitle} onClose={closeForm} size="lg">
        <form className="grid gap-4 rounded-2xl bg-slate-50/60 p-4 md:grid-cols-2" onSubmit={saveAsset}>
          <div className="md:col-span-2">
            <div className="text-sm font-semibold text-slate-950">Asset details</div>
            <div className="mt-1 text-sm text-slate-500">Enter purchase, valuation, location, and supporting notes.</div>
          </div>
          {fieldsByMode[mode].map((field) => {
            if (field.visible && !field.visible(formValues)) return null;
            const value = getNested(formValues, field.name);
            const commonClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100";
            return (
              <label key={field.name} className={cn("grid gap-1.5 text-sm font-semibold text-slate-700", field.span === "full" && "md:col-span-2")}>
                <span>{field.label}</span>
                {field.type === "select" ? (
                  <select className={commonClass} value={String(value ?? "")} onChange={(event) => setFormValues((current) => setNested(current, field.name, event.target.value))}>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : null}
                {field.type === "textarea" ? (
                  <textarea
                    className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    value={String(value ?? "")}
                    onChange={(event) => setFormValues((current) => setNested(current, field.name, event.target.value))}
                  />
                ) : null}
                {field.type === "checkbox" ? (
                  <span className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-3">
                    <span className="text-sm font-medium text-slate-500">{Boolean(value) ? "Yes" : "No"}</span>
                    <input
                      className="h-5 w-5 rounded border-slate-300 accent-slate-950"
                      checked={Boolean(value)}
                      type="checkbox"
                      onChange={(event) => setFormValues((current) => setNested(current, field.name, event.target.checked))}
                    />
                  </span>
                ) : null}
                {field.type !== "select" && field.type !== "textarea" && field.type !== "checkbox" ? (
                  <input
                    className={commonClass}
                    value={String(value ?? "")}
                    type={field.type}
                    step={field.step}
                    onChange={(event) => setFormValues((current) => setNested(current, field.name, event.target.value))}
                  />
                ) : null}
              </label>
            );
          })}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 md:col-span-2 md:flex-row md:justify-end">
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} icon={<RefreshCcw className={cn("h-4 w-4", pending && "animate-spin")} />}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(viewing)} title={viewing ? nameFor(mode, viewing) : "Asset details"} onClose={() => setViewing(null)} size="xl">
        {viewing ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(viewing)
                .filter(([key]) => !["files", "id", "assetType"].includes(key))
                .slice(0, 28)
                .map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{titleFromSnake(key)}</div>
                    <div className="mt-1 break-words text-sm font-semibold text-slate-900">
                      {sensitiveDetailKind(key) ? <SensitiveValue kind={sensitiveDetailKind(key) || "number"} label={titleFromSnake(key)}>{detailValueLabel(key, value)}</SensitiveValue> : detailValueLabel(key, value)}
                    </div>
                  </div>
                ))}
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">Alerts</div>
                    <div className="mt-1 text-xs text-slate-500">{alertRules.filter((rule) => rule.assetId === viewing.id).length} rules for this asset</div>
                  </div>
                  <Badge tone="info">{alertRules.filter((rule) => rule.assetId === viewing.id).length}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => setAlertTarget(alertTargetFor(mode, viewing))} icon={<BellPlus className="h-4 w-4" />}>Add Alert</Button>
                  <LinkButton href={`/alerts?assetId=${viewing.id}`} icon={<BellRing className="h-4 w-4" />}>View Alerts</LinkButton>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-950">Files</div>
                <div className="mt-3 space-y-2">
                  {((viewing.files as FileRecord[]) || []).map((file) => (
                    <div key={file.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800">{file.fileName}</div>
                        <div className="text-xs text-slate-500">{titleFromSnake(file.fileType)}</div>
                      </div>
                      <div className="flex gap-1">
                        {file.mimeType.startsWith("image/") ? (
                          <Button title="Preview" aria-label="Preview" variant="ghost" size="icon" onClick={() => setPreviewFile(file)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          <a className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100" href={file.url} target="_blank" rel="noreferrer" title="Open">
                            <Eye className="h-4 w-4" />
                          </a>
                        )}
                        <Button title="Delete file" aria-label="Delete file" variant="ghost" size="icon" onClick={() => deleteFile(file)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!((viewing.files as FileRecord[]) || []).length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">No files attached.</div> : null}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3">
                  <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
                    {["receipt", "property_photo", "purchase_contract", "rent_contract", "jewelry_photo", "certificate", "other"].map((option) => (
                      <option key={option} value={option}>
                        {titleFromSnake(option)}
                      </option>
                    ))}
                  </select>
                  <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-sky-300 hover:bg-sky-50/50">
                    <Upload className="h-6 w-6 text-slate-400" />
                    <span className="mt-2 text-sm font-semibold text-slate-700">{uploadFile ? uploadFile.name : "Drop or choose a receipt, photo, or document"}</span>
                    <span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP, or PDF</span>
                    <input className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} />
                  </label>
                  <Button onClick={uploadSelectedFile} disabled={!uploadFile || pending} icon={<Upload className="h-4 w-4" />}>
                    Upload
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(deleting)} title="Confirm delete" onClose={() => setDeleting(null)} size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{deleting ? `Delete ${nameFor(mode, deleting)} and its attached file records?` : ""}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={pending}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(previewFile)} title={previewFile?.fileName || "Preview"} onClose={() => setPreviewFile(null)} size="xl">
        {previewFile ? (
          <Image
            src={previewFile.url}
            alt={previewFile.fileName}
            width={1200}
            height={800}
            unoptimized
            className="max-h-[72vh] w-full rounded-md object-contain"
          />
        ) : null}
      </Modal>

      <AlertRuleForm
        open={Boolean(alertTarget)}
        target={alertTarget}
        onClose={() => setAlertTarget(null)}
        onSaved={(saved) => setAlertRules((current) => [saved, ...current.filter((rule) => rule.id !== saved.id)])}
      />
    </div>
  );
}
