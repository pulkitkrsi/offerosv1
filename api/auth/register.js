import { getDb } from "../lib/db.js";
import { hashPassword } from "../lib/hash.js";
import { requireAdmin } from "../lib/auth.js";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { username, password, displayName, role } = req.body || {};
    if (!username || !password || !displayName) return res.status(400).json({ error: "username, password, displayName required" });
    if (role && !["admin", "editor"].includes(role)) return res.status(400).json({ error: "role must be admin or editor" });

    const db = await getDb();
    const existing = await db.collection("users").findOne({ username: username.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Username already exists" });

    const passwordHash = await hashPassword(password);
    const result = await db.collection("users").insertOne({
      username: username.toLowerCase(),
      displayName,
      passwordHash,
      role: role || "editor",
      preferences: { theme: "light", defaultMarginPct: 30 },
      createdAt: new Date(),
      lastLoginAt: null,
    });

    return res.status(201).json({ id: result.insertedId, username: username.toLowerCase(), displayName, role: role || "editor" });
  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}

export default requireAdmin(handler);
