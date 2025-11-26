import { Router as createRouter } from "express";
import type { Router } from "express";
import { z } from "zod";
import MenuItem from "../models/menu.model";
import Ingredient from "../models/ingredient.model";

// Router for menu item CRUD operations
const r: Router = createRouter();

// Schema for creating/updating menu items
const ingredientRefSchema = z.object({
  ingredient: z.string().trim().min(1), // ObjectId as string
  quantity: z.number().min(0),
  unitCost: z.number().min(0).optional(),
});

const menuCreateSchema = z.object({
  name: z.string().trim().min(1),
  price: z.number().min(0),
  ingredients: z.array(ingredientRefSchema).min(1),
  kind: z.enum(["food", "beverage"]).default("food").optional(),
  category: z.string().trim().optional(),
  targetMargin: z.number().min(0).max(1).optional(),
});

const menuUpdateSchema = menuCreateSchema.partial();

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

// List all menu items for the authenticated restaurant
r.get("/", async (req: any, res, next) => {
  try {
    const activeFilter =
      req.query.active === "all"
        ? undefined
        : req.query.active === "inactive"
          ? false
          : true;
    const items = await MenuItem.find({
      restaurant: req.user!.restaurantId,
      ...(activeFilter === undefined ? {} : { active: activeFilter }),
    })
      .populate("ingredients.ingredient")
      .sort({ deletedAt: -1, updatedAt: -1 });
    return res.json(items);
  } catch (e) {
    return next(e);
  }
});

// Create a menu item
r.post("/", validate(menuCreateSchema), async (req: any, res) => {
  try {
    // Verify that all referenced ingredients belong to the same restaurant
    const ids = req.body.ingredients.map((i: any) => i.ingredient);
    const count = await Ingredient.countDocuments({
      _id: { $in: ids },
      restaurant: req.user!.restaurantId,
    });
    if (count !== ids.length) {
      return res
        .status(400)
        .json({ error: "One or more ingredients not found" });
    }
    const payload = {
      ...req.body,
      kind: req.body.kind || "food",
      category: req.body.category || "Uncategorized",
      active: true,
      restaurant: req.user!.restaurantId,
    };
    const doc = await MenuItem.create({
      ...payload,
    });
    const populated = await doc.populate("ingredients.ingredient");
    res.status(201).json(populated);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post(
  "/bulk-category",
  validate(
    z.object({
      ids: z.array(z.string().trim().min(1)).min(1),
      category: z.string().trim().min(1),
      kind: z.enum(["food", "beverage"]).optional(),
    })
  ),
  async (req: any, res) => {
    const { ids, category, kind } = req.body;
    const result = await MenuItem.updateMany(
      {
        _id: { $in: ids },
        restaurant: req.user!.restaurantId,
        ...(kind ? { kind } : {}),
      },
      { category }
    );
    res.json({ updated: result.modifiedCount });
  }
);

// Get a single menu item
r.get("/:id", async (req: any, res) => {
  const doc = await MenuItem.findOne({
    _id: req.params.id,
    restaurant: req.user!.restaurantId,
  }).populate("ingredients.ingredient");
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

// Update a menu item
r.patch("/:id", validate(menuUpdateSchema), async (req: any, res) => {
  try {
    if (req.body.ingredients) {
      // validate referenced ingredients belong to the restaurant
      const ids = req.body.ingredients.map((i: any) => i.ingredient);
      const count = await Ingredient.countDocuments({
        _id: { $in: ids },
        restaurant: req.user!.restaurantId,
      });
      if (count !== ids.length) {
        return res
          .status(400)
          .json({ error: "One or more ingredients not found" });
      }
    }
    const payload = {
      ...req.body,
    };
    if (payload.kind === undefined) payload.kind = "food";
    if (payload.category === undefined) payload.category = "Uncategorized";
    if (payload.active === undefined) payload.active = true;
    const doc = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, restaurant: req.user!.restaurantId },
      payload,
      { new: true, runValidators: true }
    ).populate("ingredients.ingredient");
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Delete a menu item (hard delete)
r.delete("/:id", async (req: any, res) => {
  const doc = await MenuItem.findOneAndUpdate(
    {
      _id: req.params.id,
      restaurant: req.user!.restaurantId,
    },
    { active: false, deletedAt: new Date() },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true, softDeleted: true });
});

r.post("/:id/restore", async (req: any, res) => {
  const doc = await MenuItem.findOneAndUpdate(
    {
      _id: req.params.id,
      restaurant: req.user!.restaurantId,
    },
    { active: true, deletedAt: null },
    { new: true }
  ).populate("ingredients.ingredient");
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

r.delete("/trash/purge", async (req: any, res) => {
  const days = Number(req.query.days || 30);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await MenuItem.deleteMany({
    restaurant: req.user!.restaurantId,
    active: false,
    deletedAt: { $lte: cutoff },
  });
  res.json({ purged: result.deletedCount || 0, olderThanDays: days });
});

export default r;
