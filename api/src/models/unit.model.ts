import { Schema, model, InferSchemaType } from "mongoose";

// Unit: fundamental measurement units used across ingredients and inventory
// Fields based on your schema: code (String), name (String), precision (Number)
// - code: short identifier like "g", "ml", "ct"
// - name: human-readable like "grams", "milliliters", "count"
// - precision: number of decimal places to display/accept in UI (e.g., 0, 1, 2)

const UnitSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    precision: { type: Number, required: true, min: 0, max: 6, default: 0 },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
  },
  { timestamps: true }
);

// Enforce uniqueness per restaurant (not globally across tenants)
UnitSchema.index({ restaurant: 1, code: 1 }, { unique: true });

export type UnitDoc = InferSchemaType<typeof UnitSchema>;
export default model("Unit", UnitSchema);
