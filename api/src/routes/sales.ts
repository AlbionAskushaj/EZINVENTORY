import { Router as createRouter } from "express";
import type { Router } from "express";
import multer from "multer";
import SalesUpload from "../models/salesUpload.model";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

const r: Router = createRouter();

function parseNetSales(csv: string): number | undefined {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return undefined;
  const headers = lines[0].split(",").map((h) => h.trim());
  const values = lines[1].split(",");
  const idx = headers.findIndex((h) => /net sales/i.test(h));
  if (idx === -1 || idx >= values.length) return undefined;
  const numeric = Number(values[idx].replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseDateRangeFromName(name: string) {
  const match = name.match(/(20\d{2}-\d{2}-\d{2})[^0-9]+(20\d{2}-\d{2}-\d{2})/);
  if (!match) return {};
  const [start, end] = match.slice(1, 3);
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return {};
  return { periodStart: startDate, periodEnd: endDate };
}

r.get("/uploads", async (req: any, res, next) => {
  try {
    const uploads = await SalesUpload.find({
      restaurant: req.user!.restaurantId,
    })
      .select(
        "_id originalName mimeType size netSales periodStart periodEnd storedAt createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(25);
    res.json({ uploads });
  } catch (err) {
    next(err);
  }
});

r.post(
  "/uploads",
  upload.single("file"),
  async (req: any, res, next): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Missing sales file" });
        return;
      }

      const text = req.file.buffer.toString("utf8");
      const netSales =
        req.file.mimetype.includes("csv") || req.file.originalname.endsWith(".csv")
          ? parseNetSales(text)
          : undefined;

      const dateHints = parseDateRangeFromName(req.file.originalname);

      const doc = await SalesUpload.create({
        restaurant: req.user!.restaurantId,
        uploadedBy: req.user!.userId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        netSales,
        data: req.file.buffer,
        ...dateHints,
      });

      res.json({
        upload: {
          id: doc._id,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          size: doc.size,
          netSales: doc.netSales,
          periodStart: doc.periodStart,
          periodEnd: doc.periodEnd,
          storedAt: doc.storedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default r;
