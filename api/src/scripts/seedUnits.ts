import "dotenv/config";
import mongoose from "mongoose";
import Unit from "../models/unit.model";

async function seedUnits() {
  const defaults = [
    { code: "G", name: "Grams", precision: 0 },
    { code: "KG", name: "Kilograms", precision: 3 },
    { code: "ML", name: "Milliliters", precision: 0 },
    { code: "L", name: "Liters", precision: 3 },
    { code: "CT", name: "Count", precision: 0 },
  ];

  for (const u of defaults) {
    await Unit.updateOne({ code: u.code }, { $set: u }, { upsert: true });
    console.log(`Upserted unit ${u.code}`);
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await seedUnits();
    console.log("✅ Units seeded");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Seed failed", err);
  process.exit(1);
});

