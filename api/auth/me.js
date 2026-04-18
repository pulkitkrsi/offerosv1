import { getDb } from "../lib/db.js";
import { getTokenFromRequest, verifyToken } from "../lib/auth.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });

  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: new ObjectId(payload.id) }, { projection: { passwordHash: 0 } });
    if (!user) return res.status(401).json({ error: "User not found" });

    return res.status(200).json({
      user: { id: user._id, username: user.username, displayName: user.displayName, role: user.role, preferences: user.preferences || {} }
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
