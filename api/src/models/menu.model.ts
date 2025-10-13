import { Schema, model, InferSchemaType, Types } from "mongoose";

const MenuItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    ingredients: [
      {
        ingredient: {
          type: Schema.Types.ObjectId,
          ref: "Ingredient",
          required: true,
        },
        quantity: { type: Number, required: true, min: 0 }, // quantity in base units
      },
    ],
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
