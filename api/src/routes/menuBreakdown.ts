import { Router as createRouter } from "express";
import type { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import MenuItem from "../models/menu.model";
import MenuBreakdownUpload from "../models/menuBreakdownUpload.model";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

type BreakdownItem = {
  name: string;
  category: string;
  modifier?: string;
  avgPrice?: number;
  quantity: number;
  grossSales?: number;
  discount?: number;
  netSales?: number;
  hasRecipe: boolean;
  isBeverage: boolean;
};

const r: Router = createRouter();

r.get("/uploads", async (req: any, res, next) => {
  try {
    const uploads = await MenuBreakdownUpload.find({
      restaurant: req.user!.restaurantId,
    })
      .select(
        "_id originalName size mimeType itemCount missingRecipeCount totalNetSales totalQuantity periodStart periodEnd createdAt storedAt"
      )
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({ uploads });
  } catch (err) {
    next(err);
  }
});

r.post(
  "/upload",
  upload.single("file"),
  async (req: any, res, next): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Missing menu breakdown file" });
        return;
      }

      const text = req.file.buffer.toString("utf8");
      const records = parseCsv(text);
      const normalized = normalizeRecords(records);

      if (!normalized.length) {
        res.status(422).json({ error: "No items found in file" });
        return;
      }

      const names = [...new Set(normalized.map((i) => i.name.toLowerCase()))];
      const existing = await MenuItem.find({
        restaurant: req.user!.restaurantId,
        name: { $in: names },
      }).select("name");
      const existingNames = new Set(
        existing.map((m) => m.name.toLowerCase())
      );

      const withRecipeFlag = normalized.map((item) => ({
        ...item,
        hasRecipe: existingNames.has(item.name.toLowerCase()),
      }));

      const missingRecipeCount = withRecipeFlag.filter(
        (i) => !i.hasRecipe
      ).length;
      const totalNetSales = withRecipeFlag.reduce(
        (sum, i) => sum + (i.netSales ?? 0),
        0
      );
      const totalQuantity = withRecipeFlag.reduce(
        (sum, i) => sum + i.quantity,
        0
      );

      const dateHints = parseDateRangeFromName(req.file.originalname);

      await MenuBreakdownUpload.create({
        restaurant: req.user!.restaurantId,
        uploadedBy: req.user!.userId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer,
        itemCount: withRecipeFlag.length,
        missingRecipeCount,
        totalNetSales,
        totalQuantity,
        ...dateHints,
      });

      res.json({
        summary: {
          totalItems: withRecipeFlag.length,
          missingRecipeCount,
          totalNetSales,
          totalQuantity,
          periodStart: dateHints.periodStart,
          periodEnd: dateHints.periodEnd,
        },
        items: withRecipeFlag,
      });
    } catch (err) {
      next(err);
    }
  }
);

function parseCsv(text: string) {
  try {
    return parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
  } catch {
    return [];
  }
}

function toNumber(value: any) {
  if (value === undefined || value === null) return undefined;
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(num) ? num : undefined;
}

function inferBeverage(category: string, name: string) {
  const source = `${category} ${name}`.toLowerCase();
  return /wine|beer|cocktail|liquor|spirit|vodka|whiskey|gin|tequila|mezcal|champagne|soda|water|beer|bar/.test(
    source
  );
}

function normalizeRecords(rows: any[]): BreakdownItem[] {
  const items: BreakdownItem[] = [];

  for (const row of rows) {
    const name = (row["Item Name"] || row.item || "").toString().trim();
    const quantity = toNumber(row["Quantity"]) ?? 0;
    if (!name || quantity <= 0) continue;

    const category = (row["Sales Category"] || "Uncategorized").toString().trim();
    const modifier = row["Modifier"]
      ? row["Modifier"].toString().trim()
      : undefined;

    const avgPrice = toNumber(row["Avg Price"]);
    const grossSales = toNumber(row["Gross Sales"]);
    const discount = toNumber(row["Discount Amount"]);
    const netSales =
      toNumber(row["Net Sales"]) ??
      (grossSales !== undefined && discount !== undefined
        ? grossSales - discount
        : grossSales);

    items.push({
      name,
      category,
      modifier,
      avgPrice,
      quantity,
      grossSales: grossSales ?? undefined,
      discount: discount ?? undefined,
      netSales: netSales ?? undefined,
      hasRecipe: false,
      isBeverage: inferBeverage(category, name),
    });
  }

  return items;
}

function parseDateRangeFromName(name: string) {
  const match = name.match(/(20\d{2}-\d{2}-\d{2})[^0-9]+(20\d{2}-\d{2}-\d{2})/);
  if (!match) return {};
  const [start, end] = match.slice(1, 3);
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return {};
  return { periodStart: startDate, periodEnd: endDate };
}

export default r;
