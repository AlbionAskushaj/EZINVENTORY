import { Schema, model, InferSchemaType } from "mongoose";

const RestaurantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

RestaurantSchema.index({ name: 1 });

export type RestaurantDoc = InferSchemaType<typeof RestaurantSchema>;
export default model("Restaurant", RestaurantSchema);
