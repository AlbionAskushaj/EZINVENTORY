import { Router as createRouter } from "express";
import type { Router } from "express";
import Unit from "../models/unit.model";
import Ingredient from "../models/ingredient.model";
import { z } from "zod";

const r: Router = createRouter();

const unitCreateSchema = z.object({
  code: z.string().trim().toUpperCase().min(1),
  name: z.string().trim().min(1),
  precision: z.number().int().min(0).max(6).default(0),
});
const unitUpdateSchema = unitCreateSchema.partial();

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

// List units (alphabetical by code)
r.get("/", async (req: any, res, next) => {
  try {
    const units = await Unit.find({ restaurant: req.user!.restaurantId }).sort({
      code: 1,
    });
    res.json(units);
  } catch (e) {
    next(e);
  }
});

// Create unit
r.post("/", validate(unitCreateSchema), async (req: any, res) => {
  try {
    const unit = await Unit.create({
      ...req.body,
      restaurant: req.user!.restaurantId,
    });
    res.status(201).json(unit);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Read one
r.get("/:id", async (req: any, res) => {
  const unit = await Unit.findOne({
    _id: req.params.id,
    restaurant: req.user!.restaurantId,
  });
  if (!unit) return res.status(404).json({ error: "Not found" });
  res.json(unit);
});

// Update
r.patch("/:id", validate(unitUpdateSchema), async (req: any, res) => {
  try {
    const unit = await Unit.findOneAndUpdate(
      { _id: req.params.id, restaurant: req.user!.restaurantId },
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!unit) return res.status(404).json({ error: "Not found" });
    res.json(unit);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Delete with in-use guard (ingredients referencing this unit)
r.delete("/:id", async (req: any, res) => {
  const unitId = req.params.id;
  const inUse = await Ingredient.countDocuments({
    baseUnit: unitId,
    restaurant: req.user!.restaurantId,
  });
  if (inUse > 0) {
    return res.status(409).json({ error: "Unit is in use by ingredients" });
  }
  const result = await Unit.findOneAndDelete({
    _id: unitId,
    restaurant: req.user!.restaurantId,
  });
  if (!result) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

export default r;
