import { Schema, model, InferSchemaType } from "mongoose";

const MenuCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ["food", "beverage"],
      default: "food",
      index: true,
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

MenuCategorySchema.index(
  { restaurant: 1, name: 1, kind: 1 },
  { unique: true }
);

export type MenuCategoryDoc = InferSchemaType<typeof MenuCategorySchema>;
export default model("MenuCategory", MenuCategorySchema);
