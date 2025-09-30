import { Router as createRouter } from "express";
import type { Router } from "express";
import Ingredient from "../models/ingredient.model";
import { z } from "zod";
import Movement from "../models/movement.model";

const r: Router = createRouter();

const ingredientCreateSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.enum(["food", "alcohol"]),
  baseUnit: z.string().trim().min(1),
  parLevel: z.number().min(0).default(0),
  currentQty: z.number().min(0).default(0),
});

const ingredientUpdateSchema = ingredientCreateSchema.partial();

const adjustSchema = z.object({
  delta: z.number().min(-1_000_000).max(1_000_000),
  reason: z.string().trim().max(200).optional(),
});

function validate(schema: z.ZodSchema<any>) {
  return (req: any, res: any, next: any) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    req.body = parsed.data;
    next();
  };
}

// List all (optionally filter by ?active=true/false)
r.get("/", async (req: any, res, next) => {
  try {
    const filter: any = { restaurant: req.user!.restaurantId };
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;

    const items = await Ingredient.find(filter).sort({ name: 1 });
    return res.json(items);
  } catch (e) {
    return next(e);
  }
});

r.post("/", validate(ingredientCreateSchema), async (req: any, res) => {
  try {
    const item = await Ingredient.create({
      ...req.body,
      restaurant: req.user!.restaurantId,
    });
    res.status(201).json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.get("/:id", async (req: any, res) => {
  const item = await Ingredient.findOne({
    _id: req.params.id,
    restaurant: req.user!.restaurantId,
  });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

r.patch("/:id", validate(ingredientUpdateSchema), async (req: any, res) => {
  try {
    const item = await Ingredient.findOneAndUpdate(
      { _id: req.params.id, restaurant: req.user!.restaurantId },
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/:id/adjust", validate(adjustSchema), async (req: any, res) => {
  const { delta, reason } = req.body as { delta: number; reason?: string };
  const id = req.params.id;
  const doc = await Ingredient.findOne({
    _id: id,
    restaurant: req.user!.restaurantId,
  });
  if (!doc) return res.status(404).json({ error: "Not found" });

  const nextQty = (doc.currentQty || 0) + delta;
  if (nextQty < 0)
    return res
      .status(400)
      .json({ error: "Resulting stock cannot be negative" });

  doc.currentQty = nextQty;
  await doc.save();
  await Movement.create({ ingredient: id, type: "adjustment", delta, reason });

  res.json({ ok: true, currentQty: doc.currentQty });
});

// Archive (soft delete -> active=false)
r.delete("/:id", async (req: any, res) => {
  const item = await Ingredient.findOneAndUpdate(
    { _id: req.params.id, restaurant: req.user!.restaurantId },
    { active: false },
    { new: true }
  );
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

export default r;
