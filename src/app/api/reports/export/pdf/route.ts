import PDFDocument from "pdfkit";
import { getDashboardSummary } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getDashboardSummary();
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(20).text("Asset Portfolio Report", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#64748b").text(`Generated ${new Date().toLocaleString()}`);
    doc.moveDown();
    doc.fillColor("#111827").fontSize(12);
    doc.text(`Total Portfolio Value: ${formatCurrency(summary.totalPortfolioValue)}`);
    doc.text(`Total Cost Basis: ${formatCurrency(summary.totalCostBasis)}`);
    doc.text(`Profit / Loss: ${formatCurrency(summary.totalProfitLoss)}`);
    doc.text(`Total ROI: ${formatPercent(summary.totalRoiPercent)}`);
    doc.moveDown();
    doc.fontSize(14).text("Allocation by Category");
    doc.fontSize(11);
    for (const item of summary.allocationByCategory) {
      doc.text(`${item.name}: ${formatCurrency(item.value)} (${formatPercent(item.percentOfTotal)})`);
    }
    doc.moveDown();
    doc.fontSize(14).text("Best Performing Assets");
    doc.fontSize(11);
    summary.assets
      .slice()
      .sort((a, b) => Number(b.roiPercent) - Number(a.roiPercent))
      .slice(0, 8)
      .forEach((asset) => {
        doc.text(`${asset.name} - ${asset.category} / ${asset.subType}: ${formatPercent(Number(asset.roiPercent))}`);
      });
    doc.end();

    const buffer = await done;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=asset-portfolio-report.pdf",
      },
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}
