import { getDb } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { ObjectId } from "mongodb";

async function handler(req, res) {
  const id = req.query.id;
  if (!id || !ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid simulation ID" });

  if (req.method === "GET") {
    const db = await getDb();
    const sim = await db.collection("simulations").findOne({ _id: new ObjectId(id) });
    if (!sim) return res.status(404).json({ error: "Simulation not found" });
    return res.status(200).json(sim);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
