import { getDb } from "../lib/db.js";
import { hashPassword } from "../lib/hash.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ message: "POST to this endpoint with { password: 'your-password' } to create the admin user.", warning: "Only works if no admin exists yet." });
  }
  try {
    const db = await getDb();
    const existing = await db.collection("users").findOne({ role: "admin" });
    if (existing) return res.status(403).json({ error: "Admin already exists. Endpoint disabled." });
    const { password } = req.body || {};
    if (!password || password.length < 8) return res.status(400).json({ error: "Provide a password with at least 8 characters." });
    try { await db.collection("users").createIndex({ username: 1 }, { unique: true }); await db.collection("offers").createIndex({ campaignId: 1 }); await db.collection("simulations").createIndex({ offerId: 1 }); } catch {}
    const passwordHash = await hashPassword(password);
    await db.collection("users").insertOne({ username: "admin", displayName: "Administrator", passwordHash, role: "admin", preferences: { theme: "light", defaultMarginPct: 30 }, createdAt: new Date(), lastLoginAt: null });
    return res.status(201).json({ success: true, message: "Admin created. Username: admin", note: "Endpoint now disabled." });
  } catch (e) { return res.status(500).json({ error: "Setup failed: " + e.message }); }
}
