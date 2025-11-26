import { Router as createRouter } from "express";
import type { Router } from "express";
import { z } from "zod";
import MenuCategory from "../models/menuCategory.model";
import MenuItem from "../models/menu.model";

const r: Router = createRouter();

const createSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(["food", "beverage"]).default("food").optional(),
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

r.get("/", async (req: any, res, next) => {
  try {
    const cats = await MenuCategory.find({
      restaurant: req.user!.restaurantId,
    }).sort({ name: 1 });

    const usage = await MenuItem.aggregate([
      {
        $match: {
          restaurant: req.user!.restaurantId,
          active: true,
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);
    const usageMap = new Map(usage.map((u) => [u._id || "Uncategorized", u.count]));
    res.json(
      cats.map((c) => ({
        ...c.toObject(),
        usageCount: usageMap.get(c.name) || 0,
      }))
    );
  } catch (err) {
    next(err);
  }
});

r.post("/", validate(createSchema), async (req: any, res) => {
  try {
    const doc = await MenuCategory.create({
      name: req.body.name.trim(),
      kind: req.body.kind || "food",
      restaurant: req.user!.restaurantId,
    });
    res.status(201).json(doc);
  } catch (e: any) {
    if (e.code === 11000) {
      return res.status(400).json({ error: "Category already exists" });
    }
    res.status(400).json({ error: e.message });
  }
});

r.delete("/:id", async (req: any, res) => {
  const cat = await MenuCategory.findOne({
    _id: req.params.id,
    restaurant: req.user!.restaurantId,
  });
  if (!cat) return res.status(404).json({ error: "Not found" });
  const inUse = await MenuItem.countDocuments({
    restaurant: req.user!.restaurantId,
    category: cat.name,
    active: true,
  });
  if (inUse > 0) {
    return res
      .status(400)
      .json({ error: "Category is in use by menu items. Reassign before deleting." });
  }
  await cat.deleteOne();
  res.json({ ok: true });
});

r.post(
  "/merge",
  validate(
    z.object({
      sourceId: z.string().trim().min(1),
      targetId: z.string().trim().min(1),
    })
  ),
  async (req: any, res) => {
    const { sourceId, targetId } = req.body;
    if (sourceId === targetId) {
      return res.status(400).json({ error: "Source and target must differ" });
    }
    const [source, target] = await Promise.all([
      MenuCategory.findOne({
        _id: sourceId,
        restaurant: req.user!.restaurantId,
      }),
      MenuCategory.findOne({
        _id: targetId,
        restaurant: req.user!.restaurantId,
      }),
    ]);
    if (!source || !target) return res.status(404).json({ error: "Category not found" });
    if (source.kind !== target.kind) {
      return res.status(400).json({ error: "Kinds must match to merge" });
    }
    await MenuItem.updateMany(
      {
        restaurant: req.user!.restaurantId,
        category: source.name,
      },
      { category: target.name }
    );
    await source.deleteOne();
    res.json({ ok: true, merged: sourceId, into: targetId });
  }
);

export default r;
