import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthedUser = {
  userId: string;
  restaurantId: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export default function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-secret"
    ) as AuthedUser | any;
    if (!payload || !payload.restaurantId)
      return res.status(401).json({ error: "Invalid token" });
    req.user = { userId: payload.userId, restaurantId: payload.restaurantId };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
