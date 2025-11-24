import { Schema, model, InferSchemaType } from "mongoose";

const SalesUploadSchema = new Schema(
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
    netSales: { type: Number },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    storedAt: { type: Date, default: Date.now },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

export type SalesUploadDoc = InferSchemaType<typeof SalesUploadSchema>;
export default model("SalesUpload", SalesUploadSchema);
