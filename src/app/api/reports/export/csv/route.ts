import { flattenPortfolioAssets, getPortfolioCollections } from "@/lib/data";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export async function GET() {
  try {
    const collections = await getPortfolioCollections();
    const assets = flattenPortfolioAssets(collections);
    const rows = [
      ["Category", "Type", "Name", "Purchase Date", "Purchase Price", "Current Value", "ROI %"],
      ...assets.map((asset) => [
        asset.category,
        asset.subType,
        asset.name,
        asset.purchaseDate,
        asset.purchasePrice,
        asset.currentValue,
        asset.roiPercent,
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=asset-portfolio.csv",
      },
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}

