import jwt from "jsonwebtoken";

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET environment variable not set");
  return s;
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token) {
  try { return jwt.verify(token, getSecret()); }
  catch { return null; }
}

export function getTokenFromRequest(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/offeros_token=([^;]+)/);
  if (match) return match[1];
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function requireAuth(handler) {
  return async (req, res) => {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const user = verifyToken(token);
    if (!user) return res.status(401).json({ error: "Invalid or expired token" });
    req.user = user;
    return handler(req, res);
  };
}

export function requireAdmin(handler) {
  return requireAuth(async (req, res) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
    return handler(req, res);
  });
}

export function setCookie(res, token) {
  res.setHeader("Set-Cookie", `offeros_token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax; ${process.env.NODE_ENV === "production" ? "Secure;" : ""}`);
}

export function clearCookie(res) {
  res.setHeader("Set-Cookie", "offeros_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax;");
}
