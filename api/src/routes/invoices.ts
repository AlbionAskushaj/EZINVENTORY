import { Router as createRouter } from "express";
import type { Router } from "express";
import multer from "multer";
import { z } from "zod";
import Ingredient from "../models/ingredient.model";
import Movement from "../models/movement.model";
import Unit from "../models/unit.model";
import { RawInvoiceLine, parseInvoicePdf } from "../services/invoiceParser";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

type IngredientCategory =
  | "dry"
  | "produce"
  | "meat"
  | "dairy"
  | "bar"
  | "seafood"
  | "grocery";

const r: Router = createRouter();

type NormalizedLine = {
  sku: string;
  name: string;
  quantity: number;
  unitCode: string;
  category: IngredientCategory;
  sourceDept?: string;
  brand?: string;
  packSize?: string;
  unitCost?: number;
  extendedCost?: number;
};

const applySchema = z.object({
  invoice: z
    .object({
      number: z.string().trim().min(1).optional(),
      date: z.string().trim().min(1).optional(),
      purchaseOrder: z.string().trim().min(1).optional(),
    })
    .partial()
    .optional(),
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1),
        name: z.string().trim().min(1),
        unitCode: z.string().trim().min(1),
        quantity: z.number().positive(),
        category: z.enum([
          "dry",
          "produce",
          "meat",
          "dairy",
          "bar",
          "seafood",
          "grocery",
        ]),
        brand: z.string().trim().optional(),
        packSize: z.string().trim().optional(),
        unitCost: z.number().optional(),
        extendedCost: z.number().optional(),
        apply: z.boolean().optional(),
      })
    )
    .min(1),
});

function validateBody(schema: z.ZodSchema<any>) {
  return (req: any, res: any, next: any) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    req.body = parsed.data;
    next();
  };
}

r.post(
  "/preview",
  upload.single("file"),
  async (req: any, res, next): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Missing invoice file" });
        return;
      }

      const parsed = await parseInvoicePdf(req.file.buffer);
      const normalized = parsed.items
        .map(normalizeLine)
        .filter((line): line is NormalizedLine => Boolean(line));
      if (!normalized.length) {
        res.status(422).json({ error: "Could not read any line items" });
        return;
      }

      const annotated = await annotateWithExisting(
        normalized,
        req.user!.restaurantId
      );

      res.json({
        invoice: {
          number: parsed.invoiceNumber,
          date: parsed.invoiceDate,
          purchaseOrder: parsed.purchaseOrder,
        },
        items: annotated,
      });
    } catch (err) {
      next(err);
    }
  }
);

r.post(
  "/apply",
  validateBody(applySchema),
  async (req: any, res, next): Promise<void> => {
    try {
      const { items, invoice } = req.body as z.infer<typeof applySchema>;
      const toApply = items.filter(
        (item) => item.apply !== false && item.quantity > 0
      );
      if (toApply.length === 0) {
        res.status(400).json({ error: "No items selected to apply" });
        return;
      }

      const normalized = toApply.map((item) => ({
        sku: item.sku.trim(),
        name: item.name.trim(),
        quantity: item.quantity,
        unitCode: item.unitCode.trim().toUpperCase(),
        category: item.category,
        brand: item.brand?.trim() || undefined,
        packSize: item.packSize?.trim() || undefined,
        unitCost: item.unitCost,
        extendedCost: item.extendedCost,
      }));

      const results = await ingestLines(
        normalized,
        req.user!.restaurantId,
        req.user!.userId,
        invoice?.number || invoice?.purchaseOrder
      );

      res.json({ items: results });
    } catch (err) {
      next(err);
    }
  }
);

type PreviewLine = NormalizedLine & {
  exists: boolean;
  ingredientId?: string;
};

async function annotateWithExisting(
  items: NormalizedLine[],
  restaurantId: string
): Promise<PreviewLine[]> {
  const skus = [...new Set(items.map((item) => item.sku))];
  const existing = await Ingredient.find({
    sku: { $in: skus },
    restaurant: restaurantId,
  }).select("_id sku");

  const map = new Map(existing.map((doc) => [doc.sku, doc._id.toString()]));
  return items.map((item) => ({
    ...item,
    exists: map.has(item.sku),
    ingredientId: map.get(item.sku),
  }));
}

