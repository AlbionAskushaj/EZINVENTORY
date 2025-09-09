import { Schema, model, InferSchemaType } from "mongoose";

const IngredientSchema = new Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ["food", "alcohol"], required: true },
    // Keep it simple for now: a base unit code. We'll switch to Unit._id later if you want.
    baseUnit: { type: String, enum: ["g", "ml", "ct"], required: true },
    parLevel: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type IngredientDoc = InferSchemaType<typeof IngredientSchema>;
export default model("Ingredient", IngredientSchema);
