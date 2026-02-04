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
    items: [
      {
        name: { type: String, required: true },
        category: { type: String, default: "Uncategorized" },
        modifier: { type: String },
        avgPrice: { type: Number },
        quantity: { type: Number, required: true },
        grossSales: { type: Number },
        discount: { type: Number },
        netSales: { type: Number },
        hasRecipe: { type: Boolean, default: false },
        isBeverage: { type: Boolean, default: null },
      },
    ],
  },
  { timestamps: true }
);

export type MenuBreakdownUploadDoc = InferSchemaType<
  typeof MenuBreakdownUploadSchema
>;
export default model("MenuBreakdownUpload", MenuBreakdownUploadSchema);
