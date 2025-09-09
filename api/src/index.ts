import "dotenv/config";
import express from "express";
import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";

import cors from "cors";
const PORT = Number(process.env.PORT || 4000);
// Fail fast if models try to run before Mongo connects
import mongoose from "mongoose";
mongoose.set("bufferCommands", false);

//routes
import ingredientRoutes from "./routes/ingredients";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/ingredients", ingredientRoutes);

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

// 404 handler (after routes)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handler (typed)
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
};
app.use(errorHandler);

async function start() {
  try {
    console.log("⏳ Connecting to Mongo…");
    await mongoose.connect(process.env.MONGO_URI!, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Mongo connected");

    app.listen(PORT, () => console.log(`🚀 API running on :${PORT}`));
  } catch (err) {
    console.error("❌ Mongo connection error:", err);
    process.exit(1);
  }
}
start();
