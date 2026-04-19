import { getDb } from "../lib/db.js";
import { verifyPassword, hashPassword } from "../lib/hash.js";
import { signToken, setCookie, clearCookie, getTokenFromRequest, verifyToken } from "../lib/auth.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  const { action } = req.query;

  // POST /api/auth?action=login
  if (action === "login" && req.method === "POST") {
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
      return res.status(200).json({ user: { id: user._id, username: user.username, displayName: user.displayName, role: user.role, preferences: user.preferences || {} } });
    } catch (e) { return res.status(500).json({ error: "Server error: " + e.message }); }
  }

  // GET /api/auth?action=me
  if (action === "me" && req.method === "GET") {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid token" });
    try {
      const db = await getDb();
      const user = await db.collection("users").findOne({ _id: new ObjectId(payload.id) }, { projection: { passwordHash: 0 } });
      if (!user) return res.status(401).json({ error: "User not found" });
      return res.status(200).json({ user: { id: user._id, username: user.username, displayName: user.displayName, role: user.role, preferences: user.preferences || {} } });
    } catch (e) { return res.status(500).json({ error: "Server error: " + e.message }); }
  }

  // POST /api/auth?action=logout
  if (action === "logout" && req.method === "POST") {
    clearCookie(res);
    return res.status(200).json({ ok: true });
  }

  // POST /api/auth?action=register (admin only)
  if (action === "register" && req.method === "POST") {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const caller = verifyToken(token);
    if (!caller || caller.role !== "admin") return res.status(403).json({ error: "Admin access required" });
    try {
      const { username, password, displayName, role } = req.body || {};
      if (!username || !password || !displayName) return res.status(400).json({ error: "username, password, displayName required" });
      if (role && !["admin", "editor"].includes(role)) return res.status(400).json({ error: "role must be admin or editor" });
      const db = await getDb();
      const existing = await db.collection("users").findOne({ username: username.toLowerCase() });
      if (existing) return res.status(409).json({ error: "Username already exists" });
      const ph = await hashPassword(password);
      const result = await db.collection("users").insertOne({ username: username.toLowerCase(), displayName, passwordHash: ph, role: role || "editor", preferences: { theme: "light", defaultMarginPct: 30 }, createdAt: new Date(), lastLoginAt: null });
      return res.status(201).json({ id: result.insertedId, username: username.toLowerCase(), displayName, role: role || "editor" });
    } catch (e) { return res.status(500).json({ error: "Server error: " + e.message }); }
  }

  return res.status(400).json({ error: "Invalid action. Use ?action=login|me|logout|register" });
}
