import { getDb } from "../lib/db.js";
import { requireAdmin } from "../lib/auth.js";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getDb();
    const users = await db.collection("users").find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: 1 }).toArray();
    return res.status(200).json(users);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default requireAdmin(handler);
