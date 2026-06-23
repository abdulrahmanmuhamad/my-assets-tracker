export const ASSET_CATEGORIES = ["Minerals", "Real Estate", "Jewelry", "Stocks"] as const;

export const MINERAL_TYPES = ["Gold", "Silver", "Platinum", "Palladium", "Copper", "Other"] as const;
export const REAL_ESTATE_TYPES = ["Residential", "Commercial"] as const;
export const JEWELRY_TYPES = ["Gold", "Silver", "Gemstone", "Gold Plated", "Other"] as const;

export const WEIGHT_UNITS = ["gram", "kilogram", "ounce", "troy ounce", "pound"] as const;
export const JEWELRY_UNITS = ["gram", "ounce", "troy ounce"] as const;

export const METAL_SYMBOL_BY_NAME: Record<string, string> = {
  Gold: "XAU",
  Silver: "XAG",
  Platinum: "XPT",
  Palladium: "XPD",
  Copper: "XCU",
};

export const METAL_NAME_BY_SYMBOL: Record<string, string> = {
  XAU: "Gold",
  XAG: "Silver",
  XPT: "Platinum",
  XPD: "Palladium",
  XCU: "Copper",
};

export const MARKET_SYMBOL_BY_METAL_SYMBOL: Record<string, string> = {
  XAU: "GC=F",
  XAG: "SI=F",
  XPT: "PL=F",
  XPD: "PA=F",
  XCU: "HG=F",
};

export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const FILE_TYPE_OPTIONS = [
  "receipt",
  "property_photo",
  "purchase_contract",
  "rent_contract",
  "jewelry_photo",
  "certificate",
  "other",
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Minerals: "#2563eb",
  "Real Estate": "#14b8a6",
  Jewelry: "#f59e0b",
  Stocks: "#4f46e5",
  "Banks/Cash": "#059669",
  Gold: "#d97706",
  Silver: "#64748b",
  Platinum: "#0f766e",
  Palladium: "#7c3aed",
  Copper: "#b45309",
  Residential: "#0891b2",
  Commercial: "#16a34a",
  Gemstone: "#db2777",
  "Gold Plated": "#ca8a04",
  Other: "#475569",
};

export type AssetKind = "mineral" | "real-estate" | "jewelry" | "stock";
