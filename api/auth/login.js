import { getDb } from "../lib/db.js";
import { verifyPassword } from "../lib/hash.js";
import { signToken, setCookie } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const db = await getDb();
    const user = await db.collection("users").findOne({ username: username.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    const token = signToken({ id: user._id.toString(), username: user.username, role: user.role, displayName: user.displayName });
    setCookie(res, token);

    return res.status(200).json({
      user: { id: user._id, username: user.username, displayName: user.displayName, role: user.role, preferences: user.preferences || {} }
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
