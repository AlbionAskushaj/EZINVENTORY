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
  isBeverage: boolean | null;
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

      const hintMap = await fetchBeverageHints(
        names,
        req.user!.restaurantId
      );

      const withRecipeFlag = normalized.map((item) => ({
        ...item,
        hasRecipe: existingNames.has(item.name.toLowerCase()),
        isBeverage:
          hintMap.get(item.name.toLowerCase()) ?? null,
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

      const saved = await MenuBreakdownUpload.create({
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
        items: withRecipeFlag,
        ...dateHints,
      });

      res.json({
        uploadId: saved._id,
        name: saved.originalName,
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

r.get("/uploads/:id", async (req: any, res, next) => {
  try {
    const upload = await MenuBreakdownUpload.findOne({
      _id: req.params.id,
      restaurant: req.user!.restaurantId,
    });
    if (!upload) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }

    const items =
      upload.items && upload.items.length
        ? upload.items
        : await rehydrateItemsFromStoredData(
            upload.data,
            req.user!.restaurantId
          );

    const summary = summarize(items, upload);

    res.json({
      upload: {
        id: upload._id,
        originalName: upload.originalName,
        periodStart: upload.periodStart,
        periodEnd: upload.periodEnd,
        createdAt: upload.createdAt,
      },
      summary,
      items,
    });
  } catch (err) {
    next(err);
  }
});

r.put("/uploads/:id", async (req: any, res, next) => {
  try {
    const upload = await MenuBreakdownUpload.findOne({
      _id: req.params.id,
      restaurant: req.user!.restaurantId,
    });
    if (!upload) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    const rename =
      typeof req.body.name === "string" ? req.body.name.trim() : undefined;

    if (rename && rename.length > 0) {
      upload.originalName = rename;
    }

    if (items && items.length) {
      const sanitized: BreakdownItem[] = items.map((item: any) => ({
        name: String(item.name || "").trim(),
        category: String(item.category || "Uncategorized").trim(),
        modifier: item.modifier ? String(item.modifier) : undefined,
        avgPrice:
          item.avgPrice !== undefined ? Number(item.avgPrice) : undefined,
        quantity: Number(item.quantity) || 0,
        grossSales:
          item.grossSales !== undefined ? Number(item.grossSales) : undefined,
        discount:
          item.discount !== undefined ? Number(item.discount) : undefined,
        netSales:
          item.netSales !== undefined ? Number(item.netSales) : undefined,
        hasRecipe: Boolean(item.hasRecipe),
        isBeverage:
          item.isBeverage === null || item.isBeverage === undefined
            ? null
            : Boolean(item.isBeverage),
      }));

      const summary = summarize(sanitized, upload);
      upload.items = sanitized;
      upload.itemCount = summary.totalItems;
      upload.missingRecipeCount = summary.missingRecipeCount;
      upload.totalNetSales = summary.totalNetSales;
      upload.totalQuantity = summary.totalQuantity;
    }
    await upload.save();

    res.json({
      summary: summarize(upload.items || [], upload),
      name: upload.originalName,
    });
  } catch (err) {
    next(err);
  }
});

r.delete("/uploads/:id", async (req: any, res, next) => {
  try {
    const deleted = await MenuBreakdownUpload.findOneAndDelete({
      _id: req.params.id,
      restaurant: req.user!.restaurantId,
    });
    if (!deleted) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

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
      isBeverage: null,
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

function summarize(items: BreakdownItem[], upload: any) {
  const missingRecipeCount = items.filter((i) => !i.hasRecipe).length;
  const totalNetSales = items.reduce(
    (sum, i) => sum + (i.netSales ?? 0),
    0
  );
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  return {
    totalItems: items.length,
    missingRecipeCount,
    totalNetSales,
    totalQuantity,
    periodStart: upload?.periodStart,
    periodEnd: upload?.periodEnd,
  };
}

async function rehydrateItemsFromStoredData(
  buffer: Buffer,
  restaurantId: string
) {
  const text = buffer.toString("utf8");
  const normalized = normalizeRecords(parseCsv(text));
  const names = [...new Set(normalized.map((i) => i.name.toLowerCase()))];
  const hintMap = await fetchBeverageHints(names, restaurantId);
  const existing = await MenuItem.find({
    restaurant: restaurantId,
    name: { $in: names },
  }).select("name");
  const existingNames = new Set(existing.map((m) => m.name.toLowerCase()));
  return normalized.map((item) => ({
    ...item,
    hasRecipe: existingNames.has(item.name.toLowerCase()),
    isBeverage:
      hintMap.get(item.name.toLowerCase()) ?? null,
  }));
}

async function fetchBeverageHints(names: string[], restaurantId: string) {
  if (!names.length) return new Map<string, boolean | null>();
  const rows = await MenuBreakdownUpload.aggregate([
    { $match: { restaurant: restaurantId } },
    { $unwind: "$items" },
    {
      $addFields: {
        lowerName: { $toLower: "$items.name" },
      },
    },
    { $match: { lowerName: { $in: names } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$lowerName",
        isBeverage: { $first: "$items.isBeverage" },
      },
    },
  ]);
  const map = new Map<string, boolean | null>();
  rows.forEach((r: any) => {
    map.set(r._id, r.isBeverage);
  });
  return map;
}

export default r;
