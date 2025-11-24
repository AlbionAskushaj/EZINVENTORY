import { Router as createRouter } from "express";
import type { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import Restaurant from "../models/restaurant.model";

const r: Router = createRouter();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  restaurantName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function signToken(userId: string, restaurantId: string) {
  const payload = { userId, restaurantId };
  const secret = process.env.JWT_SECRET || "dev-secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

r.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, restaurantName } = parsed.data;

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: "Email already in use" });

  const restaurant = await Restaurant.create({ name: restaurantName });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email,
    passwordHash,
    restaurant: restaurant._id,
  });

  const token = signToken(user._id.toString(), restaurant._id.toString());
  res
    .status(201)
    .json({ token, restaurant: { id: restaurant._id, name: restaurant.name } });
});

r.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user = await User.findOne({ email }).populate("restaurant");
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(
    user._id.toString(),
    (user.restaurant as any)._id.toString()
  );
  res.json({
    token,
    restaurant: {
      id: (user.restaurant as any)._id,
      name: (user.restaurant as any).name,
    },
  });
});

export default r;
