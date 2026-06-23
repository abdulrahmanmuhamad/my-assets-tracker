import { createJewelry, createMineral, createRealEstate } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0] || "").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function numberValue(value: string) {
  const parsed = Number(value.replace(/[$,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("CSV file is required");
    }

    const rows = parseCsv(await file.text());
    let imported = 0;

    for (const row of rows) {
      const category = row.Category || row.category;
      const type = row.Type || row.type || "Other";
      const name = row.Name || row.name || `${type} import`;
      const purchaseDate = row["Purchase Date"] || row.purchaseDate || new Date().toISOString().slice(0, 10);
      const purchasePrice = numberValue(row["Purchase Price"] || row.purchasePrice || "0");
      const currentValue = numberValue(row["Current Value"] || row.currentValue || "0");

      if (category === "Minerals") {
        await createMineral({
          mineralType: type,
          purchaseDate: new Date(purchaseDate),
          purchasePrice,
          purchaseCurrency: "USD",
          quantity: 1,
          unit: "gram",
          currentPricePerGram: currentValue || purchasePrice,
          purchaseLocation: "CSV import",
          receiptNumber: "",
          notes: name,
        });
        imported += 1;
      } else if (category === "Real Estate") {
        await createRealEstate({
          propertyName: name,
          propertyType: type === "Commercial" ? "Commercial" : "Residential",
          purchaseDate: new Date(purchaseDate),
          purchasePrice,
          estimatedCurrentPrice: currentValue || purchasePrice,
          address: "CSV import",
          isPaidOff: true,
          isRented: false,
          monthlyExpenses: {},
          notes: "Imported from CSV",
        });
        imported += 1;
      } else if (category === "Jewelry") {
        await createJewelry({
          jewelryType: type,
          itemName: name,
          purchaseDate: new Date(purchaseDate),
          purchasePrice,
          estimatedPriceNow: currentValue || purchasePrice,
          weight: 1,
          unit: "gram",
          pricePerGram: currentValue || purchasePrice,
          purchaseLocation: "CSV import",
          receiptNumber: "",
          notes: "Imported from CSV",
        });
        imported += 1;
      }
    }

    return jsonOk({ imported });
  } catch (error) {
    return jsonError(error);
  }
}

