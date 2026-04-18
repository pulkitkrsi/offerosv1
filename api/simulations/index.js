import { getDb } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

async function handler(req, res) {
  const db = await getDb();

  if (req.method === "GET") {
    const { offerId } = req.query;
    if (!offerId) return res.status(400).json({ error: "offerId required" });
    try {
      const sims = await db.collection("simulations").find({ offerId }).sort({ runAt: -1 }).limit(10).toArray();
      return res.status(200).json(sims);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    try {
      const { offerId, campaignId, transactions, result, roi, marginPct } = req.body || {};
      if (!offerId || !result) return res.status(400).json({ error: "offerId and result required" });

      const doc = {
        offerId,
        campaignId: campaignId || null,
        transactions: transactions || [],
        result,
        roi: roi || null,
        marginPct: marginPct || 30,
        runBy: req.user.id,
        runAt: new Date(),
      };
      const r = await db.collection("simulations").insertOne(doc);
      return res.status(201).json({ ...doc, _id: r.insertedId });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
