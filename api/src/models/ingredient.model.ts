import { Schema, model, InferSchemaType, Types } from "mongoose";

const IngredientSchema = new Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["dry", "produce", "meat", "dairy", "bar"],
      required: true,
    },
    // Reference Unit by ObjectId per schema
    baseUnit: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    parLevel: { type: Number, default: 0, min: 0 },
    currentQty: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
  },
  { timestamps: true }
);

export type IngredientDoc = InferSchemaType<typeof IngredientSchema>;
export default model("Ingredient", IngredientSchema);
