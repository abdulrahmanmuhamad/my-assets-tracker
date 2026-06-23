import { getDashboardSummary } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const LINE_HEIGHT = 15;
const MAX_LINE_CHARS = 92;
const MAX_LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - MARGIN * 2) / LINE_HEIGHT);

function pdfText(value: string) {
  return value
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(line: string) {
  if (line.length <= MAX_LINE_CHARS) return [line];
  const words = line.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > MAX_LINE_CHARS && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function paginate(lines: string[]) {
  const wrapped = lines.flatMap((line) => wrapLine(line));
  const pages: string[][] = [];
  for (let index = 0; index < wrapped.length; index += MAX_LINES_PER_PAGE) {
    pages.push(wrapped.slice(index, index + MAX_LINES_PER_PAGE));
  }
  return pages.length ? pages : [["Asset Portfolio Report"]];
}

function buildContentStream(lines: string[]) {
  const commands = [
    "BT",
    "/F1 11 Tf",
    `${MARGIN} ${PAGE_HEIGHT - MARGIN} Td`,
    `${LINE_HEIGHT} TL`,
  ];

  lines.forEach((line, index) => {
    commands.push(index === 0 ? `(${pdfText(line)}) Tj` : `T* (${pdfText(line)}) Tj`);
  });

  commands.push("ET");
  return commands.join("\n");
}

function buildPdf(lines: string[]) {
  const pages = paginate(lines);
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];

  for (const pageLines of pages) {
    const stream = buildContentStream(pageLines);
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function reportLines(summary: Awaited<ReturnType<typeof getDashboardSummary>>) {
  const lines = [
    "Asset Portfolio Report",
    `Generated ${new Date().toLocaleString()}`,
    "",
    `Total Portfolio Value: ${formatCurrency(summary.totalPortfolioValue)}`,
    `Total Cost Basis: ${formatCurrency(summary.totalCostBasis)}`,
    `Profit / Loss: ${formatCurrency(summary.totalProfitLoss)}`,
    `Total ROI: ${formatPercent(summary.totalRoiPercent)}`,
    "",
    "Allocation by Category",
    ...summary.allocationByCategory.map((item) => (
      `${item.name}: ${formatCurrency(item.value)} (${formatPercent(item.percentOfTotal)})`
    )),
    "",
    "Best Performing Assets",
    ...summary.assets
      .slice()
      .sort((a, b) => Number(b.roiPercent) - Number(a.roiPercent))
      .slice(0, 12)
      .map((asset) => `${asset.name} - ${asset.category} / ${asset.subType}: ${formatPercent(Number(asset.roiPercent))}`),
  ];

  return lines;
}

export async function GET() {
  try {
    const summary = await getDashboardSummary();
    const buffer = buildPdf(reportLines(summary));

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=asset-portfolio-report.pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}
