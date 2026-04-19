import { getDb } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { ObjectId } from "mongodb";

async function handler(req, res) {
  const db = await getDb();
  const { id, offerId } = req.query;

  if (id) {
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid simulation ID" });
    if (req.method === "GET") {
      const sim = await db.collection("simulations").findOne({ _id: new ObjectId(id) });
      if (!sim) return res.status(404).json({ error: "Simulation not found" });
      return res.status(200).json(sim);
    }
  }

  if (req.method === "GET") {
    if (!offerId) return res.status(400).json({ error: "offerId required" });
    try {
      const sims = await db.collection("simulations").find({ offerId }).sort({ runAt: -1 }).limit(10).toArray();
      return res.status(200).json(sims);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  if (req.method === "POST") {
    try {
      const { offerId: oid, campaignId, transactions, result, roi, marginPct } = req.body || {};
      if (!oid || !result) return res.status(400).json({ error: "offerId and result required" });
      const doc = { offerId: oid, campaignId: campaignId || null, transactions: transactions || [], result, roi: roi || null, marginPct: marginPct || 30, runBy: req.user.id, runAt: new Date() };
      const r = await db.collection("simulations").insertOne(doc);
      return res.status(201).json({ ...doc, _id: r.insertedId });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
