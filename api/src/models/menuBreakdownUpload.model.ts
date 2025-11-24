import { Schema, model, InferSchemaType } from "mongoose";

const MenuBreakdownUploadSchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    storedAt: { type: Date, default: Date.now },
    data: { type: Buffer, required: true },
    itemCount: { type: Number, default: 0 },
    missingRecipeCount: { type: Number, default: 0 },
    totalNetSales: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type MenuBreakdownUploadDoc = InferSchemaType<
  typeof MenuBreakdownUploadSchema
>;
export default model("MenuBreakdownUpload", MenuBreakdownUploadSchema);
