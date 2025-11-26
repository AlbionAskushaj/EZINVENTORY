import { Schema, model, InferSchemaType, Types } from "mongoose";

const MenuItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    kind: {
      type: String,
      enum: ["food", "beverage"],
      default: "food",
      index: true,
    },
    category: { type: String, default: "Uncategorized", trim: true },
    ingredients: [
      {
        ingredient: {
          type: Schema.Types.ObjectId,
          ref: "Ingredient",
          required: true,
        },
        quantity: { type: Number, required: true, min: 0 }, // quantity in base units
        unitCost: { type: Number, min: 0 }, // optional override cost
      },
    ],
    targetMargin: { type: Number, min: 0, max: 1, default: 0.3 },
    active: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
  },
  { timestamps: true }
);

export type MenuItemDoc = InferSchemaType<typeof MenuItemSchema>;
export default model("MenuItem", MenuItemSchema);
