/*
 * Seed the first admin user.
 * 
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." JWT_SECRET="..." node scripts/seed-admin.js
 * 
 * This creates an admin user with:
 *   username: admin
 *   password: OfferOS@2024
 * 
 * Change the password immediately after first login.
 */

import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("❌ Set MONGODB_URI environment variable");
  process.exit(1);
}

async function seed() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("offeros");

    // Create indexes
    await db.collection("users").createIndex({ username: 1 }, { unique: true });
    await db.collection("offers").createIndex({ campaignId: 1 });
    await db.collection("simulations").createIndex({ offerId: 1 });
    await db.collection("simulations").createIndex({ campaignId: 1 });
    console.log("✓ Indexes created");

    // Check if admin exists
    const existing = await db.collection("users").findOne({ username: "admin" });
    if (existing) {
      console.log("⚠ Admin user already exists — skipping");
      return;
    }

    // Create admin
    const hash = await bcrypt.hash("OfferOS@2024", 12);
    await db.collection("users").insertOne({
      username: "admin",
      displayName: "Administrator",
      passwordHash: hash,
      role: "admin",
      preferences: { theme: "light", defaultMarginPct: 30 },
      createdAt: new Date(),
      lastLoginAt: null,
    });

    console.log("✓ Admin user created");
    console.log("  Username: admin");
    console.log("  Password: OfferOS@2024");
    console.log("  ⚠ Change this password after first login!");
  } catch (e) {
    console.error("❌ Seed failed:", e.message);
  } finally {
    await client.close();
  }
}

seed();
