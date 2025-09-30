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
import unitRoutes from "./routes/units";
import authRoutes from "./routes/auth";
import requireAuth from "./middleware/requireAuth";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.use(requireAuth);
app.use("/api/ingredients", ingredientRoutes);
app.use("/api/units", unitRoutes);

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
    const uri = process.env.MONGO_URI;
    const display = (() => {
      try {
        if (!uri) return "(missing MONGO_URI)";
        const u = new URL(uri);
        const dbName =
          u.pathname && u.pathname.length > 1 ? u.pathname.slice(1) : "(none)";
        return `${u.protocol}//${u.host}/${dbName}`;
      } catch {
        return "(invalid URI)";
      }
    })();
    console.log(`⏳ Connecting to Mongo at ${display} …`);

    await mongoose.connect(uri!, {
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
