import { getDb } from "../lib/db.js";
import { hashPassword } from "../lib/hash.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ 
      message: "POST to this endpoint to create the admin user. Send: { password: 'your-chosen-password' }",
      warning: "This only works if no admin user exists yet."
    });
  }

  try {
    const db = await getDb();

    // Check if any admin already exists — if so, block
    const existing = await db.collection("users").findOne({ role: "admin" });
    if (existing) {
      return res.status(403).json({ error: "Admin user already exists. This endpoint is disabled." });
    }

    const { password } = req.body || {};
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Provide a password with at least 8 characters in the request body: { password: '...' }" });
    }

    // Create indexes
    try {
      await db.collection("users").createIndex({ username: 1 }, { unique: true });
      await db.collection("offers").createIndex({ campaignId: 1 });
      await db.collection("simulations").createIndex({ offerId: 1 });
      await db.collection("simulations").createIndex({ campaignId: 1 });
    } catch (e) {
      // Indexes may already exist, that's fine
    }

    // Create admin user
    const passwordHash = await hashPassword(password);
    await db.collection("users").insertOne({
      username: "admin",
      displayName: "Administrator",
      passwordHash,
      role: "admin",
      preferences: { theme: "light", defaultMarginPct: 30 },
      createdAt: new Date(),
      lastLoginAt: null,
    });

    return res.status(201).json({ 
      success: true,
      message: "Admin user created successfully",
      username: "admin",
      note: "This endpoint is now disabled. Log in with your admin credentials."
    });
  } catch (e) {
    return res.status(500).json({ error: "Setup failed: " + e.message });
  }
}
