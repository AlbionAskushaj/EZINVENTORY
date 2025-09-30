import { Schema, model, InferSchemaType } from "mongoose";

const MovementSchema = new Schema(
  {
    ingredient: {
      type: Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    type: {
      type: String,
      enum: ["adjustment", "purchase", "usage"],
      required: true,
    },
    delta: { type: Number, required: true },
    reason: { type: String, trim: true },
  },
  { timestamps: true }
);

export type MovementDoc = InferSchemaType<typeof MovementSchema>;
export default model("Movement", MovementSchema);