async function ingestLines(
  items: NormalizedLine[],
  restaurantId: string,
  userId: string,
  invoiceRef?: string
) {
  const cache = new Map<string, string>();
  const outcomes = [];
  for (const normalized of items) {
    const unitId = await ensureUnit(normalized.unitCode, restaurantId, cache);
    let ingredient = await Ingredient.findOne({
      sku: normalized.sku,
      restaurant: restaurantId,
    });
    let created = false;

    if (!ingredient) {
      ingredient = await Ingredient.create({
        sku: normalized.sku,
        name: normalized.name,
        category: normalized.category,
        baseUnit: unitId,
        restaurant: restaurantId,
        parLevel: 0,
        currentQty: 0,
      });
      created = true;
    }

    await Ingredient.updateOne(
      { _id: ingredient._id },
      { $inc: { currentQty: normalized.quantity } }
    );

    await Movement.create({
      ingredient: ingredient._id,
      restaurant: restaurantId,
      type: "purchase",
      delta: normalized.quantity,
      reason: invoiceRef
        ? `Invoice ${invoiceRef}`
        : `Invoice import by ${userId}`,
    });

    outcomes.push({
      sku: normalized.sku,
      name: normalized.name,
      ingredientId: ingredient._id,
      created,
      quantityAdded: normalized.quantity,
      unitCode: normalized.unitCode,
      category: normalized.category,
      brand: normalized.brand,
      packSize: normalized.packSize,
      unitCost: normalized.unitCost,
      extendedCost: normalized.extendedCost,
    });
  }
  return outcomes;
}

function normalizeLine(raw: RawInvoiceLine): NormalizedLine | null {
  const quantity =
    raw.qtyShipped > 0
      ? raw.qtyShipped
      : raw.qtyOrdered > 0
        ? raw.qtyOrdered
        : 0;
  if (!quantity) return null;

  const sku = raw.sku.trim();
  const name =
    toTitle(raw.description || raw.brand || raw.sku).slice(0, 200) ||
    `Item ${sku}`;
  const unitCode = (raw.invoiceUnit || "EA").toUpperCase();

  return {
    sku,
    name,
    quantity,
    unitCode,
    category: mapDeptToCategory(raw.deptCode),
    sourceDept: raw.deptCode,
    brand: raw.brand,
    packSize: raw.packSize,
    unitCost: raw.unitCost,
    extendedCost: raw.extendedCost,
  };
}

function toTitle(input: string) {
  return input
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

const DEPT_TO_CATEGORY: Record<string, IngredientCategory> = {
  SF: "seafood",
  PR: "produce",
  MT: "meat",
  GR: "dry",
  DA: "dairy",
  BR: "bar",
};

function mapDeptToCategory(dept?: string): IngredientCategory {
  if (!dept) return "dry";
  const key = dept.toUpperCase();
  return DEPT_TO_CATEGORY[key] ?? "dry";
}

const UNIT_META: Record<
  string,
  { name: string; precision: number }
> = {
  EA: { name: "Each", precision: 0 },
  CS: { name: "Case", precision: 0 },
  LB: { name: "Pounds", precision: 2 },
  KG: { name: "Kilograms", precision: 3 },
  KGA: { name: "Kilograms (Approx)", precision: 3 },
  G: { name: "Grams", precision: 0 },
  ML: { name: "Milliliters", precision: 0 },
  L: { name: "Liters", precision: 3 },
};

async function ensureUnit(
  invoiceUnit: string,
  restaurantId: string,
  cache: Map<string, string>
): Promise<string> {
  const code = invoiceUnit.toUpperCase();
  if (cache.has(code)) return cache.get(code)!;

  let unit = await Unit.findOne({ code, restaurant: restaurantId });
  if (!unit) {
    const meta =
      UNIT_META[code] ?? { name: `${code} Unit`, precision: 2 };
    unit = await Unit.create({
      code,
      name: meta.name,
      precision: meta.precision,
      restaurant: restaurantId,
    });
  }

  cache.set(code, unit._id.toString());
  return unit._id.toString();
}

export default r;
