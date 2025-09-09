import { Router as createRouter } from "express";
import type { Router } from "express";
import Ingredient from "../models/ingredient.model";

const r: Router = createRouter();

// List all (optionally filter by ?active=true/false)
r.get("/", async (req, res, next) => {
  try {
    const filter: any = {};
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;

    const items = await Ingredient.find(filter).sort({ name: 1 });
    return res.json(items);
  } catch (e) {
    return next(e);
  }
});

r.post("/", async (req, res) => {
  try {
    const item = await Ingredient.create(req.body);
    res.status(201).json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.get("/:id", async (req, res) => {
  const item = await Ingredient.findById(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

r.patch("/:id", async (req, res) => {
  try {
    const item = await Ingredient.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Archive (soft delete -> active=false)
r.delete("/:id", async (req, res) => {
  const item = await Ingredient.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true }
  );
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

export default r;
